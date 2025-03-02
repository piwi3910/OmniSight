const { parentPort, workerData } = require('worker_threads');
const tf = require('@tensorflow/tfjs-node');

// Worker data
const { modelType, modelPath, minConfidence, classes } = workerData;

// Detection model
let model = null;

/**
 * Initialize TensorFlow model
 */
async function initModel() {
  try {
    console.log(`Worker: Loading TensorFlow.js model: ${modelType}`);
    
    // Load model based on type
    switch (modelType) {
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
        throw new Error(`Unsupported model type: ${modelType}`);
    }
    
    console.log('Worker: TensorFlow.js model loaded successfully');
    
    // Notify parent that we're ready
    parentPort.postMessage({ status: 'ready' });
  } catch (error) {
    console.error('Worker: Failed to initialize TensorFlow.js model:', error);
    throw error;
  }
}

/**
 * Process a video frame for object detection
 */
async function processFrame(frameBuffer, timestamp) {
  try {
    // Convert buffer to tensor
    const tensor = tf.node.decodeImage(frameBuffer);
    
    // Run detection
    const predictions = await model.detect(tensor);
    
    // Convert predictions to our detection format
    const detections = predictions
      .filter((pred) => {
        // Filter by confidence threshold
        return pred.score >= minConfidence &&
          // Filter by allowed classes
          classes.includes(pred.class);
      })
      .map((pred) => ({
        class: pred.class,
        score: pred.score,
        bbox: {
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3]
        }
      }));
    
    // Clean up tensor
    tf.dispose(tensor);
    
    // Return detections
    return detections;
  } catch (error) {
    console.error('Worker: Error processing video frame:', error);
    return [];
  }
}

// Initialize model
initModel().catch(error => {
  console.error('Worker: Initialization error:', error);
  process.exit(1);
});

// Listen for messages from parent
parentPort.on('message', async (message) => {
  try {
    const { frameBuffer, timestamp } = message;
    
    // Process frame
    const detections = await processFrame(frameBuffer, timestamp);
    
    // Send results back to parent
    parentPort.postMessage({ detections, timestamp });
  } catch (error) {
    console.error('Worker: Error processing message:', error);
    parentPort.postMessage({ error: error.message, timestamp: message.timestamp });
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Worker: Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Worker: Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});