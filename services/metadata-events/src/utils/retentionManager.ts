import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import logger from './logger';
import models from '../models';

// Get model instances
const { Event, Recording, Segment, DetectedObject } = models;

// Promisify fs functions
const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

// Default retention periods (in days)
const DEFAULT_EVENT_RETENTION_DAYS = 30;
const DEFAULT_RECORDING_RETENTION_DAYS = 30;
const DEFAULT_STORAGE_LIMIT_GB = 500; // 500GB

/**
 * Initialize retention manager
 */
export const initRetentionManager = (): void => {
  // Schedule retention tasks
  scheduleRetentionTasks();
  
  logger.info('Retention manager initialized');
};

/**
 * Schedule retention tasks
 */
const scheduleRetentionTasks = (): void => {
  // Run retention tasks immediately on startup
  runRetentionTasks();
  
  // Schedule to run daily at 2 AM
  const now = new Date();
  const nextRun = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    2, 0, 0
  );
  
  const timeUntilNextRun = nextRun.getTime() - now.getTime();
  
  setTimeout(() => {
    runRetentionTasks();
    
    // Schedule to run daily
    setInterval(runRetentionTasks, 24 * 60 * 60 * 1000);
  }, timeUntilNextRun);
  
  logger.info(`Scheduled retention tasks to run daily at 2 AM (next run in ${Math.round(timeUntilNextRun / (60 * 60 * 1000))} hours)`);
};

/**
 * Run all retention tasks
 */
const runRetentionTasks = async (): Promise<void> => {
  try {
    logger.info('Running retention tasks');
    
    // Get retention settings from environment variables
    const eventRetentionDays = parseInt(process.env.EVENT_RETENTION_DAYS || DEFAULT_EVENT_RETENTION_DAYS.toString(), 10);
    const recordingRetentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || DEFAULT_RECORDING_RETENTION_DAYS.toString(), 10);
    const storageLimitGB = parseInt(process.env.STORAGE_LIMIT_GB || DEFAULT_STORAGE_LIMIT_GB.toString(), 10);
    
    // Run tasks in parallel
    await Promise.all([
      cleanupOldEvents(eventRetentionDays),
      cleanupOldRecordings(recordingRetentionDays),
      enforceStorageLimit(storageLimitGB)
    ]);
    
    logger.info('Retention tasks completed');
  } catch (error) {
    logger.error('Error running retention tasks:', error);
  }
};

/**
 * Clean up old events
 */
const cleanupOldEvents = async (retentionDays: number): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Find old events
    const oldEvents = await Event.findAll({
      where: {
        timestamp: {
          [Op.lt]: cutoffDate
        }
      }
    });
    
    if (oldEvents.length === 0) {
      logger.info(`No events older than ${retentionDays} days found`);
      return;
    }
    
    // Get IDs of old events
    const eventIds = oldEvents.map((event: any) => event.id);
    
    // Delete detected objects associated with old events
    await DetectedObject.destroy({
      where: {
        eventId: {
          [Op.in]: eventIds
        }
      }
    });
    
    // Delete old events
    await Event.destroy({
      where: {
        id: {
          [Op.in]: eventIds
        }
      }
    });
    
    logger.info(`Deleted ${oldEvents.length} events older than ${retentionDays} days`);
  } catch (error) {
    logger.error('Error cleaning up old events:', error);
  }
};

/**
 * Clean up old recordings
 */
const cleanupOldRecordings = async (retentionDays: number): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Find old recordings
    const oldRecordings = await Recording.findAll({
      where: {
        startTime: {
          [Op.lt]: cutoffDate
        }
      },
      include: [{
        model: Segment,
        as: 'segments'
      }]
    });
    
    if (oldRecordings.length === 0) {
      logger.info(`No recordings older than ${retentionDays} days found`);
      return;
    }
    
    // Process each recording
    for (const recording of oldRecordings) {
      // Get segments for this recording
      const segments = await Segment.findAll({
        where: {
          recordingId: recording.id
        }
      });
      
      // Delete recording files
      for (const segment of segments) {
        // Delete segment file
        if (segment.filePath && fs.existsSync(segment.filePath)) {
          await unlinkAsync(segment.filePath);
        }
        
        // Delete thumbnail
        if (segment.thumbnailPath && fs.existsSync(segment.thumbnailPath)) {
          await unlinkAsync(segment.thumbnailPath);
        }
      }
      
      // Delete segments from database
      await Segment.destroy({
        where: {
          recordingId: recording.id
        }
      });
      
      // Delete recording from database
      await recording.destroy();
    }
    
    logger.info(`Deleted ${oldRecordings.length} recordings older than ${retentionDays} days`);
  } catch (error) {
    logger.error('Error cleaning up old recordings:', error);
  }
};

