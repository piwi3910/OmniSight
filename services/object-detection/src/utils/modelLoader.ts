import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';
import config from '../config/config';
import logger from './logger';

// Class labels for COCO-SSD model
export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 
  'toothbrush'
];

// Singleton model instance
let model: tf.GraphModel | null = null;
let isModelInitializing = false;

/**
 * Convert class index to class name
 */
export const getClassName = (classId: number): string => {
  return COCO_CLASSES[classId] || `unknown_${classId}`;
};

/**
 * Verify model files exist
 */
export const verifyModelFiles = (): boolean => {
  const modelPath = config.detection.modelPath;
  const modelDir = path.dirname(modelPath);
  const modelFilename = path.basename(modelPath);
  
  if (!fs.existsSync(modelPath)) {
    logger.error(`Model file not found: ${modelPath}`);
    return false;
  }
  
  // Check for shard files (assuming 2 shards as per the download script)
  const shard1 = path.join(modelDir, 'group1-shard1of2.bin');
  const shard2 = path.join(modelDir, 'group1-shard2of2.bin');
  
  if (!fs.existsSync(shard1) || !fs.existsSync(shard2)) {
    logger.error(`Model shard files missing. Please run the download-model.js script first.`);
    return false;
  }
  
  return true;
};

/**
 * Initialize the TensorFlow.js model
 */
export const initializeModel = async (): Promise<tf.GraphModel> => {
  if (model !== null) {
    return model;
  }
  
  if (isModelInitializing) {
    // Wait until model is initialized
    while (isModelInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (model !== null) {
      return model;
    }
  }
  
  isModelInitializing = true;
  
  try {
    logger.info('Initializing TensorFlow.js model');
    
    if (!verifyModelFiles()) {
      throw new Error('Model files missing or invalid');
    }
    
    const modelPath = `file://${config.detection.modelPath}`;
    logger.info(`Loading model from: ${modelPath}`);
    
    // Load the model
    model = await tf.loadGraphModel(modelPath);
    
    // Warm up the model with a dummy tensor
    logger.info('Warming up model with dummy inference...');
    const dummyTensor = tf.zeros([1, 300, 300, 3]);
    const warmupResult = await model.executeAsync(dummyTensor) as tf.Tensor[];
    
    // Print model summary
    logger.info(`Model loaded successfully. Input shape: ${JSON.stringify(model.inputs[0].shape)}`);
    
    // Dispose tensors
    tf.dispose(dummyTensor);
    warmupResult.forEach(tensor => tf.dispose(tensor));
    
    logger.info('Model initialization complete');
    
    return model;
  } catch (error) {
    logger.error('Failed to initialize TensorFlow.js model:', error);
    throw error;
  } finally {
    isModelInitializing = false;
  }
};

/**
 * Process a frame for object detection
 */
export const detectObjects = async (imageBuffer: Buffer, detectionConfig: any): Promise<any[]> => {
  try {
    if (model === null) {
      model = await initializeModel();
    }
    
    // Decode the image
    const image = tf.node.decodeImage(imageBuffer);
    
    // Resize and normalize the image
    const input = tf.image.resizeBilinear(image, [300, 300])
      .div(255.0)
      .expandDims(0);
    
    // Run inference
    const result = await model.executeAsync(input) as tf.Tensor[];
    
    // Extract results
    const boxes = result[0].arraySync() as number[][][];
    const scores = result[1].arraySync() as number[][];
    const classes = result[2].arraySync() as number[][];
    const numDetections = result[3].dataSync()[0];
    
    // Filter detections based on confidence threshold
    const minConfidence = detectionConfig?.minConfidence || 0.5;
    const detectionClasses = detectionConfig?.classes || [];
    
    const detections = [];
    
    for (let i = 0; i < numDetections; i++) {
      // Skip if below confidence threshold
      if (scores[0][i] < minConfidence) continue;
      
      const classId = classes[0][i];
      const className = getClassName(classId);
      
      // Skip if not in specified classes (if any)
      if (detectionClasses.length > 0 && !detectionClasses.includes(className)) {
        continue;
      }
      
      // Convert box coordinates [y1, x1, y2, x2] to [x, y, width, height]
      const box = [
        boxes[0][i][1], // x
        boxes[0][i][0], // y
        boxes[0][i][3] - boxes[0][i][1], // width
        boxes[0][i][2] - boxes[0][i][0]  // height
      ];
      
      detections.push({
        class: className,
        score: scores[0][i],
        bbox: box
      });
    }
    
    // Clean up tensors
    tf.dispose([image, input, ...result]);
    
    return detections;
  } catch (error) {
    logger.error('Error during object detection:', error);
    throw error;
  }
};

/**
 * Initialize model in background
 */
export const preloadModel = async (): Promise<void> => {
  try {
    await initializeModel();
    logger.info('Model preloaded successfully');
  } catch (error) {
    logger.error('Error preloading model:', error);
  }
};