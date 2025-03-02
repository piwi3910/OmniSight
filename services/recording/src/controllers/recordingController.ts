import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { 
  startRecording, 
  stopRecording, 
  getActiveRecordings, 
  getRecordingById,
  getRecordingsByCamera
} from '../utils/recordingManager';
import { getStorageInfo, getAllRecordings } from '../utils/storageManager';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Start a new recording
 * 
 * @route POST /api/recordings/start
 */
export const createRecording = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cameraId, streamId, name } = req.body;
    
    // Validate required fields
    if (!cameraId || !streamId) {
      res.status(400).json({ error: 'Missing required fields: cameraId, streamId' });
      return;
    }
    
    // Start recording
    const recording = await startRecording(
      cameraId,
      streamId,
      name || `Camera ${cameraId}`
    );
    
    if (!recording) {
      res.status(500).json({ error: 'Failed to start recording' });
      return;
    }
    
    // Return recording info
    res.status(201).json({
      id: recording.id,
      cameraId: recording.cameraId,
      streamId: recording.streamId,
      startTime: recording.startTime,
      isActive: recording.isActive
    });
  } catch (error) {
    logger.error('Error creating recording:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Stop a recording
 * 
 * @route POST /api/recordings/:id/stop
 */
export const stopRecordingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Get recording
    const recording = getRecordingById(id);
    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }
    
    // Stop recording
    const result = await stopRecording(recording.cameraId, recording.streamId);
    
    if (!result) {
      res.status(500).json({ error: 'Failed to stop recording' });
      return;
    }
    
    res.status(200).json({
      id,
      message: 'Recording stopped successfully'
    });
  } catch (error) {
    logger.error(`Error stopping recording ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all active recordings
 * 
 * @route GET /api/recordings/active
 */
export const getAllActiveRecordings = (req: Request, res: Response): void => {
  try {
    const recordings = getActiveRecordings();
    
    // Format response
    const formattedRecordings = recordings.map(recording => ({
      id: recording.id,
      cameraId: recording.cameraId,
      streamId: recording.streamId,
      startTime: recording.startTime,
      segmentCount: recording.segments.length,
      isActive: recording.isActive
    }));
    
    res.status(200).json({
      count: formattedRecordings.length,
      recordings: formattedRecordings
    });
  } catch (error) {
    logger.error('Error getting active recordings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a specific recording by ID
 * 
 * @route GET /api/recordings/:id
 */
export const getRecording = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    // Get recording
    const recording = getRecordingById(id);
    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }
    
    // Format response
    const formattedRecording = {
      id: recording.id,
      cameraId: recording.cameraId,
      streamId: recording.streamId,
      startTime: recording.startTime,
      segments: recording.segments.map(segment => ({
        id: segment.id,
        filePath: segment.filePath,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        fileSize: segment.fileSize,
        thumbnailPath: segment.thumbnailPath
      })),
      isActive: recording.isActive,
      error: recording.error ? recording.error.message : undefined
    };
    
    res.status(200).json(formattedRecording);
  } catch (error) {
    logger.error(`Error getting recording ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all recordings for a camera
 * 
 * @route GET /api/cameras/:cameraId/recordings
 */
export const getRecordingsForCamera = (req: Request, res: Response): void => {
  try {
    const { cameraId } = req.params;
    
    // Get recordings
    const recordings = getRecordingsByCamera(cameraId);
    
    // Format response
    const formattedRecordings = recordings.map(recording => ({
      id: recording.id,
      cameraId: recording.cameraId,
      streamId: recording.streamId,
      startTime: recording.startTime,
      segmentCount: recording.segments.length,
      isActive: recording.isActive
    }));
    
    res.status(200).json({
      cameraId,
      count: formattedRecordings.length,
      recordings: formattedRecordings
    });
  } catch (error) {
    logger.error(`Error getting recordings for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get storage information
 * 
 * @route GET /api/recordings/storage
 */
export const getStorage = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get storage info
    const storageInfo = await getStorageInfo(config.recording.path);
    
    // Get all recordings
    const recordings = await getAllRecordings();
    
    // Calculate total size
    const totalSize = recordings.reduce((sum, recording) => sum + recording.size, 0);
    
    // Format response
    const response = {
      storage: {
        total: storageInfo.total,
        used: storageInfo.used,
        free: storageInfo.free,
        usagePercent: storageInfo.usagePercent
      },
      recordings: {
        count: recordings.length,
        totalSize,
        path: config.recording.path
      },
      retention: {
        days: config.storage.retentionDays,
        maxUsagePercent: config.storage.maxUsagePercent
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error getting storage info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a segment file
 * 
 * @route GET /api/segments/:id/file
 */
export const getSegmentFile = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { cameraId, recordingId } = req.query;
    
    // Validate required query parameters
    if (!cameraId || !recordingId) {
      res.status(400).json({ error: 'Missing required query parameters: cameraId, recordingId' });
      return;
    }
    
    // Construct file path
    const segmentDir = path.join(
      config.recording.path,
      cameraId as string,
      recordingId as string
    );
    
    // Find segment file
    const files = fs.readdirSync(segmentDir);
    const segmentFile = files.find(file => file.includes(id) && file.endsWith(`.${config.recording.format}`));
    
    if (!segmentFile) {
      res.status(404).json({ error: 'Segment file not found' });
      return;
    }
    
    const filePath = path.join(segmentDir, segmentFile);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Segment file not found' });
      return;
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set headers
    res.setHeader('Content-Type', `video/${config.recording.format}`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${segmentFile}"`);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error(`Error getting segment file ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a thumbnail file
 * 
 * @route GET /api/segments/:id/thumbnail
 */
export const getThumbnailFile = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    // Construct file path
    const thumbnailDir = path.join(config.recording.path, 'thumbnails');
    
    // Find thumbnail file
    const files = fs.readdirSync(thumbnailDir);
    const thumbnailFile = files.find(file => file.includes(id) && file.endsWith('.jpg'));
    
    if (!thumbnailFile) {
      res.status(404).json({ error: 'Thumbnail file not found' });
      return;
    }
    
    const filePath = path.join(thumbnailDir, thumbnailFile);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Thumbnail file not found' });
      return;
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', stats.size);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error(`Error getting thumbnail file ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};