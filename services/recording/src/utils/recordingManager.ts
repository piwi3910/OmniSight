import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';
import logger from './logger';
import { RabbitMQManager, MessageType } from '@omnisight/shared';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Map of active recordings
interface RecordingSession {
  id: string;
  cameraId: string;
  streamId: string;
  ffmpegProcess: any;
  startTime: Date;
  segmentDuration: number; // in seconds
  currentSegment: number;
  segmentPath: string;
  status: 'recording' | 'paused' | 'stopped' | 'error';
  error?: string;
  metadata: {
    resolution: string;
    bitrate: string;
    codec: string;
    fps: number;
  };
}

// Store active recording sessions
const activeRecordings = new Map<string, RecordingSession>();

// Reference to RabbitMQ manager
let rabbitmqManager: RabbitMQManager;

/**
 * Initialize RabbitMQ connection
 */
export const initializeRabbitMQ = async (): Promise<void> => {
  try {
    // Create RabbitMQ manager
    rabbitmqManager = new RabbitMQManager({
      url: config.rabbitmq.url,
      serviceName: 'recording',
      logger
    });
    
    // Connect to RabbitMQ
    await rabbitmqManager.connect();
    
    // Set up exchanges
    await rabbitmqManager.setupTopology();
    
    // Set up consumer for stream frames
    await rabbitmqManager.consume(
      'recording.frames-queue',
      async (message) => {
        if (message.type === MessageType.STREAM_FRAME) {
          await processVideoFrame(message.payload);
        }
      }
    );
    
    // Set up consumer for recording commands
    await rabbitmqManager.consume(
      'recording.commands-queue',
      async (message) => {
        switch (message.type) {
          case MessageType.RECORDING_START:
            await startRecording(message.payload);
            break;
          case MessageType.RECORDING_STOP:
            await stopRecording(message.payload.recordingId);
            break;
          case MessageType.RECORDING_PAUSE:
            await pauseRecording(message.payload.recordingId);
            break;
          case MessageType.RECORDING_RESUME:
            await resumeRecording(message.payload.recordingId);
            break;
        }
      }
    );
    
    logger.info('RabbitMQ connection established for recording service');
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ:', error);
    throw error;
  }
};

/**
 * Start a new recording
 */
export const startRecording = async (options: {
  cameraId: string;
  streamId: string;
  duration?: number;
  segmentDuration?: number;
  quality?: 'low' | 'medium' | 'high';
}): Promise<string> => {
  try {
    const {
      cameraId,
      streamId,
      duration = 0, // 0 means record until stopped
      segmentDuration = config.recording.segmentDuration, // default from config
      quality = 'medium'
    } = options;
    
    // Generate recording ID
    const recordingId = uuidv4();
    
    // Create recording directory
    const recordingDir = path.join(
      config.recording.storagePath,
      cameraId,
      recordingId
    );
    
    // Ensure recording directory exists
    fs.mkdirSync(recordingDir, { recursive: true });
    
    // Set up quality parameters
    const qualitySettings = {
      low: { bitrate: '1000k', resolution: '640x360' },
      medium: { bitrate: '2500k', resolution: '1280x720' },
      high: { bitrate: '5000k', resolution: '1920x1080' }
    };
    
    const settings = qualitySettings[quality];
    
    // Set up FFmpeg process for recording
    const outputPath = path.join(recordingDir, 'segment_%03d.mp4');
    
    // Start FFmpeg to create segments
    const ffmpegProcess = spawn('ffmpeg', [
      '-f', 'image2pipe', // Input is piped images
      '-framerate', '25', // Assume 25 FPS
      '-i', '-', // Read from stdin
      '-c:v', 'libx264', // H.264 codec
      '-preset', 'medium', // Encoding preset
      '-b:v', settings.bitrate, // Bitrate
      '-maxrate', settings.bitrate, // Max bitrate
      '-bufsize', (parseInt(settings.bitrate) * 2) + 'k', // Buffer size
      '-vf', `scale=${settings.resolution}`, // Resolution
      '-g', '50', // Keyframe interval (2 seconds at 25 FPS)
      '-segment_time', segmentDuration.toString(), // Segment duration in seconds
      '-f', 'segment', // Segment format
      '-reset_timestamps', '1', // Reset timestamps for each segment
      '-segment_format', 'mp4', // Format for segments
      outputPath // Output pattern
    ]);
    
    // Handle FFmpeg errors
    ffmpegProcess.stderr.on('data', (data) => {
      logger.debug(`FFmpeg [${recordingId}]: ${data.toString()}`);
    });
    
    // Handle FFmpeg exit
    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`FFmpeg process exited with code ${code}`);
        
        // Update recording status
        const recording = activeRecordings.get(recordingId);
        if (recording) {
          recording.status = 'error';
          recording.error = `FFmpeg process exited with code ${code}`;
        }
        
        // Update database
        updateRecordingStatus(recordingId, 'error', `FFmpeg process exited with code ${code}`);
      } else {
        logger.info(`FFmpeg process completed for recording ${recordingId}`);
        
        // Finalize recording if it's still active
        const recording = activeRecordings.get(recordingId);
        if (recording && recording.status === 'recording') {
          finalizeRecording(recordingId);
        }
      }
    });
    
    // Store recording session
    activeRecordings.set(recordingId, {
      id: recordingId,
      cameraId,
      streamId,
      ffmpegProcess,
      startTime: new Date(),
      segmentDuration,
      currentSegment: 0,
      segmentPath: outputPath,
      status: 'recording',
      metadata: {
        resolution: settings.resolution,
        bitrate: settings.bitrate,
        codec: 'h264',
        fps: 25
      }
    });
    
    // Create recording entry in database
    await prisma.recording.create({
      data: {
        id: recordingId,
        cameraId,
        streamId,
        startTime: new Date(),
        status: 'recording',
        metadata: {
          segmentDuration,
          quality,
          resolution: settings.resolution,
          bitrate: settings.bitrate,
          codec: 'h264',
          fps: 25
        }
      }
    });
    
    // If duration is specified, set timeout to stop recording
    if (duration > 0) {
      setTimeout(() => {
        stopRecording(recordingId)
          .catch(err => logger.error(`Error stopping recording ${recordingId}:`, err));
      }, duration * 1000);
    }
    
    logger.info(`Started recording ${recordingId} for camera ${cameraId}`);
    
    // Publish recording started event
    await publishRecordingEvent(
      MessageType.RECORDING_STARTED,
      {
        recordingId,
        cameraId,
        streamId,
        startTime: new Date().toISOString(),
        metadata: {
          segmentDuration,
          quality,
          resolution: settings.resolution,
          bitrate: settings.bitrate
        }
      }
    );
    
    return recordingId;
  } catch (error) {
    logger.error('Error starting recording:', error);
    throw error;
  }
};

