import * as tf from '@tensorflow/tfjs-node';
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';
import logger from './logger';
import { publishDetectionEvent } from './rabbitmq';

// Load GPU if configured
if (config.tensorflow.useGPU) {
  try {
    require('@tensorflow/tfjs-node-gpu');
    logger.info('TensorFlow.js GPU support enabled');
  } catch (error) {
    logger.warn('Failed to load TensorFlow.js GPU support, falling back to CPU:', error);
  }
}

// Detection model
let model: any = null;

// Worker threads for parallel processing
const workers: Worker[] = [];

// Map to track active detection processes
const activeDetections = new Map<string, boolean>();

// Interface for detection result
interface Detection {
  class: string;
  score: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Initialize TensorFlow model
 */
export const initModel = async (): Promise<void> => {
  try {
    logger.info(`Loading TensorFlow.js model: ${config.tensorflow.modelType}`);
    
    // Ensure model directory exists
    const modelDir = path.dirname(config.tensorflow.modelPath);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Load model based on type
    switch (config.tensorflow.modelType) {
      case 'coco-ssd':
        // Load COCO-SSD model
        const cocoSsd = require('@tensorflow-models/coco-ssd');
        model = await cocoSsd.load();
        break;
        
      case 'mobilenet':
        // Load MobileNet model
        const mobilenet = require('@tensorflow-models/mobilenet');
        model = await mobilenet.load();
        break;
        
      default:
        throw new Error(`Unsupported model type: ${config.tensorflow.modelType}`);
    }
    
    logger.info('TensorFlow.js model loaded successfully');
    
    // Initialize worker threads if configured
    if (config.tensorflow.workerThreads > 0) {
      await initWorkers();
    }
  } catch (error) {
    logger.error('Failed to initialize TensorFlow.js model:', error);
    throw error;
  }
};

/**
 * Initialize worker threads for parallel processing
 */
const initWorkers = async (): Promise<void> => {
  try {
    const workerCount = config.tensorflow.workerThreads;
    logger.info(`Initializing ${workerCount} worker threads`);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(path.join(__dirname, 'detectionWorker.js'), {
        workerData: {
          modelType: config.tensorflow.modelType,
          modelPath: config.tensorflow.modelPath,
          minConfidence: config.detection.minConfidence,
          classes: config.detection.classes
        }
      });
      
      worker.on('error', (error) => {
        logger.error(`Worker thread ${i} error:`, error);
      });
      
      worker.on('exit', (code) => {
        logger.warn(`Worker thread ${i} exited with code ${code}`);
        // Restart worker if it exits unexpectedly
        if (code !== 0) {
          workers.splice(workers.indexOf(worker), 1);
          initWorkers();
        }
      });
      
      workers.push(worker);
      logger.info(`Worker thread ${i} initialized`);
    }
  } catch (error) {
    logger.error('Failed to initialize worker threads:', error);
  }
};

/**
 * Process a video frame for object detection
 */
