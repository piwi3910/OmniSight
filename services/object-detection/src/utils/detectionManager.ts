import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQManager, MessageType } from '@omnisight/shared';
import { PrismaClient } from '@prisma/client';
import config from '../config/config';
import logger from './logger';

// Initialize Prisma client
const prisma = new PrismaClient();

// Store worker threads
const workers: Worker[] = [];

// Queue of frames to process
interface DetectionTask {
  id: string;
  streamId: string;
  cameraId: string;
  frameData: string;
  timestamp: string;
  priority: number;
}

// Queue for detection tasks
const detectionQueue: DetectionTask[] = [];

// Processing status
let isProcessing = false;

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
      async (message) => {
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
  // Determine number of workers (leave one core free)
  const numWorkers = Math.max(1, os.cpus().length - 1);
  
  logger.info(`Initializing ${numWorkers} detection worker threads`);
  
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
    );
    
    // Handle worker messages
    worker.on('message', (result) => {
      handleDetectionResult(result);
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
    workers.push(worker);
  }
  
  logger.info(`${workers.length} detection workers initialized`);
};

/**
 * Enqueue a detection task
 */
export const enqueueDetectionTask = async (frameData: any): Promise<void> => {
  try {
    const { streamId, cameraId, timestamp, data } = frameData;
    
    // Create task
    const task: DetectionTask = {
      id: uuidv4(),
      streamId,
      cameraId,
      frameData: data,
      timestamp,
      priority: 1 // Default priority
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
    
    // Sort queue by priority (highest first)
    detectionQueue.sort((a, b) => b.priority - a.priority);
    
    // Get next task
    const task = detectionQueue.shift();
    
    if (!task) {
      isProcessing = false;
      return;
    }
    
    // Find available worker
    const worker = workers.find(w => !w.busy);
    
    if (worker) {
      // Mark worker as busy
      worker.busy = true;
      
      // Send task to worker
      worker.postMessage({
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
    const { taskId, streamId, cameraId, timestamp, objects, processingTime } = result;
    
    logger.debug(`Received detection result for task ${taskId}: ${objects.length} objects detected in ${processingTime}ms`);
    
    // Find worker that sent the result
    const worker = workers.find(w => w.busy);
    
    if (worker) {
      // Mark worker as available
      worker.busy = false;
    }
    
    // Store detected objects in database
    if (objects.length > 0) {
      await storeDetectionResults(streamId, cameraId, timestamp, objects);
      
      // Publish detection event
      await publishDetectionEvent(streamId, cameraId, timestamp, objects);
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
  objects: any[]
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
          objectCount: objects.length
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
  objects: any[]
): Promise<void> => {
  try {
    if (!rabbitmqManager) {
      logger.error('RabbitMQ not initialized');
      return;
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
          timestamp,
          objects: objects.map(obj => ({
            class: obj.class,
            score: obj.score,
            bbox: obj.bbox
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
  return {
    workers: workers.length,
    queueLength: detectionQueue.length,
    isProcessing,
    workerStatus: workers.map((worker, index) => ({
      id: index,
      busy: !!worker.busy
    }))
  };
};