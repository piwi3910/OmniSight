import { Request, Response } from 'express';
import { 
  startStream, 
  stopStream, 
  getActiveStreams, 
  getStream,
  getStreamsByCamera
} from '../utils/streamHandler';
import logger from '../utils/logger';

/**
 * Start a new stream
 * 
 * @route POST /api/streams
 */
export const createStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cameraId, name, url, username, password, frameRate, width, height } = req.body;
    
    // Validate required fields
    if (!cameraId || !name || !url) {
      res.status(400).json({ error: 'Missing required fields: cameraId, name, url' });
      return;
    }
    
    // Start stream
    const stream = await startStream(cameraId, {
      name,
      url,
      username,
      password,
      frameRate,
      width,
      height
    });
    
    if (!stream) {
      res.status(500).json({ error: 'Failed to start stream' });
      return;
    }
    
    // Return stream info
    res.status(201).json({
      id: stream.id,
      cameraId: stream.cameraId,
      name: stream.options.name,
      startTime: stream.startTime,
      isActive: stream.isActive
    });
  } catch (error) {
    logger.error('Error creating stream:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Stop a stream
 * 
 * @route POST /api/streams/:id/stop
 */
export const stopStreamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Get stream
    const stream = getStream(id);
    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }
    
    // Stop stream
    const result = await stopStream(id);
    
    if (!result) {
      res.status(500).json({ error: 'Failed to stop stream' });
      return;
    }
    
    res.status(200).json({
      id,
      message: 'Stream stopped successfully'
    });
  } catch (error) {
    logger.error(`Error stopping stream ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all active streams
 * 
 * @route GET /api/streams
 */
export const getAllStreams = (req: Request, res: Response): void => {
  try {
    const streams = getActiveStreams();
    
    // Format response
    const formattedStreams = streams.map(stream => ({
      id: stream.id,
      cameraId: stream.cameraId,
      name: stream.options.name,
      url: stream.options.url,
      startTime: stream.startTime,
      lastFrameTime: stream.lastFrameTime,
      frameCount: stream.frameCount,
      isActive: stream.isActive
    }));
    
    res.status(200).json({
      count: formattedStreams.length,
      streams: formattedStreams
    });
  } catch (error) {
    logger.error('Error getting streams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a specific stream by ID
 * 
 * @route GET /api/streams/:id
 */
export const getStreamById = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    // Get stream
    const stream = getStream(id);
    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }
    
    // Format response
    const formattedStream = {
      id: stream.id,
      cameraId: stream.cameraId,
      name: stream.options.name,
      url: stream.options.url,
      startTime: stream.startTime,
      lastFrameTime: stream.lastFrameTime,
      frameCount: stream.frameCount,
      isActive: stream.isActive,
      error: stream.error ? stream.error.message : undefined
    };
    
    res.status(200).json(formattedStream);
  } catch (error) {
    logger.error(`Error getting stream ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all streams for a camera
 * 
 * @route GET /api/cameras/:cameraId/streams
 */
export const getStreamsByCameraId = (req: Request, res: Response): void => {
  try {
    const { cameraId } = req.params;
    
    // Get streams
    const streams = getStreamsByCamera(cameraId);
    
    // Format response
    const formattedStreams = streams.map(stream => ({
      id: stream.id,
      cameraId: stream.cameraId,
      name: stream.options.name,
      startTime: stream.startTime,
      lastFrameTime: stream.lastFrameTime,
      frameCount: stream.frameCount,
      isActive: stream.isActive
    }));
    
    res.status(200).json({
      cameraId,
      count: formattedStreams.length,
      streams: formattedStreams
    });
  } catch (error) {
    logger.error(`Error getting streams for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get stream status
 * 
 * @route GET /api/streams/:id/status
 */
export const getStreamStatus = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    // Get stream
    const stream = getStream(id);
    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }
    
    // Calculate duration
    const duration = stream.lastFrameTime 
      ? Math.floor((stream.lastFrameTime.getTime() - stream.startTime.getTime()) / 1000)
      : 0;
    
    // Format response
    const status = {
      id: stream.id,
      cameraId: stream.cameraId,
      isActive: stream.isActive,
      startTime: stream.startTime,
      lastFrameTime: stream.lastFrameTime,
      duration,
      frameCount: stream.frameCount,
      frameRate: stream.frameCount / (duration || 1),
      error: stream.error ? stream.error.message : undefined
    };
    
    res.status(200).json(status);
  } catch (error) {
    logger.error(`Error getting stream status ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};