/**
 * Model loader utility for TensorFlow.js models
 * 
 * This module handles loading and management of ML models with hardware acceleration support
 */

import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config/config';
import logger from './logger';
import { 
  AccelerationManager, 
  AccelerationPlatform, 
  AccelerationTaskType 
} from '@shared/hardware-acceleration';

// COCO-SSD classes (must match the ones used by the model)
export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 
  'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign', 
  'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 
  'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 
  'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 
  'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 
  'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 
  'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 
  'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

// Mapping of TensorFlow devices to acceleration platforms
const TF_DEVICE_TO_PLATFORM: { [key: string]: AccelerationPlatform } = {
  'GPU': AccelerationPlatform.NVIDIA_CUDA,
  'CPU': AccelerationPlatform.CPU,
  'TPU': AccelerationPlatform.GOOGLE_TPU
};

// Store loaded models to avoid reloading
let loadedModel: tf.GraphModel | null = null;

// Track model-related statistics
const modelStats = {
  lastLoadTime: 0,
  loadCount: 0,
  inferenceCount: 0,
  averageInferenceTimeMs: 0,
  totalInferenceTimeMs: 0,
  memoryUsageMB: 0,
  deviceMemoryUsageMB: 0,
  lastError: null as Error | null,
  modelLoadErrors: 0
};

/**
 * Initialize TensorFlow backend based on available hardware
 */
export async function initializeTensorFlowBackend(): Promise<string> {
  try {
    // Get hardware acceleration settings
    const settings = await getAccelerationSettings();
    
    // If acceleration is disabled, force CPU
    if (!settings.enabled) {
      logger.info('Hardware acceleration disabled, using CPU backend');
      await tf.setBackend('cpu');
      return 'cpu';
    }
    
    // Get available TensorFlow backends
    const backends = tf.engine().registryFactory;
    logger.info(`Available TensorFlow backends: ${Object.keys(backends).join(', ')}`);
    
    // Determine which backend to use based on settings and availability
    let backendName = 'cpu';
    
    if (settings.inferencePlatform === AccelerationPlatform.NVIDIA_TENSORRT && backends['tensorrt']) {
      backendName = 'tensorrt';
    } else if (settings.inferencePlatform === AccelerationPlatform.NVIDIA_CUDA && backends['cuda']) {
      backendName = 'cuda';
    } else if ([AccelerationPlatform.INTEL_OPENVINO, AccelerationPlatform.INTEL_ONEAPI].includes(
        settings.inferencePlatform as AccelerationPlatform) && backends['wasm']) {
      // OpenVINO often uses WASM backend
      backendName = 'wasm';
    } else if (settings.inferencePlatform === AccelerationPlatform.GOOGLE_TPU && backends['tensorflow']) {
      backendName = 'tensorflow'; // TPU accelerator
    }
    
    // Set the backend
    logger.info(`Setting TensorFlow backend to: ${backendName}`);
    await tf.setBackend(backendName);
    
    // Log device information
    const currentBackend = tf.getBackend();
    logger.info(`TensorFlow using backend: ${currentBackend}`);
    
    // Warm up TensorFlow
    tf.scalar(1).dispose();
    
    return currentBackend;
  } catch (error) {
    logger.error('Error initializing TensorFlow backend:', error);
    // Fall back to CPU
    await tf.setBackend('cpu');
    return 'cpu';
  }
}

/**
 * Load model from file
 */
export async function loadModel(): Promise<tf.GraphModel> {
  // If model is already loaded, return it
  if (loadedModel) {
    return loadedModel;
  }
  
  const modelPath = config.detection.modelPath;
  const startTime = Date.now();
  
  try {
    // Check if model exists
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }
    
    // Set hardware acceleration options
    await initializeTensorFlowBackend();
    
    // Load the model
    logger.info(`Loading model from: ${modelPath}`);
    loadedModel = await tf.loadGraphModel(`file://${modelPath}`);
    
    // Update stats
    modelStats.lastLoadTime = Date.now() - startTime;
    modelStats.loadCount++;
    
    // Get memory usage
    const memoryInfo = tf.memory();
    modelStats.memoryUsageMB = Math.round(memoryInfo.numBytes / (1024 * 1024));
    
    // Get device memory usage if available
    if (memoryInfo.unreliable) {
      modelStats.deviceMemoryUsageMB = 0;
    } else {
      modelStats.deviceMemoryUsageMB = Math.round((memoryInfo as any).numBytesInGPU / (1024 * 1024)) || 0;
    }
    
    logger.info(`Model loaded successfully in ${modelStats.lastLoadTime}ms. Memory usage: ${modelStats.memoryUsageMB}MB`);
    
    return loadedModel;
  } catch (error) {
    modelStats.lastError = error as Error;
    modelStats.modelLoadErrors++;
    
    logger.error('Error loading model:', error);
    throw error;
  }
}

/**
 * Unload model and free resources
 */
export function unloadModel(): void {
  if (loadedModel) {
    try {
      // Dispose the model
      loadedModel.dispose();
      loadedModel = null;
      
      // Clear TensorFlow memory
      tf.disposeVariables();
      tf.engine().disposeVariables();
      
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }
      
      logger.info('Model unloaded successfully');
    } catch (error) {
      logger.error('Error unloading model:', error);
    }
  }
}

/**
 * Reload the model (unload and load again)
 */
export async function reloadModel(): Promise<tf.GraphModel> {
  unloadModel();
  return loadModel();
}

/**
 * Get current hardware acceleration info
 */
