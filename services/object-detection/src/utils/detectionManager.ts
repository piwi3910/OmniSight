import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQManager, MessageType } from '@omnisight/shared';
import { PrismaClient } from '@prisma/client';
import config from '../config/config';
import logger from './logger';
import * as modelLoader from './modelLoader';

// Extend Worker type to include busy property
interface DetectionWorker extends Worker {
  busy: boolean;
}

// Initialize Prisma client
const prisma = new PrismaClient();

// Store worker threads
const workers: DetectionWorker[] = [];

// Queue of frames to process
interface DetectionTask {
  id: string;
  streamId: string;
  cameraId: string;
  frameData: string;
  timestamp: string;
  priority: number;
  addedAt: number;
}

// Detection stats
interface DetectionStats {
  totalDetections: number;
  framesProcessed: number;
  framesSkipped: number;
  processingTimes: number[];
  objectsByClass: Record<string, number>;
  lastDetectionTime: number | null;
}

// Queue for detection tasks
const detectionQueue: DetectionTask[] = [];

// Processing status
let isProcessing = false;

// Statistics
const stats: DetectionStats = {
  totalDetections: 0,
  framesProcessed: 0,
  framesSkipped: 0,
  processingTimes: [],
  objectsByClass: {},
  lastDetectionTime: null
};

// Max queue size
const MAX_QUEUE_SIZE = config.detection.maxQueueSize || 100;

// Reference to RabbitMQ manager
let rabbitmqManager: RabbitMQManager;

/**
 * Initialize RabbitMQ connection
 */
export const initializeRabbitMQ = async (): Promise<void> => {
  try {
    // Create RabbitMQ manager
    rabbitmqManager = new RabbitMQManager({
      url: config.rabbitmq.url,
      serviceName: 'object-detection',
      logger
    });
    
    // Connect to RabbitMQ
    await rabbitmqManager.connect();
    
    // Set up exchanges
    await rabbitmqManager.setupTopology();
    
    // Set up consumer for stream frames
    await rabbitmqManager.consume(
      'object-detection.frames-queue',
      async (message: any) => {
        if (message.type === MessageType.STREAM_FRAME) {
          await enqueueDetectionTask(message.payload);
        }
      }
    );
    
    logger.info('RabbitMQ connection established for object detection service');
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ:', error);
    throw error;
  }
};

/**
 * Initialize worker threads for object detection
 */
