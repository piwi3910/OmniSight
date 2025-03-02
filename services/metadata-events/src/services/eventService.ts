import { Event, Prisma, DetectedObject, Recording, Camera } from '@prisma/client';
import { eventRepository, CreateEventInput, UpdateEventInput } from '../repositories/eventRepository';
import prisma from '../prisma/client';
import logger from '../utils/logger';

interface DetectedObjectInput {
  objectType: string;
  confidence: number;
  boundingBox: Record<string, any>;
  metadata?: Record<string, any>;
}

interface CreateEventWithObjectsInput extends CreateEventInput {
  detectedObjects?: DetectedObjectInput[];
}

// Enhanced types with relations
export interface EventWithRelations extends Event {
  detectedObjects: DetectedObject[];
  recording?: RecordingWithCamera;
}

export interface RecordingWithCamera extends Recording {
  camera?: Camera;
}

export interface EventsResult {
  events: EventWithRelations[];
  total: number;
  pages: number;
}

export interface CameraEventsResult {
  events: EventWithRelations[];
  camera: Camera;
  total: number;
  pages: number;
}

export interface RecordingEventsResult {
  events: EventWithRelations[];
  recording: RecordingWithCamera;
  total: number;
  pages: number;
}

/**
 * Service class for Event business logic
 */
export class EventService {
  /**
   * Create a new event with optional detected objects
   */
  async createEvent(eventData: CreateEventWithObjectsInput): Promise<EventWithRelations> {
    try {
      logger.info(`Creating new event for recording: ${eventData.recordingId}`);
      
      // Use a transaction to ensure all operations succeed or fail together
      return await prisma.$transaction(async (tx) => {
        // Create the event
        const event = await tx.event.create({
          data: {
            recordingId: eventData.recordingId,
            timestamp: eventData.timestamp,
            eventType: eventData.eventType,
            confidence: eventData.confidence,
            metadata: eventData.metadata ? eventData.metadata : undefined,
            thumbnailPath: eventData.thumbnailPath
          }
        });
        
        // Create any detected objects if provided
        if (eventData.detectedObjects && eventData.detectedObjects.length > 0) {
          await Promise.all(
            eventData.detectedObjects.map(obj => 
              tx.detectedObject.create({
                data: {
                  eventId: event.id,
                  objectType: obj.objectType,
                  confidence: obj.confidence,
                  boundingBox: obj.boundingBox,
                  metadata: obj.metadata
                }
              })
            )
          );
        }
        
        // Return the created event with its detected objects
        return tx.event.findUniqueOrThrow({
          where: { id: event.id },
          include: {
            detectedObjects: true
          }
        }) as unknown as EventWithRelations;
      });
    } catch (error) {
      logger.error('Error in createEvent service:', error);
      throw error;
    }
  }

  /**
   * Get event by ID with all relations
   */
  async getEventById(id: string): Promise<EventWithRelations | null> {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          detectedObjects: true,
          recording: {
            include: {
              camera: true
            }
          }
        }
      });
      
      return event as unknown as EventWithRelations | null;
    } catch (error) {
      logger.error(`Error getting event by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all events with filtering and pagination
   */
  async getAllEvents(params: {
    cameraId?: string;
    recordingId?: string;
    eventType?: string;
    startTime?: Date;
    endTime?: Date;
    page?: number;
    limit?: number;
  }): Promise<EventsResult> {
    try {
      const { cameraId, recordingId, eventType, startTime, endTime, page = 1, limit = 10 } = params;
      
      // Build the where clause
      let whereClause: Prisma.EventWhereInput = {};
      
      if (recordingId) {
        whereClause.recordingId = recordingId;
      }
      
      if (eventType) {
        whereClause.eventType = eventType;
      }
      
      if (cameraId) {
        // If camera ID is provided, we need to find events for recordings from that camera
        whereClause.recording = {
          cameraId
        };
      }
      
      // Add time range filter if provided
      if (startTime || endTime) {
        whereClause.timestamp = {};
        
        if (startTime) {
          whereClause.timestamp.gte = startTime;
        }
        
        if (endTime) {
          whereClause.timestamp.lte = endTime;
        }
      }
      
      // Get total count for pagination
      const total = await prisma.event.count({ where: whereClause });
      
      // Calculate pagination values
      const skip = (page - 1) * limit;
      const pages = Math.ceil(total / limit);
      
      // Get events with pagination
      const events = await prisma.event.findMany({
        where: whereClause,
        include: {
          detectedObjects: true,
          recording: {
            include: {
              camera: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip,
        take: limit
      });
      
      return {
        events: events as unknown as EventWithRelations[],
        total,
        pages
      };
    } catch (error) {
      logger.error('Error getting all events:', error);
      throw error;
    }
  }

  /**
   * Update event by ID
   */
  async updateEvent(id: string, eventData: UpdateEventInput): Promise<Event> {
    try {
      logger.info(`Updating event with ID ${id}`);
      return await eventRepository.update(id, eventData);
    } catch (error) {
      logger.error(`Error updating event ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete event by ID
   */
  async deleteEvent(id: string): Promise<Event> {
    try {
      logger.info(`Deleting event with ID ${id}`);
      return await eventRepository.delete(id);
    } catch (error) {
      logger.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get events by camera ID
   */
  async getEventsByCamera(cameraId: string, params: {
    eventType?: string;
    startTime?: Date;
    endTime?: Date;
    page?: number;
    limit?: number;
  }): Promise<CameraEventsResult> {
    try {
      // First check if camera exists
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId }
      });
      
      if (!camera) {
        throw new Error(`Camera with ID ${cameraId} not found`);
      }
      
      // Get events by camera ID
      const { events, total, pages } = await this.getAllEvents({
        ...params,
        cameraId
      });
      
      return {
        events,
        camera,
        total,
        pages
      };
    } catch (error) {
      logger.error(`Error getting events by camera ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Get events by recording ID
   */
  async getEventsByRecording(recordingId: string, params: {
    eventType?: string;
    page?: number;
    limit?: number;
  }): Promise<RecordingEventsResult> {
    try {
      // First check if recording exists
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
        include: {
          camera: true
        }
      });
      
      if (!recording) {
        throw new Error(`Recording with ID ${recordingId} not found`);
      }
      
      // Get events by recording ID
      const { events, total, pages } = await this.getAllEvents({
        ...params,
        recordingId
      });
      
      return {
        events,
        recording: recording as unknown as RecordingWithCamera,
        total,
        pages
      };
    } catch (error) {
      logger.error(`Error getting events by recording ${recordingId}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const eventService = new EventService();