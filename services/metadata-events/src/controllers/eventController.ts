import { Request, Response } from 'express';
import { eventService, EventWithRelations } from '../services/eventService';
import logger from '../utils/logger';

/**
 * Get all events with pagination and filtering
 */
export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const {
      cameraId,
      recordingId,
      type,
      startTime,
      endTime,
      page = 1,
      limit = 10
    } = req.query;
    
    // Call service method with parsed parameters
    const { events, total, pages } = await eventService.getAllEvents({
      cameraId: cameraId as string,
      recordingId: recordingId as string,
      eventType: type as string,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      page: Number(page),
      limit: Number(limit)
    });
    
    // Format response to maintain API compatibility
    const formattedEvents = events.map((event: EventWithRelations) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.eventType,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      cameraId: event.recording?.camera?.id,
      cameraName: event.recording?.camera?.name,
      recordingId: event.recordingId,
      detectedObjects: event.detectedObjects?.map((obj) => ({
        id: obj.id,
        type: obj.objectType,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    }));
    
    return res.status(200).json({
      events: formattedEvents,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages
      }
    });
  } catch (error) {
    logger.error('Error getting events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a single event by ID
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const event = await eventService.getEventById(id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Format response to maintain API compatibility
    const formattedEvent = {
      id: event.id,
      timestamp: event.timestamp,
      type: event.eventType,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      metadata: event.metadata,
      camera: {
        id: event.recording?.camera?.id,
        name: event.recording?.camera?.name,
        location: event.recording?.camera?.location
      },
      recording: {
        id: event.recordingId,
        startTime: event.recording?.startTime,
        endTime: event.recording?.endTime
      },
      detectedObjects: event.detectedObjects?.map((obj) => ({
        id: obj.id,
        type: obj.objectType,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    };
    
    return res.status(200).json(formattedEvent);
  } catch (error) {
    logger.error('Error getting event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new event
 */
export const createEvent = async (req: Request, res: Response) => {
  try {
    const {
      recordingId,
      timestamp,
      type,
      confidence,
      thumbnailPath,
      metadata,
      detectedObjects
    } = req.body;
    
    // Validate required fields
    if (!recordingId || !timestamp || !type) {
      return res.status(400).json({ error: 'recordingId, timestamp, and type are required' });
    }
    
    // Convert detected objects to the format expected by the service
    const formattedDetectedObjects = detectedObjects?.map((obj: any) => ({
      objectType: obj.type,
      confidence: obj.confidence,
      boundingBox: obj.boundingBox,
      metadata: obj.metadata
    }));
    
    // Call service to create event
    const event = await eventService.createEvent({
      recordingId,
      timestamp: new Date(timestamp),
      eventType: type,
      confidence: confidence || 0,
      thumbnailPath,
      metadata,
      detectedObjects: formattedDetectedObjects
    });
    
    // Format response
    const formattedEvent = {
      id: event.id,
      timestamp: event.timestamp,
      type: event.eventType,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      recordingId: event.recordingId,
      detectedObjects: event.detectedObjects?.map((obj) => ({
        id: obj.id,
        type: obj.objectType,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    };
    
    return res.status(201).json(formattedEvent);
  } catch (error) {
    logger.error('Error creating event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update an event
 */
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      type,
      confidence,
      thumbnailPath,
      metadata
    } = req.body;
    
    // Call service to update event
    const event = await eventService.updateEvent(id, {
      eventType: type,
      confidence,
      thumbnailPath,
      metadata
    });
    
    // Get the updated event with detected objects
    const updatedEvent = await eventService.getEventById(id);
    
    if (!updatedEvent) {
      return res.status(404).json({ error: 'Event not found after update' });
    }
    
    // Format response
    const formattedEvent = {
      id: updatedEvent.id,
      timestamp: updatedEvent.timestamp,
      type: updatedEvent.eventType,
      confidence: updatedEvent.confidence,
      thumbnailPath: updatedEvent.thumbnailPath,
      metadata: updatedEvent.metadata,
      recordingId: updatedEvent.recordingId,
      detectedObjects: updatedEvent.detectedObjects?.map((obj) => ({
        id: obj.id,
        type: obj.objectType,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: updatedEvent.createdAt,
      updatedAt: updatedEvent.updatedAt
    };
    
    return res.status(200).json(formattedEvent);
  } catch (error) {
    logger.error('Error updating event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete an event
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Call service to delete event
    await eventService.deleteEvent(id);
    
    return res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    logger.error('Error deleting event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get events by camera ID
 */
export const getEventsByCamera = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const {
      type,
      startTime,
      endTime,
      page = 1,
      limit = 10
    } = req.query;
    
    // Call service to get events by camera
    const { events, camera, total, pages } = await eventService.getEventsByCamera(cameraId, {
      eventType: type as string,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      page: Number(page),
      limit: Number(limit)
    });
    
    // Format response
    const formattedEvents = events.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.eventType,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      recordingId: event.recordingId,
      detectedObjects: event.detectedObjects?.map((obj) => ({
        id: obj.id,
        type: obj.objectType,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    }));
    
    return res.status(200).json({
      events: formattedEvents,
      camera: {
        id: camera.id,
        name: camera.name,
        location: camera.location
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages
      }
    });
  } catch (error) {
    logger.error('Error getting events by camera:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get events by recording ID
 */
export const getEventsByRecording = async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const {
      type,
      page = 1,
      limit = 10
    } = req.query;
    
    // Call service to get events by recording
    const { events, recording, total, pages } = await eventService.getEventsByRecording(recordingId, {
      eventType: type as string,
      page: Number(page),
      limit: Number(limit)
    });
    
    // Format response
    const formattedEvents = events.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.eventType,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      detectedObjects: event.detectedObjects?.map((obj) => ({
        id: obj.id,
        type: obj.objectType,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    }));
    
    return res.status(200).json({
      events: formattedEvents,
      recording: {
        id: recording.id,
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        camera: recording.camera
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages
      }
    });
  } catch (error) {
    logger.error('Error getting events by recording:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};