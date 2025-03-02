import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import config from '../config/config';
import logger from './logger';
import { publishRecordingEvent } from './rabbitmq';
import { getStorageInfo, cleanupOldRecordings } from './storageManager';

// Map to store active recordings
const activeRecordings: Map<string, RecordingProcess> = new Map();

// Map to store active segments
const activeSegments: Map<string, SegmentInfo> = new Map();

// Interface for recording process
interface RecordingProcess {
  id: string;
  cameraId: string;
  streamId: string;
  ffmpegProcess: any;
  startTime: Date;
  currentSegment: SegmentInfo | null;
  segments: SegmentInfo[];
  isActive: boolean;
  error?: Error;
}

// Interface for segment info
interface SegmentInfo {
  id: string;
  recordingId: string;
  filePath: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  fileSize?: number;
  thumbnailPath?: string;
}

/**
 * Initialize recording directory structure
 */
export const initRecordingDirectories = (): void => {
  try {
    // Create main recordings directory
    const recordingsPath = config.recording.path;
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true });
      logger.info(`Created recordings directory: ${recordingsPath}`);
    }
    
    // Create thumbnails directory
    const thumbnailsPath = path.join(recordingsPath, 'thumbnails');
    if (!fs.existsSync(thumbnailsPath)) {
      fs.mkdirSync(thumbnailsPath, { recursive: true });
      logger.info(`Created thumbnails directory: ${thumbnailsPath}`);
    }
  } catch (error) {
    logger.error('Failed to initialize recording directories:', error);
    throw error;
  }
};

/**
 * Start a new recording for a camera stream
 */
