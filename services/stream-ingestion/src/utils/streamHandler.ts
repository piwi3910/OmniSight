import Stream from 'node-rtsp-stream';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';
import logger from './logger';
import { publishVideoFrame, publishStreamEvent } from './rabbitmq';

// Map to store active streams
const activeStreams: Map<string, StreamInstance> = new Map();

// Interface for stream options
interface StreamOptions {
  name: string;
  url: string;
  username?: string;
  password?: string;
  frameRate?: number;
  width?: number;
  height?: number;
}

// Interface for stream instance
interface StreamInstance {
  id: string;
  cameraId: string;
  stream: Stream;
  options: StreamOptions;
  startTime: Date;
  frameCount: number;
  lastFrameTime?: Date;
  isActive: boolean;
  error?: Error;
}

/**
 * Create RTSP stream URL with authentication if provided
 */
const createAuthUrl = (url: string, username?: string, password?: string): string => {
  if (!username || !password) {
    return url;
  }
  
  try {
    const urlObj = new URL(url);
    urlObj.username = username;
    urlObj.password = password;
    return urlObj.toString();
  } catch (error) {
    logger.error(`Invalid URL: ${url}`, error);
    return url;
  }
};

/**
 * Start a new RTSP stream
 */
export const startStream = async (
  cameraId: string,
  options: StreamOptions
): Promise<StreamInstance | null> => {
  try {
    // Generate stream ID
    const streamId = uuidv4();
    
    // Create auth URL if credentials provided
    const streamUrl = createAuthUrl(options.url, options.username, options.password);
    
    // Ensure data directory exists
    const dataDir = path.join(config.stream.dataPath, cameraId);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Set up stream options
    const streamOptions = {
      name: options.name,
      streamUrl,
      wsPort: 0, // We don't need WebSocket server
      ffmpegOptions: {
        '-stats': '', // Print encoding progress/statistics
        '-r': options.frameRate || config.stream.frameRate,
        '-s': `${options.width || config.stream.width}x${options.height || config.stream.height}`,
        '-q:v': '3', // Quality level (lower is better)
      }
    };
    
    // Create stream instance
    const stream = new Stream(streamOptions);
    
    // Create stream instance object
    const streamInstance: StreamInstance = {
      id: streamId,
      cameraId,
      stream,
      options,
      startTime: new Date(),
      frameCount: 0,
      isActive: true
    };
    
    // Store in active streams map
    activeStreams.set(streamId, streamInstance);
    
    // Set up event handlers
    stream.on('data', (data: Buffer) => {
      handleFrameData(streamInstance, data);
    });
    
    stream.on('error', (error: Error) => {
      handleStreamError(streamInstance, error);
    });
    
    // Publish stream started event
    await publishStreamEvent(cameraId, streamId, 'started', {
      name: options.name,
      url: options.url,
      startTime: streamInstance.startTime.toISOString()
    });
    
    // Notify recording service
    try {
      await axios.post(`${config.recordingService.url}/api/recordings/start`, {
        cameraId,
        streamId,
        name: options.name,
        startTime: streamInstance.startTime.toISOString()
      });
    } catch (error) {
      logger.error(`Failed to notify recording service for stream ${streamId}:`, error);
    }
    
    logger.info(`Started stream ${streamId} for camera ${cameraId}`);
    
    return streamInstance;
  } catch (error) {
    logger.error(`Failed to start stream for camera ${cameraId}:`, error);
    
    // Publish stream error event
    await publishStreamEvent(cameraId, 'error', 'error', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    
    return null;
  }
};

/**
 * Handle frame data from stream
 */
const handleFrameData = async (streamInstance: StreamInstance, data: Buffer): Promise<void> => {
  try {
    // Update stream instance
    streamInstance.frameCount++;
    streamInstance.lastFrameTime = new Date();
    
    // Publish frame to RabbitMQ
    await publishVideoFrame(
      streamInstance.cameraId,
      streamInstance.id,
      data,
      streamInstance.lastFrameTime
    );
  } catch (error) {
    logger.error(`Error handling frame data for stream ${streamInstance.id}:`, error);
  }
};

/**
 * Handle stream error
 */
const handleStreamError = async (streamInstance: StreamInstance, error: Error): Promise<void> => {
  try {
    logger.error(`Stream ${streamInstance.id} error:`, error);
    
    // Update stream instance
    streamInstance.isActive = false;
    streamInstance.error = error;
    
    // Publish stream error event
    await publishStreamEvent(
      streamInstance.cameraId,
      streamInstance.id,
      'error',
      {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    );
    
    // Attempt to restart stream after delay
    setTimeout(() => {
      if (activeStreams.has(streamInstance.id)) {
        logger.info(`Attempting to restart stream ${streamInstance.id}`);
        stopStream(streamInstance.id);
        startStream(streamInstance.cameraId, streamInstance.options);
      }
    }, config.stream.reconnectInterval);
  } catch (error) {
    logger.error(`Error handling stream error for ${streamInstance.id}:`, error);
  }
};

/**
 * Stop a stream
 */
export const stopStream = async (streamId: string): Promise<boolean> => {
  try {
    // Get stream instance
    const streamInstance = activeStreams.get(streamId);
    if (!streamInstance) {
      logger.warn(`Stream ${streamId} not found`);
      return false;
    }
    
    // Stop stream
    streamInstance.stream.stop();
    
    // Update stream instance
    streamInstance.isActive = false;
    
    // Remove from active streams
    activeStreams.delete(streamId);
    
    // Publish stream stopped event
    await publishStreamEvent(
      streamInstance.cameraId,
      streamId,
      'stopped',
      {
        name: streamInstance.options.name,
        startTime: streamInstance.startTime.toISOString(),
        endTime: new Date().toISOString(),
        frameCount: streamInstance.frameCount
      }
    );
    
    // Notify recording service
    try {
      await axios.post(`${config.recordingService.url}/api/recordings/${streamId}/stop`, {
        endTime: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Failed to notify recording service to stop recording for stream ${streamId}:`, error);
    }
    
    logger.info(`Stopped stream ${streamId}`);
    
    return true;
  } catch (error) {
    logger.error(`Failed to stop stream ${streamId}:`, error);
    return false;
  }
};

/**
 * Get all active streams
 */
export const getActiveStreams = (): StreamInstance[] => {
  return Array.from(activeStreams.values());
};

/**
 * Get a specific stream by ID
 */
export const getStream = (streamId: string): StreamInstance | undefined => {
  return activeStreams.get(streamId);
};

/**
 * Get all streams for a camera
 */
export const getStreamsByCamera = (cameraId: string): StreamInstance[] => {
  return Array.from(activeStreams.values())
    .filter(stream => stream.cameraId === cameraId);
};

/**
 * Stop all streams
 */
export const stopAllStreams = async (): Promise<void> => {
  const streamIds = Array.from(activeStreams.keys());
  
  for (const streamId of streamIds) {
    await stopStream(streamId);
  }
  
  logger.info(`Stopped all ${streamIds.length} streams`);
};