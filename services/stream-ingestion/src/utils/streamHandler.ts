import { RabbitMQManager, MessageType, StreamFramePayload } from '@omnisight/shared';
import { Stream } from 'node-rtsp-stream';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { Writable } from 'stream';
import config from '../config/config';
import logger from './logger';
import { getCameraById, updateStreamStatus } from '../controllers/streamController';

// Map of active streams by streamId
const activeStreams = new Map<string, {
  stream: Stream;
  ffmpegProcess?: ffmpeg.FfmpegCommand;
  frameCount: number;
  startTime: Date;
  lastFrameTime: Date;
  status: 'connecting' | 'active' | 'error' | 'stopped';
  healthCheckInterval?: NodeJS.Timeout;
  reconnectAttempts: number;
}>();

// Reference to RabbitMQ manager
let rabbitmqManager: RabbitMQManager;

/**
 * Initialize RabbitMQ connection for stream publishing
 */
export const initializeRabbitMQ = async (): Promise<void> => {
  try {
    // Create RabbitMQ manager
    rabbitmqManager = new RabbitMQManager({
      url: config.rabbitmq.url,
      serviceName: 'stream-ingestion',
      logger
    });
    
    // Connect to RabbitMQ
    await rabbitmqManager.connect();
    
    // Set up exchanges
    await rabbitmqManager.setupTopology();
    
    logger.info('RabbitMQ connection established for stream publishing');
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ:', error);
    throw error;
  }
};

/**
 * Start a new RTSP stream
 * @param cameraId - ID of the camera to stream
 * @param rtspUrl - RTSP URL to connect to
 * @param streamOptions - Stream options
 */
