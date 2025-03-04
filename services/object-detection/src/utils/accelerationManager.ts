/**
 * Hardware Acceleration Manager for Object Detection Service
 * 
 * This module integrates the hardware acceleration framework with the object detection service,
 * providing optimized execution for inference and image processing tasks.
 */

import {
  AccelerationManager,
  AccelerationTaskType,
  AccelerationPlatform
} from '@shared/hardware-acceleration';

// Import providers to ensure they're registered
import '@shared/hardware-acceleration/providers/nvidia';
import '@shared/hardware-acceleration/providers/intel';

import logger from './logger';
import config from '../config/config';

/**
 * Initialize hardware acceleration for the object detection service
 */
export async function initializeAcceleration(): Promise<boolean> {
  logger.info('Initializing hardware acceleration...');
  
  try {
    // Get the acceleration manager singleton
    const accelerationManager = AccelerationManager.getInstance();
    
    // Initialize with all available providers
    const success = await accelerationManager.initialize();
    
    if (success) {
      // Log available capabilities
      const capabilities = await accelerationManager.getAvailableCapabilities();
      
      logger.info('Hardware acceleration initialized successfully');
      logger.info(`Available acceleration platforms: ${Array.from(capabilities.keys()).join(', ')}`);
      
      // Configure acceleration based on service config
      const accelerationConfig = {
        enabled: config.hardware.accelerationEnabled ?? true,
        preferredPlatform: config.hardware.preferredPlatform as AccelerationPlatform,
        perfPowerBalance: config.hardware.perfPowerBalance ?? 0.7, // Favor performance over power efficiency
        taskSpecificPlatforms: {
          [AccelerationTaskType.INFERENCE]: config.hardware.inferencePlatform as AccelerationPlatform,
          [AccelerationTaskType.IMAGE_PROCESSING]: config.hardware.imageProcessingPlatform as AccelerationPlatform
        }
      };
      
      accelerationManager.setConfig(accelerationConfig);
      logger.info(`Hardware acceleration configured: ${JSON.stringify(accelerationConfig)}`);
      
      return true;
    } else {
      logger.warn('No hardware acceleration capabilities found, falling back to CPU-only operation');
      return false;
    }
  } catch (error) {
    logger.error('Failed to initialize hardware acceleration:', error);
    return false;
  }
}

/**
 * Run object detection inference with hardware acceleration
 * 
 * @param modelPath Path to the model file
 * @param imageData Image data as ArrayBuffer
 * @param options Additional inference options
 * @returns Detection results
 */
export async function runAcceleratedInference(
  modelPath: string,
  imageData: ArrayBuffer,
  options: {
    confidence?: number;
    device?: string;
    maxDetections?: number;
  } = {}
): Promise<any> {
  const accelerationManager = AccelerationManager.getInstance();
  
  // Prepare input data for the inference task
  const inputTensors = {
    'input': imageData
  };
  
  try {
    // Execute the inference task
    const result = await accelerationManager.executeTask({
      type: AccelerationTaskType.INFERENCE,
      input: {
        modelPath,
        inputTensors,
        device: options.device || 'GPU',
        confidence: options.confidence || 0.5,
        maxDetections: options.maxDetections || 100
      },
      priority: 10, // High priority for inference tasks
      timeoutMs: 30000 // 30 seconds timeout
    });
    
    if (!result.success) {
      throw new Error(`Inference failed: ${result.error}`);
    }
    
    logger.debug(`Inference completed in ${result.executionTimeMs}ms using ${result.platformUsed}`);
    
    return result.output as any;
  } catch (error) {
    logger.error('Error during accelerated inference:', error);
    throw error;
  }
}

/**
 * Perform accelerated image processing for preprocessing or motion detection
 * 
 * @param imageData Image data as ArrayBuffer
 * @param operation Type of image processing operation
 * @param params Additional parameters for the operation
 * @returns Processed image data
 */
export async function processImageAccelerated(
  imageData: ArrayBuffer,
  operation: 'resize' | 'normalize' | 'motion_detection',
  params: Record<string, any> = {}
): Promise<ArrayBuffer> {
  const accelerationManager = AccelerationManager.getInstance();
  
  // Map operation to acceleration task type
  const taskType = operation === 'motion_detection'
    ? AccelerationTaskType.MOTION_DETECTION
    : AccelerationTaskType.IMAGE_PROCESSING;
  
  try {
    // Execute the image processing task
    const result = await accelerationManager.executeTask({
      type: taskType,
      input: {
        image: imageData,
        operation,
        params
      },
      priority: 8, // Medium-high priority
      timeoutMs: 5000 // 5 seconds timeout
    });
    
    if (!result.success) {
      throw new Error(`Image processing failed: ${result.error}`);
    }
    
    logger.debug(`Image processing (${operation}) completed in ${result.executionTimeMs}ms using ${result.platformUsed}`);
    
    return result.output.processedImage;
  } catch (error) {
    logger.error(`Error during accelerated image processing (${operation}):`, error);
    throw error;
  }
}

/**
 * Get hardware acceleration status and statistics
 * 
 * @returns Object with acceleration status and performance metrics
 */
export async function getAccelerationStatus(): Promise<{
  enabled: boolean;
  initialized: boolean;
  platforms: string[];
  stats: Record<string, any>;
}> {
  try {
    const accelerationManager = AccelerationManager.getInstance();
    const config = accelerationManager.getConfig();
    const allStats = await accelerationManager.getAllStatistics();
    
    // Format statistics for easier consumption
    const stats: Record<string, any> = {};
    for (const [platform, platformStats] of allStats.entries()) {
      stats[platform] = {
        tasks: {
          total: platformStats.totalTasks,
          successful: platformStats.successfulTasks,
          failed: platformStats.failedTasks,
          successRate: platformStats.totalTasks > 0 
            ? (platformStats.successfulTasks / platformStats.totalTasks) * 100 
            : 0
        },
        performance: {
          averageExecutionTimeMs: platformStats.averageExecutionTimeMs,
          deviceUtilization: platformStats.deviceUtilization,
          temperature: platformStats.currentTemperature,
          throttling: platformStats.throttling
        },
        uptime: platformStats.uptime
      };
    }
    
    // Get available platforms
    const capabilities = await accelerationManager.getAvailableCapabilities();
    const platforms = Array.from(capabilities.keys()) as string[];
    
    return {
      enabled: config.enabled,
      initialized: platforms.length > 0,
      platforms,
      stats
    };
  } catch (error) {
    logger.error('Error getting acceleration status:', error);
    return {
      enabled: false,
      initialized: false,
      platforms: [],
      stats: {}
    };
  }
}

/**
 * Shutdown hardware acceleration and release resources
 */
export async function shutdownAcceleration(): Promise<void> {
  try {
    const accelerationManager = AccelerationManager.getInstance();
    await accelerationManager.shutdown();
    logger.info('Hardware acceleration shutdown complete');
  } catch (error) {
    logger.error('Error shutting down hardware acceleration:', error);
  }
}