/**
 * Stop a recording
 */
export const stopRecording = async (recordingId: string): Promise<void> => {
  try {
    const recording = activeRecordings.get(recordingId);
    
    if (!recording) {
      logger.warn(`Attempted to stop non-existent recording: ${recordingId}`);
      return;
    }
    
    logger.info(`Stopping recording ${recordingId}`);
    
    // Gracefully stop FFmpeg
    if (recording.ffmpegProcess) {
      recording.ffmpegProcess.stdin.end();
      
      // Force kill after timeout
      setTimeout(() => {
        try {
          if (recording.ffmpegProcess) {
            recording.ffmpegProcess.kill('SIGKILL');
          }
        } catch (err) {
          logger.error(`Error killing FFmpeg process for recording ${recordingId}:`, err);
        }
      }, 5000);
    }
    
    // Wait for finalization
    await finalizeRecording(recordingId);
    
  } catch (error) {
    logger.error(`Error stopping recording ${recordingId}:`, error);
    throw error;
  }
};

/**
 * Pause a recording
 */
export const pauseRecording = async (recordingId: string): Promise<void> => {
  try {
    const recording = activeRecordings.get(recordingId);
    
    if (!recording) {
      logger.warn(`Attempted to pause non-existent recording: ${recordingId}`);
      return;
    }
    
    if (recording.status === 'paused') {
      logger.warn(`Recording ${recordingId} is already paused`);
      return;
    }
    
    logger.info(`Pausing recording ${recordingId}`);
    
    // Set status to paused
    recording.status = 'paused';
    
    // Update database
    await updateRecordingStatus(recordingId, 'paused');
    
    // Publish recording paused event
    await publishRecordingEvent(
      MessageType.RECORDING_PAUSED,
      {
        recordingId,
        pauseTime: new Date().toISOString()
      }
    );
    
  } catch (error) {
    logger.error(`Error pausing recording ${recordingId}:`, error);
    throw error;
  }
};

/**
 * Resume a paused recording
 */
export const resumeRecording = async (recordingId: string): Promise<void> => {
  try {
    const recording = activeRecordings.get(recordingId);
    
    if (!recording) {
      logger.warn(`Attempted to resume non-existent recording: ${recordingId}`);
      return;
    }
    
    if (recording.status !== 'paused') {
      logger.warn(`Recording ${recordingId} is not paused`);
      return;
    }
    
    logger.info(`Resuming recording ${recordingId}`);
    
    // Set status to recording
    recording.status = 'recording';
    
    // Update database
    await updateRecordingStatus(recordingId, 'recording');
    
    // Publish recording resumed event
    await publishRecordingEvent(
      MessageType.RECORDING_RESUMED,
      {
        recordingId,
        resumeTime: new Date().toISOString()
      }
    );
    
  } catch (error) {
    logger.error(`Error resuming recording ${recordingId}:`, error);
    throw error;
  }
};