export const startStream = async (
  cameraId: string,
  rtspUrl: string,
  streamOptions: {
    name?: string;
    frameRate?: number;
    width?: number;
    height?: number;
    quality?: number;
    authentication?: {
      username: string;
      password: string;
    };
    publishFrames?: boolean;
  } = {}
): Promise<string> => {
  try {
    // Get camera details
    const camera = await getCameraById(cameraId);
    
    if (!camera) {
      throw new Error(`Camera with ID ${cameraId} not found`);
    }
    
    // Generate a unique stream ID
    const streamId = uuidv4();
    
    // Set default options
    const options = {
      name: streamOptions.name || `Stream_${camera.name}`,
      frameRate: streamOptions.frameRate || 15,
      width: streamOptions.width || 640,
      height: streamOptions.height || 480,
      quality: streamOptions.quality || 3,
      publishFrames: streamOptions.publishFrames !== false
    };
    
    // Build RTSP URL with authentication if provided
    let fullRtspUrl = rtspUrl;
    if (streamOptions.authentication) {
      const { username, password } = streamOptions.authentication;
      // Insert credentials into URL
      fullRtspUrl = rtspUrl.replace(
        /rtsp:\/\//,
        `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      );
    }
    
    logger.info(`Starting stream for camera ${cameraId} with ID ${streamId}`);
    
    // Create a custom output stream that publishes frames to RabbitMQ
    const framePublisher = new Writable({
      objectMode: true,
      write: (chunk, encoding, callback) => {
        publishFrameToRabbitMQ(streamId, cameraId, chunk.toString('base64'))
          .then(() => callback())
          .catch(err => {
            logger.error(`Error publishing frame for stream ${streamId}:`, err);
            callback();
          });
      }
    });
    
    // Create FFmpeg process for the stream
    const ffmpegProcess = ffmpeg(fullRtspUrl)
      .inputOptions([
        '-rtsp_transport tcp',
        '-re',
        '-analyzeduration 1000000'
      ])
      .outputOptions([
        `-r ${options.frameRate}`,
        `-s ${options.width}x${options.height}`,
        '-q:v 3',
        '-f image2',
        '-update 1'
      ])
      .format('image2pipe')
      .outputFormat('jpeg');
    
    // If publishing frames is enabled, pipe to the frame publisher
    if (options.publishFrames) {
      ffmpegProcess.pipe(framePublisher);
    }
    
    // Create RTSP stream
    const rtspStream = new Stream({
      name: options.name,
      streamUrl: fullRtspUrl,
      wsPort: 0, // Disable WebSocket server as we're using FFmpeg
      ffmpegOptions: {
        '-rtsp_transport': 'tcp',
        '-r': options.frameRate.toString(),
        '-q:v': options.quality.toString()
      }
    });
    
    // Store stream in active streams map
    activeStreams.set(streamId, {
      stream: rtspStream,
      ffmpegProcess,
      frameCount: 0,
      startTime: new Date(),
      lastFrameTime: new Date(),
      status: 'connecting',
      reconnectAttempts: 0
    });
    
    // Set up stream health check
    setupStreamHealthCheck(streamId, cameraId);
    
    // Publish stream started event
    await publishStreamEvent(
      MessageType.STREAM_STARTED,
      streamId,
      cameraId,
      {
        rtspUrl,
        options,
        startTime: new Date().toISOString()
      }
    );
    
    // Update stream status in the database
    await updateStreamStatus(streamId, {
      cameraId,
      status: 'active',
      startedAt: new Date(),
      options
    });
    
    logger.info(`Stream ${streamId} started successfully`);
    
    return streamId;
  } catch (error) {
    logger.error(`Failed to start stream for camera ${cameraId}:`, error);
    throw error;
  }
};

/**
 * Stop an active stream
 * @param streamId - ID of the stream to stop
 */
export const stopStream = async (streamId: string): Promise<void> => {
  try {
    const streamInfo = activeStreams.get(streamId);
    
    if (!streamInfo) {
      logger.warn(`Attempted to stop non-existent stream: ${streamId}`);
      return;
    }
    
    logger.info(`Stopping stream ${streamId}`);
    
    // Stop health check
    if (streamInfo.healthCheckInterval) {
      clearInterval(streamInfo.healthCheckInterval);
    }
    
    // Stop FFmpeg process
    if (streamInfo.ffmpegProcess) {
      streamInfo.ffmpegProcess.kill('SIGTERM');
    }
    
    // Stop RTSP stream
    if (streamInfo.stream) {
      streamInfo.stream.stop();
    }
    
    // Get camera ID before removing from map
    const cameraId = streamInfo.stream.cameraId;
    
    // Remove from active streams
    activeStreams.delete(streamId);
    
    // Publish stream stopped event
    await publishStreamEvent(
      MessageType.STREAM_STOPPED,
      streamId,
      cameraId,
      {
        endTime: new Date().toISOString(),
        frameCount: streamInfo.frameCount,
        duration: (new Date().getTime() - streamInfo.startTime.getTime()) / 1000
      }
    );
    
    // Update stream status in the database
    await updateStreamStatus(streamId, {
      status: 'stopped',
      endedAt: new Date()
    });
    
    logger.info(`Stream ${streamId} stopped successfully`);
    
  } catch (error) {
    logger.error(`Error stopping stream ${streamId}:`, error);
    throw error;
  }
};

/**
 * Set up stream health monitoring
 * @param streamId - ID of the stream to monitor
 * @param cameraId - ID of the camera
 */
const setupStreamHealthCheck = (streamId: string, cameraId: string): void => {
  const streamInfo = activeStreams.get(streamId);
  
  if (!streamInfo) {
    return;
  }
  
  // Check stream health every 5 seconds
  const healthCheckInterval = setInterval(async () => {
    try {
      const currentTime = new Date();
      const timeSinceLastFrame = currentTime.getTime() - streamInfo.lastFrameTime.getTime();
      
      // If no frames received in 10 seconds, consider stream unhealthy
      if (timeSinceLastFrame > 10000) {
        logger.warn(`Stream ${streamId} unhealthy: No frames for ${timeSinceLastFrame}ms`);
        
        // Update status to error
        if (streamInfo.status !== 'error') {
          streamInfo.status = 'error';
          
          // Publish stream error event
          await publishStreamEvent(
            MessageType.STREAM_ERROR,
            streamId,
            cameraId,
            {
              error: 'No frames received',
              timeSinceLastFrame,
              timestamp: currentTime.toISOString()
            }
          );
          
          // Update stream status in the database
          await updateStreamStatus(streamId, {
            status: 'error',
            lastError: 'No frames received'
          });
        }
        
        // Attempt to reconnect if not already at max attempts
        if (streamInfo.reconnectAttempts < config.stream.maxReconnectAttempts) {
          logger.info(`Attempting to reconnect stream ${streamId} (attempt ${streamInfo.reconnectAttempts + 1}/${config.stream.maxReconnectAttempts})`);
          
          streamInfo.reconnectAttempts++;
          
          // Restart FFmpeg process
          if (streamInfo.ffmpegProcess) {
            streamInfo.ffmpegProcess.kill('SIGTERM');
            
            // Create new FFmpeg process
            // This is simplified - in practice you would need to recreate it with the same options
            streamInfo.ffmpegProcess = ffmpeg(streamInfo.stream.streamUrl);
          }
        } else {
          logger.error(`Stream ${streamId} failed after ${streamInfo.reconnectAttempts} reconnect attempts`);
          
          // Stop the stream
          await stopStream(streamId);
        }
      } else {
        // Stream is healthy
        if (streamInfo.status !== 'active') {
          logger.info(`Stream ${streamId} healthy again`);
          streamInfo.status = 'active';
          streamInfo.reconnectAttempts = 0;
          
          // Update stream status in the database
          await updateStreamStatus(streamId, {
            status: 'active'
          });
        }
      }
    } catch (error) {
      logger.error(`Error in health check for stream ${streamId}:`, error);
    }
  }, 5000);
  
  // Store health check interval
  streamInfo.healthCheckInterval = healthCheckInterval;
};

/**
 * Publish a video frame to RabbitMQ
 * @param streamId - ID of the stream
 * @param cameraId - ID of the camera
 * @param frameData - Base64 encoded frame data
 */
const publishFrameToRabbitMQ = async (
  streamId: string,
  cameraId: string,
  frameData: string
): Promise<void> => {
  try {
    if (!rabbitmqManager) {
      logger.error('RabbitMQ not initialized');
      return;
    }
    
    const streamInfo = activeStreams.get(streamId);
    
    if (!streamInfo) {
      logger.warn(`Attempted to publish frame for non-existent stream: ${streamId}`);
      return;
    }
    
    // Update frame count and last frame time
    streamInfo.frameCount++;
    streamInfo.lastFrameTime = new Date();
    
    // Create frame payload
    const framePayload: StreamFramePayload = {
      streamId,
      cameraId,
      timestamp: new Date().toISOString(),
      frameNumber: streamInfo.frameCount,
      width: 640, // Should come from stream config
      height: 480, // Should come from stream config
      format: 'jpeg',
      data: frameData
    };
    
    // Publish frame to streams exchange
    await rabbitmqManager.publish(
      'streams',
      `stream.${cameraId}.frame`,
      rabbitmqManager.createMessage(
        MessageType.STREAM_FRAME,
        framePayload
      )
    );
    
    // Log every 100 frames
    if (streamInfo.frameCount % 100 === 0) {
      logger.debug(`Published frame ${streamInfo.frameCount} for stream ${streamId}`);
    }
  } catch (error) {
    logger.error(`Error publishing frame for stream ${streamId}:`, error);
  }
};

/**
 * Publish a stream event to RabbitMQ
 * @param eventType - Type of event
 * @param streamId - ID of the stream
 * @param cameraId - ID of the camera
 * @param data - Event data
 */
const publishStreamEvent = async (
  eventType: MessageType,
  streamId: string,
  cameraId: string,
  data: any
): Promise<void> => {
  try {
    if (!rabbitmqManager) {
      logger.error('RabbitMQ not initialized');
      return;
    }
    
    // Publish event to streams exchange
    await rabbitmqManager.publish(
      'streams',
      `stream.${cameraId}.event`,
      rabbitmqManager.createMessage(
        eventType,
        {
          streamId,
          cameraId,
          ...data
        }
      )
    );
    
    logger.info(`Published ${eventType} event for stream ${streamId}`);
  } catch (error) {
    logger.error(`Error publishing ${eventType} event for stream ${streamId}:`, error);
  }
};

/**
 * Get active streams
 * @returns Map of active streams
 */
export const getActiveStreams = (): Map<string, any> => {
  // Return a copy of the active streams with necessary information
  const streams = new Map<string, any>();
  
  activeStreams.forEach((streamInfo, streamId) => {
    streams.set(streamId, {
      cameraId: streamInfo.stream.cameraId,
      status: streamInfo.status,
      frameCount: streamInfo.frameCount,
      startTime: streamInfo.startTime,
      lastFrameTime: streamInfo.lastFrameTime,
      reconnectAttempts: streamInfo.reconnectAttempts
    });
  });
  
  return streams;
};

/**
 * Get stream status
 * @param streamId - ID of the stream
 * @returns Stream status or null if stream doesn't exist
 */
export const getStreamStatus = (streamId: string): any => {
  const streamInfo = activeStreams.get(streamId);
  
  if (!streamInfo) {
    return null;
  }
  
  return {
    streamId,
    cameraId: streamInfo.stream.cameraId,
    status: streamInfo.status,
    frameCount: streamInfo.frameCount,
    startTime: streamInfo.startTime,
    lastFrameTime: streamInfo.lastFrameTime,
    uptime: (new Date().getTime() - streamInfo.startTime.getTime()) / 1000,
    frameRate: calculateFrameRate(streamInfo),
    reconnectAttempts: streamInfo.reconnectAttempts
  };
};

/**
 * Calculate current frame rate for a stream
 * @param streamInfo - Stream information
 * @returns Current frame rate
 */
const calculateFrameRate = (streamInfo: any): number => {
  const uptime = (new Date().getTime() - streamInfo.startTime.getTime()) / 1000;
  
  if (uptime <= 0) {
    return 0;
  }
  
  return Math.round((streamInfo.frameCount / uptime) * 100) / 100;
};