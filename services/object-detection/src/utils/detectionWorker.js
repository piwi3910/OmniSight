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
 * Motion detection using frame differencing
 * @param {tf.Tensor} currentFrame Current frame tensor
 * @param {tf.Tensor} previousFrame Previous frame tensor
 * @param {number} threshold Threshold for motion detection (0-1)
 * @returns {boolean} True if motion detected
 */
function detectMotion(currentFrame, previousFrame, threshold = 0.05) {
  if (!previousFrame) return true;
  
  try {
    // Convert to grayscale for motion detection
    const gray1 = tf.image.rgbToGrayscale(currentFrame);
    const gray2 = tf.image.rgbToGrayscale(previousFrame);
    
    // Calculate absolute difference between frames
    const diff = tf.abs(tf.sub(gray1, gray2));
    
    // Apply threshold to difference
    const motionMask = tf.greater(diff, tf.scalar(threshold));
    
    // Calculate percentage of pixels with motion
    const motionPixels = tf.sum(tf.cast(motionMask, 'float32'));
    const totalPixels = tf.prod(motionMask.shape);
    const motionRatio = motionPixels.div(totalPixels);
    
    // Get scalar value
    const motionValue = motionRatio.dataSync()[0];
    
    // Clean up tensors
    tf.dispose([gray1, gray2, diff, motionMask, motionPixels, totalPixels, motionRatio]);
    
    return motionValue > threshold;
  } catch (error) {
    console.error(`Worker ${workerId} motion detection error:`, error);
    return true; // Default to true on error
  }
}

/**
 * Create a region of interest mask
 * @param {object} roi Region of interest {x, y, width, height}
 * @param {number} imageWidth Total image width
 * @param {number} imageHeight Total image height
 * @returns {tf.Tensor} Binary mask tensor
 */
function createRoiMask(roi, imageWidth, imageHeight) {
  if (!roi) return null;
  
  try {
    // Create an empty mask
    const mask = tf.zeros([imageHeight, imageWidth]);
    
    // Calculate ROI coordinates
    const x1 = Math.floor(roi.x * imageWidth);
    const y1 = Math.floor(roi.y * imageHeight);
    const x2 = Math.floor((roi.x + roi.width) * imageWidth);
    const y2 = Math.floor((roi.y + roi.height) * imageHeight);
    
    // Create ones for the ROI area
    const roiOnes = tf.ones([y2 - y1, x2 - x1]);
    
    // Place the ROI ones in the mask
    const roiMask = tf.pad(
      roiOnes, 
      [[y1, imageHeight - y2], [x1, imageWidth - x2]]
    );
    
    // Clean up tensors
    tf.dispose(roiOnes);
    
    return roiMask;
  } catch (error) {
    console.error(`Worker ${workerId} ROI mask creation error:`, error);
    return null;
  }
}

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
    if (Array.isArray(warmupResult)) {
      warmupResult.forEach(tensor => tf.dispose(tensor));
    } else {
      tf.dispose(warmupResult);
    }
    
    console.log(`Worker ${workerId} model initialized successfully`);
  } catch (error) {
    console.error(`Worker ${workerId} failed to initialize model:`, error);
    throw error;
  }
}

/**
 * Save detection thumbnail
 * @param {Buffer} imageBuffer Original image buffer
 * @param {Array} objects Detected objects
 * @param {string} taskId Task ID
 * @param {object} detectionConfig Detection configuration
 * @returns {string|null} Thumbnail path or null
 */
function saveThumbnail(imageBuffer, objects, taskId, detectionConfig) {
  try {
    if (!detectionConfig.saveThumbnails || objects.length === 0) {
      return null;
    }
    
    // Create thumbnails directory if it doesn't exist
    const thumbnailDir = detectionConfig.thumbnailPath || './data/thumbnails';
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${taskId}.jpg`;
    const filepath = path.join(thumbnailDir, filename);
    
    // Write thumbnail
    fs.writeFileSync(filepath, imageBuffer);
    
    return filepath;
  } catch (error) {
    console.error(`Worker ${workerId} thumbnail save error:`, error);
    return null;
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
  
  return { batched, buffer };
}

// Keep track of previous frame for motion detection
let previousFrame = null;

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
    const { batched: imageTensor, buffer: imageBuffer } = decodeImage(frameData);
    
    // Skip detection if motion detection is enabled and no motion detected
    if (detectionConfig?.motionSensitivity && previousFrame) {
      const hasMotion = detectMotion(
        imageTensor.squeeze(), 
        previousFrame, 
        detectionConfig.motionSensitivity
      );
      
      if (!hasMotion) {
        // Store current frame and return empty results
        if (previousFrame) tf.dispose(previousFrame);
        previousFrame = imageTensor.squeeze().clone();
        
        // Dispose tensors
        tf.dispose(imageTensor);
        
        parentPort.postMessage({
          taskId,
          streamId,
          cameraId,
          timestamp,
          objects: [],
          skippedReason: 'no-motion',
          processingTime: Date.now() - startTime
        });
        
        return;
      }
    }
    
    // Store current frame for next motion detection
    if (previousFrame) tf.dispose(previousFrame);
    previousFrame = imageTensor.squeeze().clone();
    
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
        
        // Check if object is within region of interest
        if (detectionConfig?.regionOfInterest) {
          const roi = detectionConfig.regionOfInterest;
          const objX = bbox[0];
          const objY = bbox[1];
          const objWidth = bbox[2];
          const objHeight = bbox[3];
          
          // Calculate center point of object
          const centerX = objX + objWidth / 2;
          const centerY = objY + objHeight / 2;
          
          // Check if center point is within ROI
          if (!(centerX >= roi.x && 
                centerX <= roi.x + roi.width && 
                centerY >= roi.y && 
                centerY <= roi.y + roi.height)) {
            continue;
          }
        }
        
        filteredDetections.push({
          class: className,
          score: scores[i],
          bbox: bbox
        });
      }
    }
    
    // Save thumbnail if configured
    let thumbnailPath = null;
    if (filteredDetections.length > 0 && detectionConfig?.saveThumbnails) {
      thumbnailPath = saveThumbnail(imageBuffer, filteredDetections, taskId, detectionConfig);
    }
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Clean up tensors
    tf.dispose(imageTensor);
    if (Array.isArray(predictions)) {
      predictions.forEach(tensor => tf.dispose(tensor));
    } else {
      tf.dispose(predictions);
    }
    
    // Return results to main thread
    parentPort.postMessage({
      taskId,
      streamId,
      cameraId,
      timestamp,
      objects: filteredDetections,
      thumbnailPath,
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