import { DetectionManager } from '../detectionManager';
import * as rabbitmq from '../rabbitmq';
import * as tf from '@tensorflow/tfjs-node';
import { mockLogger } from '../../test/mocks/logger.mock';

// Mock dependencies
jest.mock('@tensorflow/tfjs-node', () => ({
  loadGraphModel: jest.fn().mockResolvedValue({
    executeAsync: jest.fn().mockResolvedValue([
      // Mocked detection boxes: [y1, x1, y2, x2] format, normalized 0-1
      [[[0.1, 0.2, 0.5, 0.6]]], // Person
      // Mocked detection scores
      [[0.95]], // High confidence
      // Mocked detection classes
      [[1]], // Class 1 = person
      // Mocked detection count
      [1]
    ]),
    dispose: jest.fn(),
  }),
  tensor: jest.fn().mockReturnValue({
    expandDims: jest.fn().mockReturnValue({
      dispose: jest.fn(),
    }),
    dispose: jest.fn(),
  }),
  dispose: jest.fn(),
  browser: {
    fromPixels: jest.fn().mockReturnValue({
      toFloat: jest.fn().mockReturnValue({
        div: jest.fn().mockReturnValue({
          expandDims: jest.fn().mockReturnValue({
            dispose: jest.fn(),
          }),
          dispose: jest.fn(),
        }),
        dispose: jest.fn(),
      }),
      dispose: jest.fn(),
    }),
  },
  memory: jest.fn().mockReturnValue({
    numBytes: 1000,
    numTensors: 10,
  }),
}));

jest.mock('../rabbitmq', () => ({
  setupRabbitMQ: jest.fn().mockResolvedValue({
    connection: { createChannel: jest.fn().mockResolvedValue({ assertQueue: jest.fn() }) },
    channel: { assertQueue: jest.fn(), consume: jest.fn(), ack: jest.fn() },
  }),
  publishDetectionEvent: jest.fn().mockResolvedValue(undefined),
}));

// Mock worker thread communication
jest.mock('worker_threads', () => ({
  isMainThread: true,
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'message') {
        // Simulate worker response
        setTimeout(() => {
          callback({
            type: 'detection_result',
            detections: [
              {
                bbox: [0.2, 0.1, 0.6, 0.5], // [x1, y1, x2, y2] format, normalized 0-1
                class: 'person',
                score: 0.95,
              }
            ],
            frameId: 'test-frame-id',
            cameraId: 'test-camera-id',
            timestamp: new Date().toISOString(),
          });
        }, 10);
      }
    }),
    postMessage: jest.fn(),
    terminate: jest.fn(),
  })),
  parentPort: {
    postMessage: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock image processing
jest.mock('../../node_modules/@tensorflow/tfjs-node/dist/image.js', () => ({
  decodeImage: jest.fn().mockReturnValue({
    dispose: jest.fn(),
    shape: [480, 640, 3],
  }),
  fromPixels: jest.fn().mockReturnValue({
    dispose: jest.fn(),
    shape: [480, 640, 3],
  }),
}));

describe('DetectionManager', () => {
  let detectionManager: DetectionManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    detectionManager = new DetectionManager(mockLogger);
  });
  
  describe('initialize', () => {
    it('should initialize detection manager successfully', async () => {
      // Act
      await detectionManager.initialize({
        modelPath: 'models/coco-ssd/model.json',
        workerCount: 2,
        detectionThreshold: 0.5,
      });
      
      // Assert
      expect(tf.loadGraphModel).toHaveBeenCalledWith('file://models/coco-ssd/model.json');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Detection manager initialized'),
        expect.any(Object)
      );
    });
    
    it('should handle initialization errors', async () => {
      // Arrange
      const initError = new Error('Model loading failed');
      (tf.loadGraphModel as jest.Mock).mockRejectedValueOnce(initError);
      
      // Act & Assert
      await expect(detectionManager.initialize()).rejects.toThrow('Model loading failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize detection manager'),
        expect.objectContaining({ error: initError })
      );
    });
  });
  
  describe('detectObjects', () => {
    beforeEach(async () => {
      await detectionManager.initialize();
    });
    
    it('should detect objects in frame and return results', async () => {
      // Arrange
      const frameData = Buffer.from('test-frame-data');
      const frameMetadata = {
        frameId: 'test-frame-id',
        cameraId: 'test-camera-id',
        timestamp: new Date().toISOString(),
        width: 640,
        height: 480,
      };
      
      // Act
      const result = await detectionManager.detectObjects(frameData, frameMetadata);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.detections).toHaveLength(1);
      expect(result.detections[0].class).toBe('person');
      expect(result.detections[0].score).toBeGreaterThan(0.9);
      expect(rabbitmq.publishDetectionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          cameraId: 'test-camera-id',
          detections: expect.any(Array),
        })
      );
    });
    
    it('should filter out low confidence detections', async () => {
      // Arrange
      (tf.loadGraphModel as jest.Mock).mockResolvedValueOnce({
        executeAsync: jest.fn().mockResolvedValue([
          [[[0.1, 0.2, 0.5, 0.6]]], // Coordinates
          [[0.3]], // Low confidence score
          [[1]], // Class 1
          [1]
        ]),
        dispose: jest.fn(),
      });
      
      // Re-initialize with a threshold of 0.5
      await detectionManager.initialize({ detectionThreshold: 0.5 });
      
      const frameData = Buffer.from('test-frame-data');
      const frameMetadata = {
        frameId: 'test-frame-id',
        cameraId: 'test-camera-id',
        timestamp: new Date().toISOString(),
        width: 640,
        height: 480,
      };
      
      // Act
      const result = await detectionManager.detectObjects(frameData, frameMetadata);
      
      // Assert
      expect(result.detections).toHaveLength(0); // Should filter out the low confidence detection
    });
    
    it('should apply region of interest filtering', async () => {
      // Arrange
      await detectionManager.initialize({
        regionOfInterest: {
          x: 0.5, // Only detect in right half of the frame
          y: 0,
          width: 0.5,
          height: 1,
        },
      });
      
      // Mock a detection that is outside the ROI (on left side of frame)
      (tf.loadGraphModel as jest.Mock).mockResolvedValueOnce({
        executeAsync: jest.fn().mockResolvedValue([
          [[[0.1, 0.2, 0.4, 0.6]]], // Coordinates (on left side, outside ROI)
          [[0.95]], // High confidence
          [[1]], // Class 1
          [1]
        ]),
        dispose: jest.fn(),
      });
      
      const frameData = Buffer.from('test-frame-data');
      const frameMetadata = {
        frameId: 'test-frame-id',
        cameraId: 'test-camera-id',
        timestamp: new Date().toISOString(),
        width: 640,
        height: 480,
      };
      
      // Act
      const result = await detectionManager.detectObjects(frameData, frameMetadata);
      
      // Assert
      expect(result.detections).toHaveLength(0); // Should filter out detection outside ROI
    });
  });
  
  describe('shutdown', () => {
    it('should properly clean up resources', async () => {
      // Arrange
      await detectionManager.initialize();
      
      // Act
      await detectionManager.shutdown();
      
      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Detection manager shutdown complete')
      );
    });
  });
  
  // Additional tests for worker pool management, queue processing, etc.
});