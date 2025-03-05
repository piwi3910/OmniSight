import * as streamHandler from '../streamHandler';
import { mockLogger } from '../../test/mocks/logger.mock';
import * as streamController from '../../controllers/streamController';
import { RabbitMQManager } from '@omnisight/shared';

// Mock dependencies
jest.mock('@omnisight/shared', () => ({
  RabbitMQManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    setupTopology: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    createMessage: jest.fn().mockReturnValue({ type: 'TEST', payload: {} }),
  })),
  MessageType: {
    STREAM_STARTED: 'STREAM_STARTED',
    STREAM_STOPPED: 'STREAM_STOPPED',
    STREAM_ERROR: 'STREAM_ERROR',
    STREAM_FRAME: 'STREAM_FRAME',
  }
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

jest.mock('../../controllers/streamController', () => ({
  getCameraById: jest.fn(),
  updateStreamStatus: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node-rtsp-stream', () => {
  return {
    Stream: jest.fn().mockImplementation(() => ({
      cameraId: 'test-camera-id',
      streamUrl: 'rtsp://example.com/stream',
      start: jest.fn(),
      stop: jest.fn(),
    })),
  };
});

jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    inputOptions: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    outputFormat: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockReturnThis(),
    kill: jest.fn(),
  }));
});

describe('Stream Handler', () => {
  const mockCameraId = 'test-camera-id';
  const mockStreamUrl = 'rtsp://example.com/stream';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock camera data
    (streamController.getCameraById as jest.Mock).mockResolvedValue({
      id: mockCameraId,
      name: 'Test Camera',
      url: mockStreamUrl,
      status: 'ONLINE',
    });
  });
  
  describe('initializeRabbitMQ', () => {
    it('should initialize RabbitMQ connection', async () => {
      // Act
      await streamHandler.initializeRabbitMQ();
      
      // Assert
      expect(RabbitMQManager).toHaveBeenCalled();
      const mockRabbitMQInstance = (RabbitMQManager as jest.Mock).mock.instances[0];
      expect(mockRabbitMQInstance.connect).toHaveBeenCalled();
      expect(mockRabbitMQInstance.setupTopology).toHaveBeenCalled();
    });
    
    it('should handle initialization errors', async () => {
      // Arrange
      const connectionError = new Error('Connection failed');
      (RabbitMQManager as unknown as jest.Mock).mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(connectionError),
        setupTopology: jest.fn(),
      }));
      
      // Act & Assert
      await expect(streamHandler.initializeRabbitMQ()).rejects.toThrow('Connection failed');
    });
  });
  
  describe('startStream', () => {
    it('should start a new stream successfully', async () => {
      // Arrange
      await streamHandler.initializeRabbitMQ();
      
      // Act
      const streamId = await streamHandler.startStream(mockCameraId, mockStreamUrl);
      
      // Assert
      expect(streamId).toBeDefined();
      expect(typeof streamId).toBe('string');
      expect(streamController.updateStreamStatus).toHaveBeenCalledWith(
        streamId,
        expect.objectContaining({
          cameraId: mockCameraId,
          status: 'active',
        })
      );
    });
    
    it('should handle errors when camera is not found', async () => {
      // Arrange
      (streamController.getCameraById as jest.Mock).mockResolvedValue(null);
      
      // Act & Assert
      await expect(streamHandler.startStream(mockCameraId, mockStreamUrl))
        .rejects.toThrow(`Camera with ID ${mockCameraId} not found`);
    });
  });
  
  describe('stopStream', () => {
    it('should stop an active stream', async () => {
      // Arrange
      await streamHandler.initializeRabbitMQ();
      const streamId = await streamHandler.startStream(mockCameraId, mockStreamUrl);
      
      // Act
      await streamHandler.stopStream(streamId);
      
      // Assert
      expect(streamController.updateStreamStatus).toHaveBeenCalledWith(
        streamId,
        expect.objectContaining({
          status: 'stopped',
          endedAt: expect.any(Date),
        })
      );
    });
    
    it('should handle requests to stop non-existent streams', async () => {
      // Act
      await streamHandler.stopStream('non-existent-stream');
      
      // Assert
      // Should not throw and just log a warning
      expect(streamController.updateStreamStatus).not.toHaveBeenCalled();
    });
  });
  
  describe('getStreamStatus', () => {
    it('should return status for an active stream', async () => {
      // Arrange
      await streamHandler.initializeRabbitMQ();
      const streamId = await streamHandler.startStream(mockCameraId, mockStreamUrl);
      
      // Act
      const status = streamHandler.getStreamStatus(streamId);
      
      // Assert
      expect(status).toEqual(expect.objectContaining({
        streamId,
        cameraId: mockCameraId,
        status: expect.any(String),
        frameCount: expect.any(Number),
        startTime: expect.any(Date),
        lastFrameTime: expect.any(Date),
        uptime: expect.any(Number),
      }));
    });
    
    it('should return null for non-existent streams', () => {
      // Act
      const status = streamHandler.getStreamStatus('non-existent-stream');
      
      // Assert
      expect(status).toBeNull();
    });
  });
  
  describe('getActiveStreams', () => {
    it('should return all active streams', async () => {
      // Arrange
      await streamHandler.initializeRabbitMQ();
      const streamId1 = await streamHandler.startStream(mockCameraId, mockStreamUrl);
      const streamId2 = await streamHandler.startStream('camera-2', 'rtsp://example.com/camera2');
      
      // Act
      const activeStreams = streamHandler.getActiveStreams();
      
      // Assert
      expect(activeStreams.size).toBe(2);
      expect(activeStreams.has(streamId1)).toBe(true);
      expect(activeStreams.has(streamId2)).toBe(true);
    });
  });
});