export const initializeWorkers = (): void => {
  // Create tmp directory for thumbnails if it doesn't exist
  const thumbnailDir = path.resolve(process.cwd(), config.detection.thumbnailPath);
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
    logger.info(`Created thumbnail directory: ${thumbnailDir}`);
  }

  // Determine number of workers (default to CPU count - 1, or user config)
  const numWorkers = config.detection.workers > 0 
    ? config.detection.workers 
    : Math.max(1, os.cpus().length - 1);
  
  logger.info(`Initializing ${numWorkers} detection worker threads`);
  
  // Verify model exists before starting workers
  if (!modelLoader.verifyModelFiles()) {
    logger.warn('Model files missing or invalid - workers may fail to initialize');
  }
  
  // Create workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(
      path.resolve(__dirname, 'detectionWorker.js'),
      {
        workerData: {
          workerId: i,
          modelPath: path.resolve(process.cwd(), config.detection.modelPath)
        }
      }
    ) as DetectionWorker;
    
    // Handle worker messages
    worker.on('message', (message: any) => {
      if (message.type === 'ready') {
        logger.info(`Worker ${message.workerId} is ready`);
        worker.busy = false;
      } else {
        handleDetectionResult(message);
      }
    });
    
    // Handle worker errors
    worker.on('error', (error) => {
      logger.error(`Worker ${i} error:`, error);
      
      // Remove worker from pool
      const index = workers.indexOf(worker);
      if (index !== -1) {
        workers.splice(index, 1);
      }
      
      // Create replacement worker
      setTimeout(() => {
        initializeWorkers();
      }, 5000);
    });
    
    // Handle worker exit
    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Worker ${i} exited with code ${code}`);
        
        // Remove worker from pool
        const index = workers.indexOf(worker);
        if (index !== -1) {
          workers.splice(index, 1);
        }
        
        // Create replacement worker
        setTimeout(() => {
          initializeWorkers();
        }, 5000);
      }
    });
    
    // Add worker to pool
    worker.busy = true; // Mark as busy until ready message
    workers.push(worker);
  }
  
  logger.info(`${workers.length} detection workers initialized`);
  
  // Preload model in background
  modelLoader.preloadModel()
    .then(() => logger.info('Model preloaded successfully'))
    .catch(err => logger.warn('Model preload failed:', err));
};

/**
 * Enqueue a detection task
 */
export const enqueueDetectionTask = async (frameData: any): Promise<void> => {
  try {
    const { streamId, cameraId, timestamp, data } = frameData;
    
    // Skip if queue is full and this is not a high priority task
    const priority = frameData.priority || 1;
    if (detectionQueue.length >= MAX_QUEUE_SIZE && priority <= 1) {
      stats.framesSkipped++;
      logger.debug(`Skipping frame from stream ${streamId}, queue full (${detectionQueue.length}/${MAX_QUEUE_SIZE})`);
      return;
    }
    
    // Create task
    const task: DetectionTask = {
      id: uuidv4(),
      streamId,
      cameraId,
      frameData: data,
      timestamp,
      priority,
      addedAt: Date.now()
    };
    
    // Add to queue
    detectionQueue.push(task);
    
    // Start processing if not already
    if (!isProcessing) {
      processNextTask();
    }
  } catch (error) {
    logger.error('Error enqueueing detection task:', error);
  }
};

/**
 * Process the next task in the queue
 */
const processNextTask = async (): Promise<void> => {
  try {
    // If queue is empty, stop processing
    if (detectionQueue.length === 0) {
      isProcessing = false;
      return;
    }
    
    isProcessing = true;
    
    // Sort queue by priority (highest first) and then by timestamp (oldest first)
    detectionQueue.sort((a, b) => {
      // First sort by priority (descending)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      
      // Then sort by age (oldest first)
      return a.addedAt - b.addedAt;
    });
    
    // Get next task
    const task = detectionQueue.shift();
    
    if (!task) {
      isProcessing = false;
      return;
    }
    
    // Find available worker
    const availableWorker = workers.find(w => !w.busy);
    
    if (availableWorker) {
      // Mark worker as busy
      availableWorker.busy = true;
      
      // Send task to worker
      availableWorker.postMessage({
        taskId: task.id,
        streamId: task.streamId,
        cameraId: task.cameraId,
        frameData: task.frameData,
        timestamp: task.timestamp,
        detectionConfig: config.detection
      });
    } else {
      // No workers available, put task back in queue
      detectionQueue.unshift(task);
      
      // Wait a bit before trying again
      setTimeout(() => {
        processNextTask();
      }, 100);
    }
  } catch (error) {
    logger.error('Error processing detection task:', error);
    isProcessing = false;
  }
};

/**
 * Handle detection result from worker
 */
const handleDetectionResult = async (result: any): Promise<void> => {
  try {
    const { taskId, streamId, cameraId, timestamp, objects, processingTime, skippedReason, thumbnailPath } = result;
    
    // Find worker that sent the result
    const worker = workers.find(w => w.busy);
    
    if (worker) {
      // Mark worker as available
      worker.busy = false;
    }
    
    // Update statistics
    stats.framesProcessed++;
    if (skippedReason) {
      stats.framesSkipped++;
    }
    
    if (processingTime) {
      stats.processingTimes.push(processingTime);
      // Keep only the last 100 processing times
      if (stats.processingTimes.length > 100) {
        stats.processingTimes.shift();
      }
    }
    
    // Store detected objects in database
    if (objects && objects.length > 0) {
      stats.totalDetections += objects.length;
      stats.lastDetectionTime = Date.now();
      
      // Update object class counts
      objects.forEach((obj: any) => {
        stats.objectsByClass[obj.class] = (stats.objectsByClass[obj.class] || 0) + 1;
      });
      
      await storeDetectionResults(streamId, cameraId, timestamp, objects, thumbnailPath);
      
      // Publish detection event
      await publishDetectionEvent(streamId, cameraId, timestamp, objects, thumbnailPath);
      
      logger.debug(`Detection result for task ${taskId}: ${objects.length} objects detected in ${processingTime}ms`);
    } else if (skippedReason) {
      logger.debug(`Detection skipped for task ${taskId}: ${skippedReason}`);
    } else {
      logger.debug(`No objects detected for task ${taskId}`);
    }
    
    // Process next task
    processNextTask();
  } catch (error) {
    logger.error('Error handling detection result:', error);
    
    // Continue processing
    processNextTask();
  }
};

/**
 * Store detection results in database
 */
const storeDetectionResults = async (
  streamId: string,
  cameraId: string,
  timestamp: string,
  objects: any[],
  thumbnailPath?: string
): Promise<void> => {
  try {
    // Create event
    const event = await prisma.event.create({
      data: {
        type: 'OBJECT_DETECTED',
        cameraId,
        streamId,
        timestamp: new Date(timestamp),
        metadata: {
          objectCount: objects.length,
          thumbnailPath: thumbnailPath || null
        }
      }
    });
    
    // Create detected objects
    for (const obj of objects) {
      await prisma.detectedObject.create({
        data: {
          eventId: event.id,
          label: obj.class,
          confidence: obj.score,
          boundingBox: {
            x: obj.bbox[0],
            y: obj.bbox[1],
            width: obj.bbox[2],
            height: obj.bbox[3]
          }
        }
      });
    }
    
    logger.debug(`Stored detection results for stream ${streamId}: ${objects.length} objects`);
  } catch (error) {
    logger.error('Error storing detection results:', error);
  }
};

/**
 * Publish detection event to RabbitMQ
 */
const publishDetectionEvent = async (
  streamId: string,
  cameraId: string,
  timestamp: string,
  objects: any[],
  thumbnailPath?: string
): Promise<void> => {
  try {
    if (!rabbitmqManager) {
      logger.error('RabbitMQ not initialized');
      return;
    }
    
    // Get camera name for notification
    let cameraName = 'Unknown Camera';
    try {
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId }
      });
      if (camera) {
        cameraName = camera.name;
      }
    } catch (err) {
      logger.warn(`Could not fetch camera name for id ${cameraId}:`, err);
    }
    
    // Prepare thumbnail URL if available
    let thumbnailUrl = null;
    if (thumbnailPath) {
      // Convert absolute path to relative URL path
      const relativePath = path.relative(process.cwd(), thumbnailPath);
      thumbnailUrl = `/api/v1/thumbnails/${path.basename(thumbnailPath)}`;
    }
    
    // Publish detection event
    await rabbitmqManager.publish(
      'detection',
      `detection.${cameraId}`,
      rabbitmqManager.createMessage(
        MessageType.OBJECT_DETECTED,
        {
          streamId,
          cameraId,
          cameraName,
          timestamp,
          thumbnailUrl,
          objects: objects.map(obj => ({
            class: obj.class,
            score: obj.score,
            bbox: obj.bbox
          }))
        }
      )
    );
    
    // Also publish to events exchange for WebSocket notifications
    await rabbitmqManager.publish(
      'events',
      'events.detection',
      rabbitmqManager.createMessage(
        MessageType.OBJECT_DETECTED,
        {
          eventId: uuidv4(), // Generate ID for WebSocket events
          streamId,
          cameraId,
          cameraName,
          timestamp,
          thumbnailUrl,
          detectedObjects: objects.map(obj => ({
            label: obj.class,
            confidence: obj.score
          }))
        }
      )
    );
    
    logger.debug(`Published detection event for stream ${streamId}: ${objects.length} objects`);
  } catch (error) {
    logger.error('Error publishing detection event:', error);
  }
};

/**
 * Get detection statistics
 */
export const getDetectionStats = (): any => {
  // Calculate average processing time
  const avgProcessingTime = stats.processingTimes.length > 0
    ? stats.processingTimes.reduce((sum, time) => sum + time, 0) / stats.processingTimes.length
    : 0;
  
  return {
    workers: {
      total: workers.length,
      available: workers.filter(w => !w.busy).length,
      busy: workers.filter(w => w.busy).length,
    },
    queue: {
      current: detectionQueue.length,
      max: MAX_QUEUE_SIZE,
      isProcessing
    },
    performance: {
      avgProcessingTime: Math.round(avgProcessingTime),
      framesProcessed: stats.framesProcessed,
      framesSkipped: stats.framesSkipped,
      totalDetections: stats.totalDetections,
      lastDetectionTime: stats.lastDetectionTime ? new Date(stats.lastDetectionTime).toISOString() : null
    },
    objects: {
      byClass: stats.objectsByClass
    },
    config: {
      minConfidence: config.detection.minConfidence,
      detectionInterval: config.detection.detectionInterval,
      classes: config.detection.classes,
      motionSensitivity: config.detection.motionSensitivity,
      regionOfInterest: config.detection.regionOfInterest,
      saveThumbnails: config.detection.saveThumbnails
    }
  };
};