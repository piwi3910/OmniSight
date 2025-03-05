import { RecordingManager } from '../recordingManager';
import * as storageManager from '../storageManager';
import * as rabbitmq from '../rabbitmq';
import * as fs from 'fs';
import * as path from 'path';
import { mockLogger } from '../../test/mocks/logger.mock';

// Mock dependencies
jest.mock('../storageManager', () => ({
  createStorageDirectory: jest.fn().mockResolvedValue('/storage/test-camera/test-recording'),
  saveSegment: jest.fn().mockResolvedValue('/storage/test-camera/test-recording/segment-1.mp4'),
  generateThumbnail: jest.fn().mockResolvedValue('/storage/test-camera/test-recording/thumbnail-1.jpg'),
  deleteRecording: jest.fn().mockResolvedValue(true),
  getRecordingSize: jest.fn().mockResolvedValue(1024 * 1024 * 10), // 10MB
}));

jest.mock('../rabbitmq', () => ({
  publishMessage: jest.fn().mockResolvedValue(undefined),
  subscribeToQueue: jest.fn().mockImplementation((queue, callback) => {
    // Store callback for testing
    rabbitmqCallbacks[queue] = callback;
    return { queue, consumerTag: 'mock-consumer' };
  }),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('test-frame-data')),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
  },
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  }),
}));

// Store RabbitMQ callbacks for testing
const rabbitmqCallbacks: { [queue: string]: Function } = {};

describe('RecordingManager', () => {
  let recordingManager: RecordingManager;
  const mockCameraId = 'test-camera';
  
  beforeEach(() => {
    jest.clearAllMocks();
    recordingManager = new RecordingManager(mockLogger);
  });
  
  describe('startRecording', () => {
    it('should start a new recording session', async () => {
      // Act
      const recordingId = await recordingManager.startRecording(mockCameraId, {
        segmentDuration: 60,
        maxDuration: 3600,
        quality: 'high',
      });
      
      // Assert
      expect(recordingId).toBeDefined();
      expect(storageManager.createStorageDirectory).toHaveBeenCalledWith(
        expect.stringContaining(mockCameraId),
        expect.any(String)
      );
      expect(rabbitmq.subscribeToQueue).toHaveBeenCalledWith(
        expect.stringContaining('frames'),
        expect.any(Function)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started recording'),
        expect.objectContaining({
          cameraId: mockCameraId,
          recordingId: recordingId,
        })
      );
    });
    
    it('should not start a duplicate recording for the same camera', async () => {
      // Arrange
      await recordingManager.startRecording(mockCameraId);
      
      // Act & Assert
      await expect(recordingManager.startRecording(mockCameraId))
        .rejects.toThrow('Recording already in progress');
    });
  });
  
  describe('stopRecording', () => {
    it('should stop an active recording session', async () => {
      // Arrange
      const recordingId = await recordingManager.startRecording(mockCameraId);
      
      // Act
      await recordingManager.stopRecording(recordingId);
      
      // Assert
      expect(rabbitmq.unsubscribe).toHaveBeenCalled();
      expect(rabbitmq.publishMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('events'),
        expect.objectContaining({
          type: 'RECORDING_COMPLETED',
          cameraId: mockCameraId,
          recordingId: recordingId,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recording completed'),
        expect.objectContaining({
          recordingId: recordingId,
        })
      );
    });
    
    it('should handle stopping a non-existent recording', async () => {
      // Act & Assert
      await expect(recordingManager.stopRecording('non-existent'))
        .rejects.toThrow('Recording not found');
    });
  });
  
  describe('pauseRecording', () => {
    it('should pause an active recording', async () => {
      // Arrange
      const recordingId = await recordingManager.startRecording(mockCameraId);
      
      // Act
      await recordingManager.pauseRecording(recordingId);
      
      // Assert
      expect(rabbitmq.unsubscribe).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recording paused'),
        expect.objectContaining({
          recordingId: recordingId,
        })
      );
    });
  });
  
  describe('resumeRecording', () => {
    it('should resume a paused recording', async () => {
      // Arrange
      const recordingId = await recordingManager.startRecording(mockCameraId);
      await recordingManager.pauseRecording(recordingId);
      
      // Act
      await recordingManager.resumeRecording(recordingId);
      
      // Assert
      expect(rabbitmq.subscribeToQueue).toHaveBeenCalledTimes(2); // Initial + resume
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recording resumed'),
        expect.objectContaining({
          recordingId: recordingId,
        })
      );
    });
  });
  
  describe('processFrame', () => {
    it('should process and save frames', async () => {
      // Arrange
      const recordingId = await recordingManager.startRecording(mockCameraId);
      const frameCallback = rabbitmqCallbacks['camera.test-camera.frames'];
      const mockFrameMessage = {
        content: Buffer.from(JSON.stringify({
          cameraId: mockCameraId,
          timestamp: new Date().toISOString(),
          frameNumber: 1,
          data: Buffer.from('test-frame-data').toString('base64'),
        })),
        properties: {},
        fields: {},
      };
      
      // Act
      await frameCallback(mockFrameMessage);
      
      // Assert - This is testing internal functionality, but we can check if logger was called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Processed frame'),
        expect.any(Object)
      );
    });
  });
  
  describe('getRecordingStatus', () => {
    it('should return status for an active recording', async () => {
      // Arrange
      const recordingId = await recordingManager.startRecording(mockCameraId);
      
      // Act
      const status = recordingManager.getRecordingStatus(recordingId);
      
      // Assert
      expect(status).toEqual(expect.objectContaining({
        recordingId,
        cameraId: mockCameraId,
        status: 'active',
        startTime: expect.any(Date),
        segmentCount: expect.any(Number),
      }));
    });
    
    it('should return null for a non-existent recording', () => {
      // Act
      const status = recordingManager.getRecordingStatus('non-existent');
      
      // Assert
      expect(status).toBeNull();
    });
  });
  
  describe('getActiveRecordings', () => {
    it('should list all active recordings', async () => {
      // Arrange
      const recordingId1 = await recordingManager.startRecording('camera-1');
      const recordingId2 = await recordingManager.startRecording('camera-2');
      
      // Act
      const activeRecordings = recordingManager.getActiveRecordings();
      
      // Assert
      expect(activeRecordings).toHaveLength(2);
      expect(activeRecordings.some(r => r.recordingId === recordingId1)).toBe(true);
      expect(activeRecordings.some(r => r.recordingId === recordingId2)).toBe(true);
    });
  });
  
  describe('cleanup', () => {
    it('should stop all active recordings', async () => {
      // Arrange
      await recordingManager.startRecording('camera-1');
      await recordingManager.startRecording('camera-2');
      
      // Act
      await recordingManager.cleanup();
      
      // Assert
      expect(rabbitmq.unsubscribe).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recording manager shutdown complete')
      );
    });
  });
  
  // Additional tests for segment management, retention policy, etc. would go here
});