/**
 * Finalize a recording
 */
const finalizeRecording = async (recordingId: string): Promise<void> => {
  try {
    const recording = activeRecordings.get(recordingId);
    
    if (!recording) {
      logger.warn(`Attempted to finalize non-existent recording: ${recordingId}`);
      return;
    }
    
    logger.info(`Finalizing recording ${recordingId}`);
    
    // Generate recording index and metadata
    const recordingDir = path.join(
      config.recording.storagePath,
      recording.cameraId,
      recordingId
    );
    
    // Get list of segments
    const segments = fs.readdirSync(recordingDir)
      .filter(file => file.match(/segment_\d+\.mp4/))
      .sort();
    
    // Create segment entries in database
    for (const segment of segments) {
      const segmentPath = path.join(recordingDir, segment);
      const segmentStat = fs.statSync(segmentPath);
      
      // Generate thumbnail for segment
      const thumbnailPath = path.join(recordingDir, segment.replace('.mp4', '.jpg'));
      
      await generateThumbnail(segmentPath, thumbnailPath);
      
      // Create segment in database
      await prisma.segment.create({
        data: {
          recordingId,
          filePath: segmentPath,
          thumbnailPath,
          duration: recording.segmentDuration,
          size: segmentStat.size,
          index: parseInt(segment.match(/segment_(\d+)\.mp4/)?.[1] || '0'),
          createdAt: new Date()
        }
      });
    }
    
    // Create manifest file
    const manifest = {
      recordingId,
      cameraId: recording.cameraId,
      streamId: recording.streamId,
      startTime: recording.startTime.toISOString(),
      endTime: new Date().toISOString(),
      segments: segments.map((segment, index) => ({
        filename: segment,
        index,
        thumbnail: segment.replace('.mp4', '.jpg'),
        duration: recording.segmentDuration
      })),
      metadata: recording.metadata
    };
    
    // Write manifest to file
    fs.writeFileSync(
      path.join(recordingDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Update recording status in database
    await updateRecordingStatus(
      recordingId,
      'completed',
      undefined,
      new Date(),
      segments.length * recording.segmentDuration
    );
    
    // Remove from active recordings
    activeRecordings.delete(recordingId);
    
    // Publish recording completed event
    await publishRecordingEvent(
      MessageType.RECORDING_COMPLETED,
      {
        recordingId,
        cameraId: recording.cameraId,
        streamId: recording.streamId,
        startTime: recording.startTime.toISOString(),
        endTime: new Date().toISOString(),
        duration: segments.length * recording.segmentDuration,
        segmentCount: segments.length,
        metadata: recording.metadata
      }
    );
    
    logger.info(`Recording ${recordingId} finalized with ${segments.length} segments`);
    
  } catch (error) {
    logger.error(`Error finalizing recording ${recordingId}:`, error);
    
    // Update status to error
    await updateRecordingStatus(recordingId, 'error', String(error));
    
    // Remove from active recordings
    activeRecordings.delete(recordingId);
  }
};

/**
 * Generate a thumbnail for a video segment
 */
const generateThumbnail = async (videoPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Use FFmpeg to extract a thumbnail at the 1 second mark
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01.000',
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      '-q:v', '2',
      outputPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.stderr.on('data', (data) => {
      logger.debug(`Thumbnail FFmpeg: ${data.toString()}`);
    });
  });
};

/**
 * Update recording status in database
 */
const updateRecordingStatus = async (
  recordingId: string,
  status: string,
  error?: string,
  endTime?: Date,
  duration?: number
): Promise<void> => {
  try {
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status,
        error,
        endTime,
        duration,
        updatedAt: new Date()
      }
    });
  } catch (err) {
    logger.error(`Error updating recording status for ${recordingId}:`, err);
  }
};

/**
 * Process a video frame from RabbitMQ
 */
const processVideoFrame = async (frameData: any): Promise<void> => {
  try {
    const { streamId, cameraId, data } = frameData;
    
    // Find recordings for this stream
    const streamRecordings = Array.from(activeRecordings.values())
      .filter(r => r.streamId === streamId && r.status === 'recording');
    
    if (streamRecordings.length === 0) {
      return;
    }
    
    // Decode base64 frame data
    const frameBuffer = Buffer.from(data, 'base64');
    
    // Write frame to all active recordings for this stream
    for (const recording of streamRecordings) {
      if (recording.ffmpegProcess && recording.ffmpegProcess.stdin.writable) {
        recording.ffmpegProcess.stdin.write(frameBuffer);
      }
    }
    
  } catch (error) {
    logger.error('Error processing video frame:', error);
  }
};

