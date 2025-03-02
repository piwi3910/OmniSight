import { Event, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import logger from '../utils/logger';

export interface CreateEventInput {
  recordingId: string;
  timestamp: Date;
  eventType: string;
  confidence: number;
  metadata?: Record<string, any>;
  thumbnailPath?: string;
}

export interface UpdateEventInput {
  eventType?: string;
  confidence?: number;
  metadata?: Record<string, any>;
  thumbnailPath?: string;
}

/**
 * Repository class for Event operations
 */
export class EventRepository {
  /**
   * Create a new event
   */
  async create(data: CreateEventInput): Promise<Event> {
    try {
      return await prisma.event.create({
        data
      });
    } catch (error) {
      logger.error('Failed to create event:', error);
      throw error;
    }
  }

  /**
   * Get an event by ID
   */
  async findById(id: string): Promise<Event | null> {
    try {
      return await prisma.event.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to find event with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all events with optional filters
   */
  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.EventWhereInput;
    orderBy?: Prisma.EventOrderByWithRelationInput;
  }): Promise<Event[]> {
    const { skip, take, where, orderBy } = params;
    
    try {
      return await prisma.event.findMany({
        skip,
        take,
        where,
        orderBy
      });
    } catch (error) {
      logger.error('Failed to find events:', error);
      throw error;
    }
  }

  /**
   * Update an event
   */
  async update(id: string, data: UpdateEventInput): Promise<Event> {
    try {
      return await prisma.event.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error(`Failed to update event with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async delete(id: string): Promise<Event> {
    try {
      return await prisma.event.delete({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to delete event with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Count events with optional filters
   */
  async count(where?: Prisma.EventWhereInput): Promise<number> {
    try {
      return await prisma.event.count({ where });
    } catch (error) {
      logger.error('Failed to count events:', error);
      throw error;
    }
  }

  /**
   * Find events with detected objects (with relations)
   */
  async findWithDetectedObjects(id: string): Promise<Event | null> {
    try {
      return await prisma.event.findUnique({
        where: { id },
        include: {
          detectedObjects: true
        }
      });
    } catch (error) {
      logger.error(`Failed to find event with detected objects for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find events by recording ID
   */
  async findByRecordingId(recordingId: string): Promise<Event[]> {
    try {
      return await prisma.event.findMany({
        where: { recordingId },
        orderBy: { timestamp: 'asc' }
      });
    } catch (error) {
      logger.error(`Failed to find events for recording ID ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Find events by time range
   */
  async findByTimeRange(startTime: Date, endTime: Date): Promise<Event[]> {
    try {
      return await prisma.event.findMany({
        where: {
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        },
        orderBy: { timestamp: 'asc' }
      });
    } catch (error) {
      logger.error(`Failed to find events in time range:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const eventRepository = new EventRepository();