/**
 * Enforce storage limit by deleting oldest recordings
 */
const enforceStorageLimit = async (limitGB: number): Promise<void> => {
  try {
    // Get recordings directory
    const recordingsDir = process.env.RECORDINGS_PATH || path.join(process.cwd(), 'recordings');
    
    // Check if directory exists
    if (!fs.existsSync(recordingsDir)) {
      logger.info(`Recordings directory ${recordingsDir} does not exist, skipping storage limit enforcement`);
      return;
    }
    
    // Calculate current storage usage
    const usage = await calculateDirectorySize(recordingsDir);
    const usageGB = usage / (1024 * 1024 * 1024);
    
    if (usageGB <= limitGB) {
      logger.info(`Storage usage (${usageGB.toFixed(2)} GB) is below limit (${limitGB} GB)`);
      return;
    }
    
    // Calculate how much space to free
    const excessGB = usageGB - limitGB;
    const excessBytes = excessGB * 1024 * 1024 * 1024;
    
    logger.info(`Storage usage (${usageGB.toFixed(2)} GB) exceeds limit (${limitGB} GB), need to free ${excessGB.toFixed(2)} GB`);
    
    // Get recordings ordered by start time (oldest first)
    const recordings = await Recording.findAll({
      order: [['startTime', 'ASC']],
      include: [{
        model: Segment,
        as: 'segments'
      }]
    });
    
    // Delete recordings until we've freed enough space
    let freedBytes = 0;
    let deletedCount = 0;
    
    for (const recording of recordings) {
      // Skip if we've freed enough space
      if (freedBytes >= excessBytes) {
        break;
      }
      
      // Get segments for this recording
      const segments = await Segment.findAll({
        where: {
          recordingId: recording.id
        }
      });
      
      // Calculate recording size
      let recordingSize = 0;
      
      for (const segment of segments) {
        // Add segment file size
        if (segment.fileSize) {
          recordingSize += segment.fileSize;
        }
        
        // Delete segment file
        if (segment.filePath && fs.existsSync(segment.filePath)) {
          await unlinkAsync(segment.filePath);
        }
        
        // Delete thumbnail
        if (segment.thumbnailPath && fs.existsSync(segment.thumbnailPath)) {
          await unlinkAsync(segment.thumbnailPath);
        }
      }
      
      // Delete segments from database
      await Segment.destroy({
        where: {
          recordingId: recording.id
        }
      });
      
      // Delete recording from database
      await recording.destroy();
      
      // Update counters
      freedBytes += recordingSize;
      deletedCount++;
    }
    
    const freedGB = freedBytes / (1024 * 1024 * 1024);
    logger.info(`Deleted ${deletedCount} recordings to free ${freedGB.toFixed(2)} GB of storage`);
  } catch (error) {
    logger.error('Error enforcing storage limit:', error);
  }
};

/**
 * Calculate directory size recursively
 */
const calculateDirectorySize = async (dirPath: string): Promise<number> => {
  let size = 0;
  
  // Get directory contents
  const items = await readdirAsync(dirPath);
  
  // Process each item
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = await statAsync(itemPath);
    
    if (stats.isDirectory()) {
      // Recursively calculate subdirectory size
      size += await calculateDirectorySize(itemPath);
    } else {
      // Add file size
      size += stats.size;
    }
  }
  
  return size;
};

/**
 * Manually trigger retention tasks
 */
export const triggerRetentionTasks = async (): Promise<void> => {
  await runRetentionTasks();
};