export const processVideoFrame = async (
  cameraId: string,
  streamId: string,
  frameBuffer: Buffer,
  timestamp: Date
): Promise<void> => {
  try {
    // Generate a unique key for this detection
    const detectionKey = `${cameraId}:${streamId}:${timestamp.getTime()}`;
    
    // Skip if we're already processing a frame for this camera/stream
    // and the detection interval hasn't elapsed
    const lastDetectionKey = `${cameraId}:${streamId}`;
    if (activeDetections.has(lastDetectionKey)) {
      return;
    }
    
    // Mark as active
    activeDetections.set(lastDetectionKey, true);
    
    // Convert buffer to tensor
    const tensor = tf.node.decodeImage(frameBuffer);
    
    // Run detection
    let detections: Detection[] = [];
    
    if (workers.length > 0) {
      // Use worker thread for detection
      const workerIndex = Math.floor(Math.random() * workers.length);
      const worker = workers[workerIndex];
      
      detections = await new Promise<Detection[]>((resolve, reject) => {
        worker.once('message', (result) => {
          resolve(result.detections);
        });
        
        worker.postMessage({
          frameBuffer,
          timestamp: timestamp.toISOString()
        });
      });
    } else {
      // Use main thread for detection
      const predictions = await model.detect(tensor);
      
      // Convert predictions to our detection format
      detections = predictions
        .filter((pred: any) => {
          // Filter by confidence threshold
          return pred.score >= config.detection.minConfidence &&
            // Filter by allowed classes
            config.detection.classes.includes(pred.class);
        })
        .map((pred: any) => ({
          class: pred.class,
          score: pred.score,
          bbox: {
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3]
          }
        }));
    }
    
    // Clean up tensor
    tf.dispose(tensor);
    
    // If we have detections, publish event and notify metadata service
    if (detections.length > 0) {
      logger.info(`Detected ${detections.length} objects in frame from camera ${cameraId}`);
      
      // Publish detection event
      await publishDetectionEvent(cameraId, streamId, detections, timestamp, frameBuffer);
      
      // Notify metadata service
      await notifyMetadataService(cameraId, streamId, detections, timestamp);
    }
    
    // Clear active flag after detection interval
    setTimeout(() => {
      activeDetections.delete(lastDetectionKey);
    }, config.detection.detectionInterval);
  } catch (error) {
    logger.error(`Error processing video frame for camera ${cameraId}, stream ${streamId}:`, error);
    activeDetections.delete(`${cameraId}:${streamId}`);
  }
};

/**
 * Notify metadata service about detections
 */
const notifyMetadataService = async (
  cameraId: string,
  streamId: string,
  detections: Detection[],
  timestamp: Date
): Promise<void> => {
  try {
    // Get recording ID for this stream
    const recordingResponse = await axios.get(
      `${config.metadataService.url}/api/cameras/${cameraId}/recordings?active=true`,
      { timeout: 5000 }
    );
    
    if (!recordingResponse.data || !recordingResponse.data.recordings || recordingResponse.data.recordings.length === 0) {
      logger.warn(`No active recording found for camera ${cameraId}`);
      return;
    }
    
    const recordingId = recordingResponse.data.recordings[0].id;
    
    // Create event in metadata service
    const eventId = uuidv4();
    
    // Determine event type based on detections
    let eventType = 'motion';
    if (detections.some(d => d.class === 'person')) {
      eventType = 'person';
    } else if (detections.some(d => ['car', 'truck', 'bus'].includes(d.class))) {
      eventType = 'vehicle';
    } else if (detections.some(d => ['dog', 'cat'].includes(d.class))) {
      eventType = 'animal';
    }
    
    // Calculate confidence as average of detection scores
    const confidence = detections.reduce((sum, d) => sum + d.score, 0) / detections.length;
    
    // Create event
    await axios.post(
      `${config.metadataService.url}/api/events`,
      {
        id: eventId,
        recordingId,
        timestamp,
        type: eventType,
        confidence,
        metadata: {
          streamId,
          detectionCount: detections.length
        }
      },
      { timeout: 5000 }
    );
    
    // Create detected objects
    for (const detection of detections) {
      await axios.post(
        `${config.metadataService.url}/api/detectedObjects`,
        {
          eventId,
          type: detection.class,
          confidence: detection.score,
          boundingBox: detection.bbox
        },
        { timeout: 5000 }
      );
    }
    
    logger.info(`Created event ${eventId} in metadata service for camera ${cameraId}`);
  } catch (error) {
    logger.error(`Failed to notify metadata service for camera ${cameraId}:`, error);
  }
};

/**
 * Clean up resources
 */
export const cleanup = async (): Promise<void> => {
  try {
    // Terminate worker threads
    for (const worker of workers) {
      worker.terminate();
    }
    
    // Clear workers array
    workers.length = 0;
    
    // Dispose of TensorFlow resources
    tf.dispose();
    
    logger.info('Detection resources cleaned up');
  } catch (error) {
    logger.error('Error cleaning up detection resources:', error);
  }
};