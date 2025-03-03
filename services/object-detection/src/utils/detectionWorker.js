const { parentPort, workerData } = require('worker_threads');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

// Worker initialization
let model = null;
const { workerId, modelPath } = workerData;

console.log(`Worker ${workerId} initializing with model: ${modelPath}`);

// Class labels for COCO-SSD
const COCO_CLASSES = [
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

/**
 * Initialize the TensorFlow.js model
 */
async function initializeModel() {
  try {
    // Load the model
    console.log(`Worker ${workerId} loading model from: ${modelPath}`);
    model = await tf.loadGraphModel(`file://${modelPath}`);
    
    // Warm up the model with a dummy prediction
    const dummyInput = tf.zeros([1, 300, 300, 3]);
    const warmupResult = await model.executeAsync(dummyInput);
    
    // Dispose tensors
    tf.dispose(dummyInput);
    tf.dispose(warmupResult);
    
    console.log(`Worker ${workerId} model initialized successfully`);
  } catch (error) {
    console.error(`Worker ${workerId} failed to initialize model:`, error);
    throw error;
  }
}

/**
 * Decode base64 image data to tensor
 */
function decodeImage(base64Data) {
  // Remove data URL prefix if present
  const base64String = base64Data.replace(/^data:image\/(jpeg|png|jpg);base64,/, '');
  
  // Convert base64 to buffer
  const buffer = Buffer.from(base64String, 'base64');
  
  // Decode the image using TensorFlow.js
  const tensor = tf.node.decodeImage(buffer);
  
  // Resize and normalize the image for the model
  const resized = tf.image.resizeBilinear(tensor, [300, 300]);
  const normalized = resized.div(255.0);
  const batched = normalized.expandDims(0);
  
  // Dispose the original tensor
  tf.dispose(tensor);
  tf.dispose(resized);
  tf.dispose(normalized);
  
  return batched;
}

/**
 * Process detection task
 */
async function processDetection(task) {
  const { taskId, streamId, cameraId, frameData, timestamp, detectionConfig } = task;
  
  try {
    // If model is not loaded, load it
    if (!model) {
      await initializeModel();
    }
    
    // Measure processing time
    const startTime = Date.now();
    
    // Decode the image
    const imageTensor = decodeImage(frameData);
    
    // Run inference
    const predictions = await model.executeAsync(imageTensor);
    
    // Extract results from the model output
    const boxes = predictions[0].arraySync()[0];
    const scores = predictions[1].arraySync()[0];
    const classes = predictions[2].arraySync()[0];
    const numDetections = predictions[3].dataSync()[0];
    
    // Filter detections based on confidence threshold
    const minConfidence = detectionConfig?.minConfidence || 0.5;
    
    const filteredDetections = [];
    for (let i = 0; i < numDetections; i++) {
      if (scores[i] >= minConfidence) {
        const classId = classes[i];
        const className = COCO_CLASSES[classId] || `class_${classId}`;
        
        // Check if class is included in detection config
        if (detectionConfig?.classes && 
            detectionConfig.classes.length > 0 && 
            !detectionConfig.classes.includes(className)) {
          continue;
        }
        
        // Extract bounding box
        const bbox = [
          boxes[i][1], // x
          boxes[i][0], // y
          boxes[i][3] - boxes[i][1], // width
          boxes[i][2] - boxes[i][0]  // height
        ];
        
        filteredDetections.push({
          class: className,
          score: scores[i],
          bbox: bbox
        });
      }
    }
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Clean up tensors
    tf.dispose(imageTensor);
    tf.dispose(predictions);
    
    // Return results to main thread
    parentPort.postMessage({
      taskId,
      streamId,
      cameraId,
      timestamp,
      objects: filteredDetections,
      processingTime
    });
    
  } catch (error) {
    console.error(`Worker ${workerId} detection error:`, error);
    
    // Return error to main thread
    parentPort.postMessage({
      taskId,
      streamId,
      cameraId,
      timestamp,
      error: error.toString(),
      objects: [],
      processingTime: 0
    });
  }
}

// Listen for messages from the main thread
parentPort.on('message', (task) => {
  processDetection(task).catch(error => {
    console.error(`Worker ${workerId} unhandled error:`, error);
  });
});

// Notify main thread that worker is ready
parentPort.postMessage({
  type: 'ready',
  workerId
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`Worker ${workerId} uncaught exception:`, error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`Worker ${workerId} unhandled rejection at:`, promise, 'reason:', reason);
});