export const startRecording = async (
  cameraId: string,
  streamId: string,
  name: string
): Promise<RecordingProcess | null> => {
  try {
    // Check if recording already exists for this stream
    const existingKey = `${cameraId}:${streamId}`;
    if (activeRecordings.has(existingKey)) {
      logger.warn(`Recording already exists for camera ${cameraId}, stream ${streamId}`);
      return activeRecordings.get(existingKey) || null;
    }
    
    // Generate recording ID
    const recordingId = uuidv4();
    
    // Create camera directory
    const cameraDir = path.join(config.recording.path, cameraId);
    if (!fs.existsSync(cameraDir)) {
      fs.mkdirSync(cameraDir, { recursive: true });
    }
    
    // Create recording directory
    const recordingDir = path.join(cameraDir, recordingId);
    if (!fs.existsSync(recordingDir)) {
      fs.mkdirSync(recordingDir, { recursive: true });
    }
    
    // Create recording process object
    const recordingProcess: RecordingProcess = {
      id: recordingId,
      cameraId,
      streamId,
      ffmpegProcess: null, // Will be set when first frame arrives
      startTime: new Date(),
      currentSegment: null,
      segments: [],
      isActive: true
    };
    
    // Store in active recordings map
    activeRecordings.set(existingKey, recordingProcess);
    
    // Publish recording started event
    await publishRecordingEvent(cameraId, recordingId, 'started', {
      name,
      streamId,
      startTime: recordingProcess.startTime.toISOString()
    });
    
    // Notify metadata service
    try {
      await axios.post(`${config.metadataService.url}/api/recordings`, {
        id: recordingId,
        cameraId,
        startTime: recordingProcess.startTime,
        status: 'recording'
      });
    } catch (error) {
      logger.error(`Failed to notify metadata service for recording ${recordingId}:`, error);
    }
    
    logger.info(`Started recording ${recordingId} for camera ${cameraId}, stream ${streamId}`);
    
    return recordingProcess;
  } catch (error) {
    logger.error(`Failed to start recording for camera ${cameraId}, stream ${streamId}:`, error);
    
    // Publish recording error event
    await publishRecordingEvent(cameraId, 'error', 'error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return null;
  }
};

/**
 * Process a video frame and write it to the current recording segment
 */
export const processVideoFrame = async (
  cameraId: string,
  streamId: string,
  frameData: Buffer,
  timestamp: Date
): Promise<void> => {
  try {
    // Get or create recording
    const recordingKey = `${cameraId}:${streamId}`;
    let recording = activeRecordings.get(recordingKey);
    
    if (!recording) {
      // Start a new recording
      recording = await startRecording(cameraId, streamId, `Camera ${cameraId}`);
      
      if (!recording) {
        throw new Error(`Failed to start recording for camera ${cameraId}, stream ${streamId}`);
      }
    }
    
    // Check if we need to start a new segment
    if (!recording.currentSegment) {
      await startNewSegment(recording);
    } else {
      // Check if current segment duration exceeds the configured segment duration
      const segmentStartTime = recording.currentSegment.startTime;
      const segmentDuration = (timestamp.getTime() - segmentStartTime.getTime()) / 1000;
      
      if (segmentDuration >= config.recording.segmentDuration) {
        // Finish current segment
        await finishSegment(recording);
        
        // Start a new segment
        await startNewSegment(recording);
      }
    }
    
    // Write frame to FFmpeg process
    if (recording.ffmpegProcess && recording.ffmpegProcess.stdin) {
      recording.ffmpegProcess.stdin.write(frameData);
    }
  } catch (error) {
    logger.error(`Error processing video frame for camera ${cameraId}, stream ${streamId}:`, error);
  }
};

/**
 * Start a new recording segment
 */
const startNewSegment = async (recording: RecordingProcess): Promise<SegmentInfo> => {
  try {
    // Generate segment ID
    const segmentId = uuidv4();
    
    // Create segment file path
    const segmentFileName = `segment_${new Date().toISOString().replace(/[:.]/g, '-')}.${config.recording.format}`;
    const segmentFilePath = path.join(
      config.recording.path,
      recording.cameraId,
      recording.id,
      segmentFileName
    );
    
    // Create segment info
    const segmentInfo: SegmentInfo = {
      id: segmentId,
      recordingId: recording.id,
      filePath: segmentFilePath,
      startTime: new Date()
    };
    
    // Set up FFmpeg process
    const ffmpegArgs = [
      '-f', 'image2pipe', // Input format
      '-framerate', config.recording.frameRate.toString(), // Input frame rate
      '-i', '-', // Read from stdin
      '-c:v', config.recording.codec, // Video codec
      '-r', config.recording.frameRate.toString(), // Output frame rate
      '-preset', 'ultrafast', // Encoding preset
      '-tune', 'zerolatency', // Tuning for low latency
      '-f', config.recording.format, // Output format
      segmentFilePath // Output file
    ];
    
    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    // Handle FFmpeg output
    ffmpegProcess.stdout.on('data', (data) => {
      logger.debug(`FFmpeg stdout: ${data}`);
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      logger.debug(`FFmpeg stderr: ${data}`);
    });
    
    // Handle FFmpeg process exit
    ffmpegProcess.on('close', (code) => {
      logger.info(`FFmpeg process exited with code ${code} for segment ${segmentId}`);
      
      if (code !== 0) {
        logger.error(`FFmpeg process error for segment ${segmentId}`);
      }
    });
    
    // Store FFmpeg process in recording
    recording.ffmpegProcess = ffmpegProcess;
    
    // Store segment info
    recording.currentSegment = segmentInfo;
    recording.segments.push(segmentInfo);
    activeSegments.set(segmentId, segmentInfo);
    
    // Publish segment started event
    await publishRecordingEvent(recording.cameraId, recording.id, 'segment', {
      segmentId,
      startTime: segmentInfo.startTime.toISOString(),
      filePath: segmentFilePath
    });
    
    // Notify metadata service
    try {
      await axios.post(`${config.metadataService.url}/api/segments`, {
        id: segmentId,
        recordingId: recording.id,
        streamId: recording.streamId,
        filePath: segmentFilePath,
        startTime: segmentInfo.startTime
      });
    } catch (error) {
      logger.error(`Failed to notify metadata service for segment ${segmentId}:`, error);
    }
    
    logger.info(`Started new segment ${segmentId} for recording ${recording.id}`);
    
    return segmentInfo;
  } catch (error) {
    logger.error(`Failed to start new segment for recording ${recording.id}:`, error);
    throw error;
  }
};

/**
 * Finish a recording segment
 */
const finishSegment = async (recording: RecordingProcess): Promise<void> => {
  try {
    if (!recording.currentSegment) {
      logger.warn(`No current segment to finish for recording ${recording.id}`);
      return;
    }
    
    const segment = recording.currentSegment;
    
    // Close FFmpeg process stdin to finish writing
    if (recording.ffmpegProcess && recording.ffmpegProcess.stdin) {
      recording.ffmpegProcess.stdin.end();
    }
    
    // Wait for FFmpeg process to exit
    if (recording.ffmpegProcess) {
      await new Promise<void>((resolve) => {
        recording.ffmpegProcess.on('close', () => {
          resolve();
        });
      });
    }
    
    // Update segment info
    segment.endTime = new Date();
    segment.duration = (segment.endTime.getTime() - segment.startTime.getTime()) / 1000;
    
    // Get file size
    if (fs.existsSync(segment.filePath)) {
      const stats = fs.statSync(segment.filePath);
      segment.fileSize = stats.size;
      
      // Generate thumbnail
      segment.thumbnailPath = await generateThumbnail(segment);
    }
    
    // Clear current segment
    recording.currentSegment = null;
    recording.ffmpegProcess = null;
    
    // Publish segment finished event
    await publishRecordingEvent(recording.cameraId, recording.id, 'segment', {
      segmentId: segment.id,
      startTime: segment.startTime.toISOString(),
      endTime: segment.endTime.toISOString(),
      duration: segment.duration,
      fileSize: segment.fileSize,
      filePath: segment.filePath,
      thumbnailPath: segment.thumbnailPath
    });
    
    // Update segment in metadata service
    try {
      await axios.put(`${config.metadataService.url}/api/segments/${segment.id}`, {
        endTime: segment.endTime,
        duration: segment.duration,
        fileSize: segment.fileSize,
        thumbnailPath: segment.thumbnailPath
      });
    } catch (error) {
      logger.error(`Failed to update metadata service for segment ${segment.id}:`, error);
    }
    
    logger.info(`Finished segment ${segment.id} for recording ${recording.id}`);
    
    // Check storage usage and clean up if needed
    const storageInfo = await getStorageInfo(config.recording.path);
    if (storageInfo.usagePercent > config.storage.maxUsagePercent) {
      logger.warn(`Storage usage (${storageInfo.usagePercent}%) exceeds threshold (${config.storage.maxUsagePercent}%), cleaning up old recordings`);
      await cleanupOldRecordings();
    }
  } catch (error) {
    logger.error(`Failed to finish segment for recording ${recording.id}:`, error);
  }
};

/**
 * Generate a thumbnail for a segment
 */
const generateThumbnail = async (segment: SegmentInfo): Promise<string | undefined> => {
  try {
    // Create thumbnail file path
    const thumbnailFileName = `${path.basename(segment.filePath, path.extname(segment.filePath))}_thumb.jpg`;
    const thumbnailPath = path.join(
      config.recording.path,
      'thumbnails',
      thumbnailFileName
    );
    
    // Use FFmpeg to extract a frame from the middle of the segment
    const ffmpegArgs = [
      '-i', segment.filePath, // Input file
      '-ss', '00:00:05', // Seek to 5 seconds (or middle if shorter)
      '-vframes', '1', // Extract one frame
      '-q:v', '2', // Quality level (lower is better)
      thumbnailPath // Output file
    ];
    
    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    // Wait for FFmpeg process to exit
    await new Promise<void>((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
    
    // Check if thumbnail was created
    if (fs.existsSync(thumbnailPath)) {
      logger.info(`Generated thumbnail for segment ${segment.id}: ${thumbnailPath}`);
      return thumbnailPath;
    }
    
    return undefined;
  } catch (error) {
    logger.error(`Failed to generate thumbnail for segment ${segment.id}:`, error);
    return undefined;
  }
};

/**
 * Stop a recording
 */
export const stopRecording = async (
  cameraId: string,
  streamId: string
): Promise<boolean> => {
  try {
    // Get recording
    const recordingKey = `${cameraId}:${streamId}`;
    const recording = activeRecordings.get(recordingKey);
    
    if (!recording) {
      logger.warn(`No active recording found for camera ${cameraId}, stream ${streamId}`);
      return false;
    }
    
    // Finish current segment if exists
    if (recording.currentSegment) {
      await finishSegment(recording);
    }
    
    // Update recording status
    recording.isActive = false;
    
    // Remove from active recordings
    activeRecordings.delete(recordingKey);
    
    // Calculate total duration and size
    const endTime = new Date();
    const totalDuration = (endTime.getTime() - recording.startTime.getTime()) / 1000;
    const totalSize = recording.segments.reduce((sum, segment) => sum + (segment.fileSize || 0), 0);
    
    // Publish recording stopped event
    await publishRecordingEvent(cameraId, recording.id, 'stopped', {
      startTime: recording.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: totalDuration,
      segmentCount: recording.segments.length,
      totalSize
    });
    
    // Update recording in metadata service
    try {
      await axios.put(`${config.metadataService.url}/api/recordings/${recording.id}`, {
        endTime,
        duration: totalDuration,
        status: 'completed'
      });
    } catch (error) {
      logger.error(`Failed to update metadata service for recording ${recording.id}:`, error);
    }
    
    logger.info(`Stopped recording ${recording.id} for camera ${cameraId}, stream ${streamId}`);
    
    return true;
  } catch (error) {
    logger.error(`Failed to stop recording for camera ${cameraId}, stream ${streamId}:`, error);
    return false;
  }
};

/**
 * Get all active recordings
 */
export const getActiveRecordings = (): RecordingProcess[] => {
  return Array.from(activeRecordings.values());
};

/**
 * Get a specific recording by ID
 */
export const getRecordingById = (recordingId: string): RecordingProcess | undefined => {
  return Array.from(activeRecordings.values())
    .find(recording => recording.id === recordingId);
};

/**
 * Get all recordings for a camera
 */
export const getRecordingsByCamera = (cameraId: string): RecordingProcess[] => {
  return Array.from(activeRecordings.values())
    .filter(recording => recording.cameraId === cameraId);
};

/**
 * Stop all recordings
 */
export const stopAllRecordings = async (): Promise<void> => {
  const recordingKeys = Array.from(activeRecordings.keys());
  
  for (const key of recordingKeys) {
    const [cameraId, streamId] = key.split(':');
    await stopRecording(cameraId, streamId);
  }
  
  logger.info(`Stopped all ${recordingKeys.length} recordings`);
};