export async function getAccelerationInfo(): Promise<any> {
  try {
    const backend = tf.getBackend();
    const memoryInfo = tf.memory();
    const hardwareInfo: any = {
      backend,
      platform: TF_DEVICE_TO_PLATFORM[backend] || AccelerationPlatform.CPU,
      enabled: backend !== 'cpu',
      deviceMemory: {
        total: 0, // Will be updated if available
        used: modelStats.deviceMemoryUsageMB,
        free: 0,
        unit: 'MB'
      },
      stats: {
        modelLoadTimeMs: modelStats.lastLoadTime,
        loadCount: modelStats.loadCount,
        inferenceCount: modelStats.inferenceCount,
        averageInferenceTimeMs: modelStats.averageInferenceTimeMs,
        memoryUsageMB: modelStats.memoryUsageMB
      },
      capabilities: [],
      settings: {},
      accelerationStats: null
    };
    
    // Attempt to get hardware acceleration capabilities
    try {
      const settings = await getAccelerationSettings();
      
      hardwareInfo.settings = {
        enabled: settings.enabled,
        preferredPlatform: settings.preferredPlatform,
        inferencePlatform: settings.inferencePlatform,
        imageProcessingPlatform: settings.imageProcessingPlatform,
        perfPowerBalance: settings.perfPowerBalance
      };
      
      // If we're actually running hardware acceleration, get true capabilities
      if (AccelerationManager) {
        const accelerationManager = (await import('@shared/hardware-acceleration')).default;
        const capabilities = await accelerationManager.getAvailableCapabilities();
        const stats = await accelerationManager.getAllStatistics();
        
        hardwareInfo.capabilities = capabilities;
        hardwareInfo.accelerationStats = stats;
      }
    } catch (error) {
      logger.warn('Could not get hardware acceleration information:', error);
    }
    
    return hardwareInfo;
  } catch (error) {
    logger.error('Error getting hardware acceleration info:', error);
    return {
      backend: 'cpu',
      platform: AccelerationPlatform.CPU,
      enabled: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get hardware acceleration settings
 */
export async function getAccelerationSettings(): Promise<{
  enabled: boolean;
  preferredPlatform: string;
  inferencePlatform: string;
  imageProcessingPlatform: string;
  perfPowerBalance: number;
}> {
  // For demo purposes, we'll mock the database settings - in a real implementation
  // we would fetch these from the database
  try {
    // Mock settings - in production, this would come from database
    const mockSettings = {
      enabled: true,
      preferredPlatform: 'nvidia_cuda',
      inferencePlatform: 'nvidia_tensorrt',
      imageProcessingPlatform: 'nvidia_cuda',
      perfPowerBalance: 0.7
    };
    
    logger.debug('Using mock hardware acceleration settings');
    
    // Apply any settings from environment variables to override defaults
    if (process.env.HARDWARE_ACCELERATION_ENABLED !== undefined) {
      mockSettings.enabled = process.env.HARDWARE_ACCELERATION_ENABLED !== 'false';
    }
    
    if (process.env.PREFERRED_ACCELERATION_PLATFORM) {
      mockSettings.preferredPlatform = process.env.PREFERRED_ACCELERATION_PLATFORM;
    }
    
    if (process.env.INFERENCE_ACCELERATION_PLATFORM) {
      mockSettings.inferencePlatform = process.env.INFERENCE_ACCELERATION_PLATFORM;
    }
    
    if (process.env.IMAGE_PROCESSING_ACCELERATION_PLATFORM) {
      mockSettings.imageProcessingPlatform = process.env.IMAGE_PROCESSING_ACCELERATION_PLATFORM;
    }
    
    if (process.env.ACCELERATION_PERF_POWER_BALANCE) {
      mockSettings.perfPowerBalance = parseFloat(process.env.ACCELERATION_PERF_POWER_BALANCE);
    }
    
    return mockSettings;
  } catch (error) {
    logger.warn('Error accessing database for hardware acceleration settings:', error);
  }
  
  // Fallback to config
  return {
    enabled: config.hardware.accelerationEnabled,
    preferredPlatform: config.hardware.preferredPlatform,
    inferencePlatform: config.hardware.inferencePlatform,
    imageProcessingPlatform: config.hardware.imageProcessingPlatform,
    perfPowerBalance: config.hardware.perfPowerBalance
  };
}

/**
 * Update inference statistics
 */
export function updateInferenceStats(executionTimeMs: number): void {
  modelStats.inferenceCount++;
  modelStats.totalInferenceTimeMs += executionTimeMs;
  modelStats.averageInferenceTimeMs = modelStats.totalInferenceTimeMs / modelStats.inferenceCount;
  
  // Update memory usage periodically
  if (modelStats.inferenceCount % 100 === 0) {
    const memoryInfo = tf.memory();
    modelStats.memoryUsageMB = Math.round(memoryInfo.numBytes / (1024 * 1024));
    
    // Get device memory usage if available
    if (!memoryInfo.unreliable && (memoryInfo as any).numBytesInGPU) {
      modelStats.deviceMemoryUsageMB = Math.round((memoryInfo as any).numBytesInGPU / (1024 * 1024));
    }
  }
}

/**
 * Initialize model loading on startup
 */
export async function initializeModel(): Promise<void> {
  try {
    // Initialize TF backend
    await initializeTensorFlowBackend();
    
    // Preload model
    await loadModel();
    
    logger.info('Model initialization complete');
  } catch (error) {
    logger.error('Error initializing model:', error);
    throw error;
  }
}