/**
 * Publish a recording event to RabbitMQ
 */
const publishRecordingEvent = async (eventType: MessageType, data: any): Promise<void> => {
  try {
    if (!rabbitmqManager) {
      logger.error('RabbitMQ not initialized');
      return;
    }
    
    // Publish event to recordings exchange
    await rabbitmqManager.publish(
      'recordings',
      `recording.event`,
      rabbitmqManager.createMessage(
        eventType,
        data
      )
    );
    
    logger.info(`Published ${eventType} event for recording ${data.recordingId}`);
  } catch (error) {
    logger.error(`Error publishing ${eventType} event:`, error);
  }
};

/**
 * Get all active recordings
 */
export const getActiveRecordings = (): any[] => {
  return Array.from(activeRecordings.values()).map(recording => ({
    id: recording.id,
    cameraId: recording.cameraId,
    streamId: recording.streamId,
    startTime: recording.startTime,
    status: recording.status,
    metadata: recording.metadata,
    currentSegment: recording.currentSegment
  }));
};

/**
 * Get recording by ID
 */
export const getRecording = async (recordingId: string): Promise<any> => {
  // Check active recordings first
  const activeRecording = activeRecordings.get(recordingId);
  
  if (activeRecording) {
    return {
      id: activeRecording.id,
      cameraId: activeRecording.cameraId,
      streamId: activeRecording.streamId,
      startTime: activeRecording.startTime,
      status: activeRecording.status,
      metadata: activeRecording.metadata,
      currentSegment: activeRecording.currentSegment,
      isActive: true
    };
  }
  
  // Check database for completed recordings
  const dbRecording = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: {
      segments: {
        orderBy: {
          index: 'asc'
        }
      }
    }
  });
  
  if (!dbRecording) {
    return null;
  }
  
  return {
    ...dbRecording,
    isActive: false
  };
};

/**
 * Clean up old recordings based on retention policy
 */
export const cleanupOldRecordings = async (): Promise<void> => {
  try {
    logger.info('Starting recording cleanup task');
    
    const retentionDays = config.recording.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Find all recordings older than retention period
    const oldRecordings = await prisma.recording.findMany({
      where: {
        startTime: {
          lt: cutoffDate
        },
        status: 'completed'
      },
      include: {
        segments: true
      }
    });
    
    logger.info(`Found ${oldRecordings.length} recordings to clean up`);
    
    for (const recording of oldRecordings) {
      try {
        // Delete all segment files
        for (const segment of recording.segments) {
          try {
            // Delete video file
            if (fs.existsSync(segment.filePath)) {
              fs.unlinkSync(segment.filePath);
            }
            
            // Delete thumbnail
            if (fs.existsSync(segment.thumbnailPath)) {
              fs.unlinkSync(segment.thumbnailPath);
            }
          } catch (err) {
            logger.error(`Error deleting segment files for segment ${segment.id}:`, err);
          }
        }
        
        // Delete manifest file
        const manifestPath = path.join(
          config.recording.storagePath,
          recording.cameraId,
          recording.id,
          'manifest.json'
        );
        
        if (fs.existsSync(manifestPath)) {
          fs.unlinkSync(manifestPath);
        }
        
        // Delete recording directory
        const recordingDir = path.join(
          config.recording.storagePath,
          recording.cameraId,
          recording.id
        );
        
        if (fs.existsSync(recordingDir)) {
          fs.rmdirSync(recordingDir);
        }
        
        // Delete database entries
        await prisma.segment.deleteMany({
          where: {
            recordingId: recording.id
          }
        });
        
        await prisma.recording.delete({
          where: {
            id: recording.id
          }
        });
        
        logger.info(`Cleaned up recording ${recording.id}`);
        
      } catch (err) {
        logger.error(`Error cleaning up recording ${recording.id}:`, err);
      }
    }
    
    logger.info('Recording cleanup task completed');
    
  } catch (error) {
    logger.error('Error in recording cleanup task:', error);
  }
};

/**
 * Initialize cleanup scheduler
 */
export const initializeCleanupScheduler = (): void => {
  // Run cleanup once a day
  setInterval(() => {
    cleanupOldRecordings()
      .catch(err => logger.error('Error in scheduled cleanup:', err));
  }, 24 * 60 * 60 * 1000);
  
  // Run cleanup on startup after a delay
  setTimeout(() => {
    cleanupOldRecordings()
      .catch(err => logger.error('Error in initial cleanup:', err));
  }, 60 * 1000);
};