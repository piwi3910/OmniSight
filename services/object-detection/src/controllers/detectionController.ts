import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import config from '../config/config';
import logger from '../utils/logger';
import { processVideoFrame, cleanup } from '../utils/detectionManager';

/**
 * Get detection service status
 * 
 * @route GET /api/detection/status
 */
export const getStatus = (req: Request, res: Response): void => {
  try {
    // Return service status
    res.status(200).json({
      status: 'ok',
      service: 'object-detection',
      version: '1.0.0',
      config: {
        modelType: config.tensorflow.modelType,
        useGPU: config.tensorflow.useGPU,
        workerThreads: config.tensorflow.workerThreads,
        minConfidence: config.detection.minConfidence,
        detectionInterval: config.detection.detectionInterval,
        classes: config.detection.classes
      }
    });
  } catch (error) {
    logger.error('Error getting status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Process an image for object detection
 * 
 * @route POST /api/detection/detect
 */
export const detectObjects = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if image is provided
    if (!req.file) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }
    
    // Get image buffer
    const imageBuffer = req.file.buffer;
    
    // Get camera ID and stream ID from request body or use defaults
    const cameraId = req.body.cameraId || 'api-request';
    const streamId = req.body.streamId || 'manual-detection';
    
    // Process image
    await processVideoFrame(cameraId, streamId, imageBuffer, new Date());
    
    // Return success
    res.status(200).json({
      message: 'Image processed successfully',
      cameraId,
      streamId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error detecting objects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get recent detections for a camera
 * 
 * @route GET /api/detection/cameras/:cameraId/detections
 */
export const getCameraDetections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cameraId } = req.params;
    const { limit = 10 } = req.query;
    
    // Get detections from metadata service
    const response = await axios.get(
      `${config.metadataService.url}/api/cameras/${cameraId}/events`,
      {
        params: {
          limit,
          sort: 'desc'
        },
        timeout: 5000
      }
    );
    
    // Return detections
    res.status(200).json(response.data);
  } catch (error) {
    logger.error(`Error getting detections for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get detection configuration
 * 
 * @route GET /api/detection/config
 */
export const getConfig = (req: Request, res: Response): void => {
  try {
    // Return detection configuration
    res.status(200).json({
      tensorflow: {
        modelType: config.tensorflow.modelType,
        useGPU: config.tensorflow.useGPU,
        workerThreads: config.tensorflow.workerThreads
      },
      detection: {
        minConfidence: config.detection.minConfidence,
        detectionInterval: config.detection.detectionInterval,
        classes: config.detection.classes,
        motionSensitivity: config.detection.motionSensitivity,
        regionOfInterest: config.detection.regionOfInterest
      }
    });
  } catch (error) {
    logger.error('Error getting configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update detection configuration
 * 
 * @route PUT /api/detection/config
 */
export const updateConfig = (req: Request, res: Response): void => {
  try {
    const { detection } = req.body;
    
    // Validate request body
    if (!detection) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }
    
    // Update detection configuration
    if (detection.minConfidence !== undefined) {
      config.detection.minConfidence = parseFloat(detection.minConfidence);
    }
    
    if (detection.detectionInterval !== undefined) {
      config.detection.detectionInterval = parseInt(detection.detectionInterval, 10);
    }
    
    if (detection.classes !== undefined && Array.isArray(detection.classes)) {
      config.detection.classes = detection.classes;
    }
    
    if (detection.motionSensitivity !== undefined) {
      config.detection.motionSensitivity = parseInt(detection.motionSensitivity, 10);
    }
    
    if (detection.regionOfInterest !== undefined) {
      config.detection.regionOfInterest = detection.regionOfInterest;
    }
    
    // Return updated configuration
    res.status(200).json({
      message: 'Configuration updated successfully',
      detection: config.detection
    });
  } catch (error) {
    logger.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Restart detection service
 * 
 * @route POST /api/detection/restart
 */
export const restartService = async (req: Request, res: Response): Promise<void> => {
  try {
    // Clean up resources
    await cleanup();
    
    // Return success
    res.status(200).json({
      message: 'Detection service restarting',
      timestamp: new Date().toISOString()
    });
    
    // Exit process to trigger restart by container orchestration
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    logger.error('Error restarting service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};