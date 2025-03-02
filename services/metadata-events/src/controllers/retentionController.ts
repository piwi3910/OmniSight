import { Request, Response } from 'express';
import { retentionService } from '../services/retentionService';
import logger from '../utils/logger';

/**
 * Run a manual retention cleanup
 */
export const runRetentionCleanup = async (req: Request, res: Response) => {
  try {
    await retentionService.runCleanup();
    
    return res.status(200).json({
      success: true,
      message: 'Retention cleanup triggered successfully'
    });
  } catch (error) {
    logger.error('Error in runRetentionCleanup controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to run retention cleanup',
      error: (error as Error).message
    });
  }
};

/**
 * Get current retention configuration
 */
export const getRetentionConfig = async (req: Request, res: Response) => {
  try {
    const config = retentionService.getConfig();
    
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error in getRetentionConfig controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get retention configuration',
      error: (error as Error).message
    });
  }
};

/**
 * Update retention configuration
 */
export const updateRetentionConfig = async (req: Request, res: Response) => {
  try {
    const newConfig = req.body;
    
    // Validate config
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration format'
      });
    }
    
    // Update config
    retentionService.updateConfig(newConfig);
    
    return res.status(200).json({
      success: true,
      message: 'Retention configuration updated successfully',
      data: retentionService.getConfig()
    });
  } catch (error) {
    logger.error('Error in updateRetentionConfig controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update retention configuration',
      error: (error as Error).message
    });
  }
};

/**
 * Stop the retention service
 */
export const stopRetentionService = async (req: Request, res: Response) => {
  try {
    retentionService.stop();
    
    return res.status(200).json({
      success: true,
      message: 'Retention service stopped successfully'
    });
  } catch (error) {
    logger.error('Error in stopRetentionService controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to stop retention service',
      error: (error as Error).message
    });
  }
};

/**
 * Start the retention service
 */
export const startRetentionService = async (req: Request, res: Response) => {
  try {
    retentionService.start();
    
    return res.status(200).json({
      success: true,
      message: 'Retention service started successfully'
    });
  } catch (error) {
    logger.error('Error in startRetentionService controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start retention service',
      error: (error as Error).message
    });
  }
};