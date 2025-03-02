import { Request, Response } from 'express';
import { triggerRetentionTasks } from '../utils/retentionManager';
import logger from '../utils/logger';

/**
 * Trigger retention tasks manually
 * 
 * @route POST /api/retention/trigger
 */
export const triggerRetention = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Manual retention task triggered');
    
    // Trigger retention tasks
    await triggerRetentionTasks();
    
    res.status(200).json({ message: 'Retention tasks triggered successfully' });
  } catch (error) {
    logger.error('Error triggering retention tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get retention settings
 * 
 * @route GET /api/retention/settings
 */
export const getRetentionSettings = (req: Request, res: Response): void => {
  try {
    // Get retention settings from environment variables
    const settings = {
      eventRetentionDays: parseInt(process.env.EVENT_RETENTION_DAYS || '30', 10),
      recordingRetentionDays: parseInt(process.env.RECORDING_RETENTION_DAYS || '30', 10),
      storageLimitGB: parseInt(process.env.STORAGE_LIMIT_GB || '500', 10)
    };
    
    res.status(200).json(settings);
  } catch (error) {
    logger.error('Error getting retention settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update retention settings
 * 
 * @route PUT /api/retention/settings
 */
export const updateRetentionSettings = (req: Request, res: Response): void => {
  try {
    const { eventRetentionDays, recordingRetentionDays, storageLimitGB } = req.body;
    
    // Validate settings
    if (eventRetentionDays !== undefined && (isNaN(eventRetentionDays) || eventRetentionDays < 1)) {
      res.status(400).json({ error: 'Event retention days must be a positive number' });
      return;
    }
    
    if (recordingRetentionDays !== undefined && (isNaN(recordingRetentionDays) || recordingRetentionDays < 1)) {
      res.status(400).json({ error: 'Recording retention days must be a positive number' });
      return;
    }
    
    if (storageLimitGB !== undefined && (isNaN(storageLimitGB) || storageLimitGB < 1)) {
      res.status(400).json({ error: 'Storage limit must be a positive number' });
      return;
    }
    
    // Update environment variables
    if (eventRetentionDays !== undefined) {
      process.env.EVENT_RETENTION_DAYS = eventRetentionDays.toString();
    }
    
    if (recordingRetentionDays !== undefined) {
      process.env.RECORDING_RETENTION_DAYS = recordingRetentionDays.toString();
    }
    
    if (storageLimitGB !== undefined) {
      process.env.STORAGE_LIMIT_GB = storageLimitGB.toString();
    }
    
    // Return updated settings
    const updatedSettings = {
      eventRetentionDays: parseInt(process.env.EVENT_RETENTION_DAYS || '30', 10),
      recordingRetentionDays: parseInt(process.env.RECORDING_RETENTION_DAYS || '30', 10),
      storageLimitGB: parseInt(process.env.STORAGE_LIMIT_GB || '500', 10)
    };
    
    logger.info('Retention settings updated:', updatedSettings);
    res.status(200).json(updatedSettings);
  } catch (error) {
    logger.error('Error updating retention settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};