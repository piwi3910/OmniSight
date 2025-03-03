import { PrismaClient, Event, DetectedObject, Recording, Camera } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { WebSocketService } from './webSocketService';
import config from '../config/config';

// Initialize Prisma client
const prisma = new PrismaClient();

// Export types for use in controllers
export type EventWithRelations = Event & {
  detectedObjects?: DetectedObject[];
  recording?: Recording & {
    camera?: Camera;
  };
};

export type EventFilters = {
  cameraId?: string;
  recordingId?: string;
  eventType?: string;
  startTime?: Date;
  endTime?: Date;
  minConfidence?: number;
  maxConfidence?: number;
  objectTypes?: string[];
  objectCount?: { min?: number; max?: number };
  objectPosition?: string;
  hasMetadata?: boolean;
  metadata?: Record<string, any>;
  page?: number;
  limit?: number;
};

export type EventCreateInput = {
  recordingId: string;
  timestamp: Date;
  eventType: string;
  confidence: number;
  thumbnailPath?: string;
  metadata?: any;
  detectedObjects?: {
    objectType: string;
    confidence: number;
    boundingBox: any;
    metadata?: any;
  }[];
};

export type EventUpdateInput = {
  eventType?: string;
  confidence?: number;
  thumbnailPath?: string;
  metadata?: any;
};

class EventService {
  private webSocketService: WebSocketService;

  constructor() {
    this.webSocketService = new WebSocketService(config.webSocket.port);
  }

  /**
   * Get all events with advanced filtering
   */
  async getAllEvents(filters: EventFilters) {
    const {
      cameraId,
      recordingId,
      eventType,
      startTime,
      endTime,
      minConfidence = 0,
      maxConfidence = 1,
      objectTypes = [],
      objectCount,
      objectPosition,
      hasMetadata,
      metadata,
      page = 1,
      limit = 10
    } = filters;

    try {
      // Build where clause based on filters
      const where: any = {};
      
      // Basic filters
      if (recordingId) {
        where.recordingId = recordingId;
      }
      
      if (eventType) {
        where.eventType = eventType;
      }
      
      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) {
          where.timestamp.gte = startTime;
        }
        if (endTime) {
          where.timestamp.lte = endTime;
        }
      }
      
      if (minConfidence > 0 || maxConfidence < 1) {
        where.confidence = {};
        if (minConfidence > 0) {
          where.confidence.gte = minConfidence;
        }
        if (maxConfidence < 1) {
          where.confidence.lte = maxConfidence;
        }
      }

      // Advanced filters
      
      // Camera ID filter (join through recording)
      if (cameraId) {
        where.recording = {
          cameraId: cameraId
        };
      }
      
      // Object type filter
      if (objectTypes && objectTypes.length > 0) {
        where.detectedObjects = {
          some: {
            objectType: {
              in: objectTypes
            }
          }
        };
      }
      
      // Object count filter
      if (objectCount) {
        const countWhere: any = {};
        
        if (objectCount.min !== undefined) {
          countWhere._count = { gte: objectCount.min };
        }
        
        if (objectCount.max !== undefined) {
          countWhere._count = { ...countWhere._count, lte: objectCount.max };
        }
        
        if (Object.keys(countWhere).length > 0) {
          where.detectedObjects = {
            ...where.detectedObjects,
            ...countWhere
          };
        }
      }
      
      // Object position filter
      if (objectPosition) {
        const positionWhere = this.getPositionFilter(objectPosition);
        
        if (positionWhere) {
          where.detectedObjects = {
            some: {
              ...where.detectedObjects?.some,
              boundingBox: positionWhere
            }
          };
        }
      }
      
      // Metadata filters
      if (hasMetadata) {
        where.metadata = {
          not: null
        };
      }
      
      if (metadata && Object.keys(metadata).length > 0) {
        // Convert simple key-value pairs to Prisma JSON query format
        Object.entries(metadata).forEach(([key, value]) => {
          where[`metadata->>${key}`] = value;
        });
      }

