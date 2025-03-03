import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';
import logger from '../utils/logger';
import * as detectionManager from '../utils/detectionManager';

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Get detection statistics
 */
export const getDetectionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = detectionManager.getDetectionStats();
    
    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting detection stats:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get detection statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Process an image for detection
 */
export const processImage = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if request has an image
    if (!req.file) {
      res.status(400).json({
        status: 'error',
        message: 'No image provided'
      });
      return;
    }
    
    const { cameraId } = req.body;
    
    if (!cameraId) {
      res.status(400).json({
        status: 'error',
        message: 'Camera ID is required'
      });
      return;
    }
    
    // Get image data
    const imagePath = req.file.path;
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Create a unique ID for this detection task
    const detectionId = uuidv4();
    
    // Enqueue detection task
    await detectionManager.enqueueDetectionTask({
      streamId: `manual-${detectionId}`,
      cameraId,
      timestamp: new Date().toISOString(),
      data: base64Image
    });
    
    // Clean up temporary file
    fs.unlinkSync(imagePath);
    
    res.status(202).json({
      status: 'success',
      message: 'Image queued for detection',
      detectionId
    });
  } catch (error) {
    logger.error('Error processing image for detection:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to process image',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get recent detections for a camera
 */
export const getRecentDetections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cameraId } = req.params;
    const { limit = '10', offset = '0' } = req.query;
    
    // Convert to numbers
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    
    // Get recent events with detections
    const events = await prisma.event.findMany({
      where: {
        cameraId,
        type: 'OBJECT_DETECTED'
      },
      include: {
        detectedObjects: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limitNum,
      skip: offsetNum
    });
    
    // Get total count
    const totalCount = await prisma.event.count({
      where: {
        cameraId,
        type: 'OBJECT_DETECTED'
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        events,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum
        }
      }
    });
  } catch (error) {
    logger.error('Error getting recent detections:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recent detections',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get detections by object class
 */
export const getDetectionsByClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { objectClass } = req.params;
    const { limit = '10', offset = '0' } = req.query;
    
    // Convert to numbers
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    
    // Get detected objects of the specified class
    const detectedObjects = await prisma.detectedObject.findMany({
      where: {
        label: objectClass
      },
      include: {
        event: true
      },
      orderBy: {
        event: {
          timestamp: 'desc'
        }
      },
      take: limitNum,
      skip: offsetNum
    });
    
    // Get total count
    const totalCount = await prisma.detectedObject.count({
      where: {
        label: objectClass
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        detectedObjects,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum
        }
      }
    });
  } catch (error) {
    logger.error('Error getting detections by class:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get detections by class',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get detections within a time range
 */
export const getDetectionsByTimeRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startTime, endTime } = req.query;
    const { cameraId } = req.params;
    const { limit = '10', offset = '0' } = req.query;
    
    if (!startTime || !endTime) {
      res.status(400).json({
        status: 'error',
        message: 'Start time and end time are required'
      });
      return;
    }
    
    // Convert to numbers
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    
    // Parse dates
    const startDate = new Date(startTime as string);
    const endDate = new Date(endTime as string);
    
    // Build query
    const where: any = {
      type: 'OBJECT_DETECTED',
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    };
    
    // Add camera ID if provided
    if (cameraId !== 'all') {
      where.cameraId = cameraId;
    }
    
    // Get events in time range
    const events = await prisma.event.findMany({
      where,
      include: {
        detectedObjects: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limitNum,
      skip: offsetNum
    });
    
    // Get total count
    const totalCount = await prisma.event.count({
      where
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        events,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum
        }
      }
    });
  } catch (error) {
    logger.error('Error getting detections by time range:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get detections by time range',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Update detection settings
 */
export const updateDetectionSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      minConfidence, 
      detectionInterval, 
      classes,
      motionSensitivity,
      regionOfInterest
    } = req.body;
    
    // Validate inputs
    if (minConfidence !== undefined && (minConfidence < 0 || minConfidence > 1)) {
      res.status(400).json({
        status: 'error',
        message: 'Minimum confidence must be between 0 and 1'
      });
      return;
    }
    
    if (detectionInterval !== undefined && detectionInterval < 100) {
      res.status(400).json({
        status: 'error',
        message: 'Detection interval must be at least 100ms'
      });
      return;
    }
    
    if (motionSensitivity !== undefined && (motionSensitivity < 0 || motionSensitivity > 1)) {
      res.status(400).json({
        status: 'error',
        message: 'Motion sensitivity must be between 0 and 1'
      });
      return;
    }
    
    // Update settings in database
    await prisma.setting.upsert({
      where: { key: 'detection.settings' },
      update: {
        value: JSON.stringify({
          minConfidence: minConfidence !== undefined ? minConfidence : config.detection.minConfidence,
          detectionInterval: detectionInterval !== undefined ? detectionInterval : config.detection.detectionInterval,
          classes: classes !== undefined ? classes : config.detection.classes,
          motionSensitivity: motionSensitivity !== undefined ? motionSensitivity : config.detection.motionSensitivity,
          regionOfInterest: regionOfInterest !== undefined ? regionOfInterest : config.detection.regionOfInterest
        })
      },
      create: {
        key: 'detection.settings',
        value: JSON.stringify({
          minConfidence: minConfidence !== undefined ? minConfidence : config.detection.minConfidence,
          detectionInterval: detectionInterval !== undefined ? detectionInterval : config.detection.detectionInterval,
          classes: classes !== undefined ? classes : config.detection.classes,
          motionSensitivity: motionSensitivity !== undefined ? motionSensitivity : config.detection.motionSensitivity,
          regionOfInterest: regionOfInterest !== undefined ? regionOfInterest : config.detection.regionOfInterest
        })
      }
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Detection settings updated',
      data: {
        minConfidence: minConfidence !== undefined ? minConfidence : config.detection.minConfidence,
        detectionInterval: detectionInterval !== undefined ? detectionInterval : config.detection.detectionInterval,
        classes: classes !== undefined ? classes : config.detection.classes,
        motionSensitivity: motionSensitivity !== undefined ? motionSensitivity : config.detection.motionSensitivity,
        regionOfInterest: regionOfInterest !== undefined ? regionOfInterest : config.detection.regionOfInterest
      }
    });
  } catch (error) {
    logger.error('Error updating detection settings:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to update detection settings',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get detection settings
 */
export const getDetectionSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get settings from database
    const settings = await prisma.setting.findUnique({
      where: { key: 'detection.settings' }
    });
    
    // Use database settings or fall back to config
    let detectionSettings;
    
    if (settings) {
      detectionSettings = JSON.parse(settings.value);
    } else {
      detectionSettings = {
        minConfidence: config.detection.minConfidence,
        detectionInterval: config.detection.detectionInterval,
        classes: config.detection.classes,
        motionSensitivity: config.detection.motionSensitivity,
        regionOfInterest: config.detection.regionOfInterest
      };
    }
    
    res.status(200).json({
      status: 'success',
      data: detectionSettings
    });
  } catch (error) {
    logger.error('Error getting detection settings:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get detection settings',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};