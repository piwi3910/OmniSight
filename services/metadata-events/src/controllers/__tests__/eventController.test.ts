/**
 * Tests for the Event Controller
 */

import { mockRequest, mockResponse } from '../../test/utils/test-utils';
import * as eventController from '../eventController';

// Mock the event service
jest.mock('../../models/Event', () => ({
  findEvents: jest.fn(),
  findEventById: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
}));

// Import the mocked service
import * as Event from '../../models/Event';

describe('Event Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEvents', () => {
    it('should return a list of events', async () => {
      // Arrange
      const mockEvents = [
        { id: '1', name: 'Event 1', timestamp: new Date(), cameraId: 'cam1' },
        { id: '2', name: 'Event 2', timestamp: new Date(), cameraId: 'cam2' },
      ];
      
      (Event.findEvents as jest.Mock).mockResolvedValue(mockEvents);
      
      const req = mockRequest({
        query: { limit: '10', offset: '0' }
      });
      const res = mockResponse();
      
      // Act
      await eventController.getEvents(req, res as any);
      
      // Assert
      expect(Event.findEvents).toHaveBeenCalledWith(expect.objectContaining({
        limit: 10,
        offset: 0
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: mockEvents,
        count: mockEvents.length
      }));
    });
    
    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Database error');
      (Event.findEvents as jest.Mock).mockRejectedValue(error);
      
      const req = mockRequest();
      const res = mockResponse();
      
      // Act
      await eventController.getEvents(req, res as any);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
    });
  });
  
  describe('getEventById', () => {
    it('should return a single event', async () => {
      // Arrange
      const mockEvent = { 
        id: '1', 
        name: 'Event 1', 
        timestamp: new Date(), 
        cameraId: 'cam1' 
      };
      
      (Event.findEventById as jest.Mock).mockResolvedValue(mockEvent);
      
      const req = mockRequest({
        params: { id: '1' }
      });
      const res = mockResponse();
      
      // Act
      await eventController.getEventById(req, res as any);
      
      // Assert
      expect(Event.findEventById).toHaveBeenCalledWith('1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockEvent);
    });
    
    it('should return 404 if event not found', async () => {
      // Arrange
      (Event.findEventById as jest.Mock).mockResolvedValue(null);
      
      const req = mockRequest({
        params: { id: 'nonexistent' }
      });
      const res = mockResponse();
      
      // Act
      await eventController.getEventById(req, res as any);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('not found')
      }));
    });
  });
  
  // Additional test cases for createEvent, updateEvent, deleteEvent, etc.
});