      // Get total count for pagination
      const total = await prisma.event.count({ where });
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      // Get events with pagination
      const events = await prisma.event.findMany({
        where,
        include: {
          recording: {
            include: {
              camera: true
            }
          },
          detectedObjects: true
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      });
      
      return { events, total, pages };
    } catch (error) {
      logger.error('Error getting events with filters:', error);
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<EventWithRelations | null> {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          recording: {
            include: {
              camera: true
            }
          },
          detectedObjects: true
        }
      });
      
      return event;
    } catch (error) {
      logger.error(`Error getting event by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new event
   */
  async createEvent(data: EventCreateInput): Promise<EventWithRelations> {
    try {
      // First check if the recording exists
      const recording = await prisma.recording.findUnique({
        where: { id: data.recordingId },
        include: { camera: true }
      });
      
      if (!recording) {
        throw new Error(`Recording with ID ${data.recordingId} not found`);
      }
      
      // Create event
      const event = await prisma.event.create({
        data: {
          id: uuidv4(),
          recordingId: data.recordingId,
          timestamp: data.timestamp,
          eventType: data.eventType,
          confidence: data.confidence,
          thumbnailPath: data.thumbnailPath,
          metadata: data.metadata,
          detectedObjects: {
            create: data.detectedObjects?.map(obj => ({
              id: uuidv4(),
              objectType: obj.objectType,
              confidence: obj.confidence,
              boundingBox: obj.boundingBox,
              metadata: obj.metadata
            })) || []
          }
        },
        include: {
          detectedObjects: true
        }
      });
      
      // Emit event through WebSocket
      this.webSocketService.emitEvent('event:created', {
        id: event.id,
        timestamp: event.timestamp,
        type: event.eventType,
        confidence: event.confidence,
        thumbnailPath: event.thumbnailPath,
        cameraId: recording.cameraId,
        cameraName: recording.camera?.name,
        recordingId: data.recordingId
      });
      
      return event;
    } catch (error) {
      logger.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Update an event
   */
  async updateEvent(id: string, data: EventUpdateInput): Promise<Event> {
    try {
      const event = await prisma.event.update({
        where: { id },
        data: {
          eventType: data.eventType,
          confidence: data.confidence,
          thumbnailPath: data.thumbnailPath,
          metadata: data.metadata,
          updatedAt: new Date()
        }
      });
      
      // Emit event through WebSocket
      this.webSocketService.emitEvent('event:updated', {
        id: event.id,
        type: event.eventType,
        confidence: event.confidence
      });
      
      return event;
    } catch (error) {
      logger.error(`Error updating event ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string): Promise<void> {
    try {
      // First delete all associated detected objects
      await prisma.detectedObject.deleteMany({
        where: { eventId: id }
      });
      
      // Then delete the event
      await prisma.event.delete({
        where: { id }
      });
      
      // Emit event through WebSocket
      this.webSocketService.emitEvent('event:deleted', { id });
    } catch (error) {
      logger.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get events by camera ID
   */
  async getEventsByCamera(cameraId: string, filters: EventFilters) {
    const {
      eventType,
      startTime,
      endTime,
      minConfidence,
      page = 1,
      limit = 10
    } = filters;
    
    try {
      // Check if camera exists
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId }
      });
      
      if (!camera) {
        throw new Error(`Camera with ID ${cameraId} not found`);
      }
      
      // Build where clause
      const where: any = {
        recording: {
          cameraId: cameraId
        }
      };
      
      if (eventType) {
        where.eventType = eventType;
      }
      
      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) {
          where.timestamp.gte = startTime;
        }
        if (endTime) {
          where.timestamp.lte = endTime;
        }
      }
      
      if (minConfidence) {
        where.confidence = {
          gte: minConfidence
        };
      }
      
      // Get total count for pagination
      const total = await prisma.event.count({ where });
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      // Get events with pagination
      const events = await prisma.event.findMany({
        where,
        include: {
          detectedObjects: true
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      });
      
      return { events, camera, total, pages };
    } catch (error) {
      logger.error(`Error getting events for camera ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Get events by recording ID
   */
  async getEventsByRecording(recordingId: string, filters: EventFilters) {
    const {
      eventType,
      page = 1,
      limit = 10
    } = filters;
    
    try {
      // Check if recording exists
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
        include: { camera: true }
      });
      
      if (!recording) {
        throw new Error(`Recording with ID ${recordingId} not found`);
      }
      
      // Build where clause
      const where: any = {
        recordingId: recordingId
      };
      
      if (eventType) {
        where.eventType = eventType;
      }
      
      // Get total count for pagination
      const total = await prisma.event.count({ where });
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      // Get events with pagination
      const events = await prisma.event.findMany({
        where,
        include: {
          detectedObjects: true
        },
        orderBy: {
          timestamp: 'asc'
        },
        skip: (page - 1) * limit,
        take: limit
      });
      
      return { events, recording, total, pages };
    } catch (error) {
      logger.error(`Error getting events for recording ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Get latest events (for real-time updates)
   */
  async getLatestEvents(limit: number = 10): Promise<EventWithRelations[]> {
    try {
      const events = await prisma.event.findMany({
        include: {
          recording: {
            include: {
              camera: true
            }
          },
          detectedObjects: true
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });
      
      return events;
    } catch (error) {
      logger.error('Error getting latest events:', error);
      throw error;
    }
  }

  /**
   * Get events count by type
   */
  async getEventCountsByType(startTime?: Date, endTime?: Date): Promise<Record<string, number>> {
    try {
      const where: any = {};
      
      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) {
          where.timestamp.gte = startTime;
        }
        if (endTime) {
          where.timestamp.lte = endTime;
        }
      }
      
      const events = await prisma.event.groupBy({
        by: ['eventType'],
        _count: {
          eventType: true
        },
        where
      });
      
      // Convert to simple object
      const counts: Record<string, number> = {};
      events.forEach(e => {
        counts[e.eventType] = e._count.eventType;
      });
      
      return counts;
    } catch (error) {
      logger.error('Error getting event counts by type:', error);
      throw error;
    }
  }

  /**
   * Apply retention policy (delete old events)
   */
  async applyRetentionPolicy(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      // Find events to delete
      const eventsToDelete = await prisma.event.findMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        },
        select: {
          id: true
        }
      });
      
      const eventIds = eventsToDelete.map(e => e.id);
      
      // Delete detected objects first
      await prisma.detectedObject.deleteMany({
        where: {
          eventId: {
            in: eventIds
          }
        }
      });
      
      // Delete events
      const result = await prisma.event.deleteMany({
        where: {
          id: {
            in: eventIds
          }
        }
      });
      
      logger.info(`Applied retention policy: deleted ${result.count} events older than ${retentionDays} days`);
      
      return result.count;
    } catch (error) {
      logger.error('Error applying retention policy:', error);
      throw error;
    }
  }

  /**
   * Search events by object types (advanced search)
   */
  async searchEventsByObjectTypes(objectTypes: string[], filters: EventFilters = {}) {
    try {
      const {
        startTime,
        endTime,
        minConfidence = 0,
        page = 1,
        limit = 10
      } = filters;
      
      // Build where clause
      const where: any = {
        detectedObjects: {
          some: {
            objectType: {
              in: objectTypes
            }
          }
        }
      };
      
      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) {
          where.timestamp.gte = startTime;
        }
        if (endTime) {
          where.timestamp.lte = endTime;
        }
      }
      
      if (minConfidence > 0) {
        where.detectedObjects = {
          some: {
            ...where.detectedObjects.some,
            confidence: {
              gte: minConfidence
            }
          }
        };
      }
      
      // Get total count for pagination
      const total = await prisma.event.count({ where });
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      // Get events with pagination
      const events = await prisma.event.findMany({
        where,
        include: {
          recording: {
            include: {
              camera: true
            }
          },
          detectedObjects: true
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      });
      
      return { events, total, pages };
    } catch (error) {
      logger.error('Error searching events by object types:', error);
      throw error;
    }
  }

  /**
   * Export events to CSV or JSON
   */
  async exportEvents(filters: EventFilters, format: 'csv' | 'json' = 'json') {
    try {
      const { events } = await this.getAllEvents({
        ...filters,
        page: 1,
        limit: 1000 // Increased limit for exports
      });
      
      if (format === 'json') {
        return JSON.stringify(events.map(event => ({
          id: event.id,
          timestamp: event.timestamp,
          type: event.eventType,
          confidence: event.confidence,
          cameraName: event.recording?.camera?.name,
          recordingId: event.recordingId,
          objects: event.detectedObjects?.map(obj => obj.objectType).join(', '),
          createdAt: event.createdAt
        })));
      } else {
        // CSV format
        const header = 'id,timestamp,type,confidence,camera,recordingId,objects,createdAt\n';
        const rows = events.map(event => {
          const objects = event.detectedObjects?.map(obj => obj.objectType).join('|');
          return `${event.id},${event.timestamp.toISOString()},${event.eventType},${event.confidence},${event.recording?.camera?.name || ''},${event.recordingId},${objects || ''},${event.createdAt.toISOString()}`;
        }).join('\n');
        
        return header + rows;
      }
    } catch (error) {
      logger.error('Error exporting events:', error);
      throw error;
    }
  }

  /**
   * Helper method to translate position filter to bounding box constraints
   */
  private getPositionFilter(position: string) {
    // Position can be: center, top, bottom, left, right
    switch (position.toLowerCase()) {
      case 'center':
        // Center means x and y are around 0.5 (normalized coordinates)
        return {
          path: ['x'],
          gte: 0.3,
          lte: 0.7
        };
      case 'top':
        // Top means y is close to 0
        return {
          path: ['y'],
          lte: 0.3
        };
      case 'bottom':
        // Bottom means y is close to 1
        return {
          path: ['y'],
          gte: 0.7
        };
      case 'left':
        // Left means x is close to 0
        return {
          path: ['x'],
          lte: 0.3
        };
      case 'right':
        // Right means x is close to 1
        return {
          path: ['x'],
          gte: 0.7
        };
      default:
        return null;
    }
  }
}

export const eventService = new EventService();