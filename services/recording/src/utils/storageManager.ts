import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import config from '../config/config';
import logger from './logger';

// Promisify exec
const execAsync = promisify(exec);

// Interface for storage info
interface StorageInfo {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

// Interface for recording info
interface RecordingInfo {
  id: string;
  cameraId: string;
  path: string;
  size: number;
  createdAt: Date;
  lastModified: Date;
}

/**
 * Get storage information for a path
 */
export const getStorageInfo = async (dirPath: string): Promise<StorageInfo> => {
  try {
    // Use df command to get disk usage
    const { stdout } = await execAsync(`df -k "${dirPath}" | tail -n 1`);
    
    // Parse output
    const parts = stdout.trim().split(/\s+/);
    
    // Extract values (in KB)
    const total = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const free = parseInt(parts[3], 10) * 1024;
    const usagePercent = parseInt(parts[4].replace('%', ''), 10);
    
    return { total, used, free, usagePercent };
  } catch (error) {
    logger.error(`Failed to get storage info for ${dirPath}:`, error);
    
    // Return default values
    return {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0
    };
  }
};

/**
 * Get size of a directory recursively
 */
export const getDirSize = async (dirPath: string): Promise<number> => {
  try {
    // Use du command to get directory size
    const { stdout } = await execAsync(`du -sb "${dirPath}" | cut -f1`);
    
    // Parse output
    return parseInt(stdout.trim(), 10);
  } catch (error) {
    logger.error(`Failed to get directory size for ${dirPath}:`, error);
    return 0;
  }
};

/**
 * Get all recordings with their info
 */
export const getAllRecordings = async (): Promise<RecordingInfo[]> => {
  try {
    const recordingsPath = config.recording.path;
    const recordings: RecordingInfo[] = [];
    
    // Get all camera directories
    const cameraDirs = fs.readdirSync(recordingsPath)
      .filter(item => {
        const itemPath = path.join(recordingsPath, item);
        return fs.statSync(itemPath).isDirectory() && item !== 'thumbnails';
      });
    
    // Process each camera directory
    for (const cameraDir of cameraDirs) {
      const cameraDirPath = path.join(recordingsPath, cameraDir);
      
      // Get all recording directories
      const recordingDirs = fs.readdirSync(cameraDirPath)
        .filter(item => {
          const itemPath = path.join(cameraDirPath, item);
          return fs.statSync(itemPath).isDirectory();
        });
      
      // Process each recording directory
      for (const recordingDir of recordingDirs) {
        const recordingDirPath = path.join(cameraDirPath, recordingDir);
        const stats = fs.statSync(recordingDirPath);
        
        // Get directory size
        const size = await getDirSize(recordingDirPath);
        
        // Add recording info
        recordings.push({
          id: recordingDir,
          cameraId: cameraDir,
          path: recordingDirPath,
          size,
          createdAt: stats.birthtime,
          lastModified: stats.mtime
        });
      }
    }
    
    return recordings;
  } catch (error) {
    logger.error('Failed to get all recordings:', error);
    return [];
  }
};

/**
 * Clean up old recordings based on retention policy
 */
export const cleanupOldRecordings = async (): Promise<void> => {
  try {
    // Get all recordings
    const recordings = await getAllRecordings();
    
    // Sort recordings by creation date (oldest first)
    recordings.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Get current storage info
    const storageInfo = await getStorageInfo(config.recording.path);
    
    // Calculate how much space we need to free up
    const targetUsage = config.storage.maxUsagePercent - 10; // Aim for 10% below max
    const bytesToFree = storageInfo.used - (storageInfo.total * targetUsage / 100);
    
    if (bytesToFree <= 0) {
      logger.info('No need to free up space');
      return;
    }
    
    logger.info(`Need to free up ${formatBytes(bytesToFree)} to reach ${targetUsage}% usage`);
    
    // Keep track of freed space
    let freedSpace = 0;
    
    // Process recordings until we've freed enough space or reached retention limit
    for (const recording of recordings) {
      // Skip recordings that are newer than retention days
      const ageInDays = (Date.now() - recording.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays < config.storage.retentionDays) {
        logger.debug(`Skipping recording ${recording.id} (age: ${ageInDays.toFixed(1)} days)`);
        continue;
      }
      
      // Delete recording
      await deleteRecording(recording);
      
      // Update freed space
      freedSpace += recording.size;
      
      logger.info(`Deleted recording ${recording.id}, freed ${formatBytes(recording.size)}`);
      
      // Check if we've freed enough space
      if (freedSpace >= bytesToFree) {
        logger.info(`Freed ${formatBytes(freedSpace)}, target was ${formatBytes(bytesToFree)}`);
        break;
      }
    }
    
    logger.info(`Cleanup completed, freed ${formatBytes(freedSpace)}`);
  } catch (error) {
    logger.error('Failed to clean up old recordings:', error);
  }
};

/**
 * Delete a recording and update metadata service
 */
const deleteRecording = async (recording: RecordingInfo): Promise<void> => {
  try {
    // Delete recording directory
    fs.rmdirSync(recording.path, { recursive: true });
    
    // Update metadata service
    try {
      await axios.delete(`${config.metadataService.url}/api/recordings/${recording.id}`);
    } catch (error) {
      logger.error(`Failed to update metadata service for deleted recording ${recording.id}:`, error);
    }
  } catch (error) {
    logger.error(`Failed to delete recording ${recording.id}:`, error);
    throw error;
  }
};

/**
 * Format bytes to human-readable string
 */
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};