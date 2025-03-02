import { Recording, RecordingStatus, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import logger from '../utils/logger';

export interface CreateRecordingInput {
  cameraId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status?: RecordingStatus;
  metadata?: Record<string, any>;
}

export interface UpdateRecordingInput {
  endTime?: Date;
  duration?: number;
  status?: RecordingStatus;
  metadata?: Record<string, any>;
}

/**
 * Repository class for Recording operations
 */
export class RecordingRepository {
  /**
   * Create a new recording
   */
  async create(data: CreateRecordingInput): Promise<Recording> {
    try {
      return await prisma.recording.create({
        data
      });
    } catch (error) {
      logger.error('Failed to create recording:', error);
      throw error;
    }
  }

  /**
   * Get a recording by ID
   */
  async findById(id: string): Promise<Recording | null> {
    try {
      return await prisma.recording.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to find recording with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all recordings with optional filters
   */
  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.RecordingWhereInput;
    orderBy?: Prisma.RecordingOrderByWithRelationInput;
  }): Promise<Recording[]> {
    const { skip, take, where, orderBy } = params;
    
    try {
      return await prisma.recording.findMany({
        skip,
        take,
        where,
        orderBy
      });
    } catch (error) {
      logger.error('Failed to find recordings:', error);
      throw error;
    }
  }

  /**
   * Update a recording
   */
  async update(id: string, data: UpdateRecordingInput): Promise<Recording> {
    try {
      return await prisma.recording.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error(`Failed to update recording with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a recording
   */
  async delete(id: string): Promise<Recording> {
    try {
      return await prisma.recording.delete({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to delete recording with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Count recordings with optional filters
   */
  async count(where?: Prisma.RecordingWhereInput): Promise<number> {
    try {
      return await prisma.recording.count({ where });
    } catch (error) {
      logger.error('Failed to count recordings:', error);
      throw error;
    }
  }

  /**
   * Find recordings by camera ID
   */
  async findByCameraId(cameraId: string, params?: {
    skip?: number;
    take?: number;
    status?: RecordingStatus;
  }): Promise<Recording[]> {
    try {
      const where: Prisma.RecordingWhereInput = { cameraId };
      
      if (params?.status) {
        where.status = params.status;
      }
      
      return await prisma.recording.findMany({
        where,
        skip: params?.skip,
        take: params?.take,
        orderBy: { startTime: 'desc' }
      });
    } catch (error) {
      logger.error(`Failed to find recordings for camera ID ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Find recordings with relations
   */
  async findWithRelations(id: string): Promise<Recording | null> {
    try {
      return await prisma.recording.findUnique({
        where: { id },
        include: {
          camera: true,
          segments: true,
          events: true
        }
      });
    } catch (error) {
      logger.error(`Failed to find recording with relations for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update recording status
   */
  async updateStatus(id: string, status: RecordingStatus): Promise<Recording> {
    try {
      return await prisma.recording.update({
        where: { id },
        data: { status }
      });
    } catch (error) {
      logger.error(`Failed to update status for recording with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Complete a recording by setting endTime, calculating duration, and updating status
   */
  async completeRecording(id: string, endTime: Date): Promise<Recording> {
    try {
      const recording = await prisma.recording.findUnique({
        where: { id }
      });
      
      if (!recording) {
        throw new Error(`Recording with ID ${id} not found`);
      }
      
      // Calculate duration in seconds
      const startTime = recording.startTime;
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      
      return await prisma.recording.update({
        where: { id },
        data: {
          endTime,
          duration: durationSeconds,
          status: 'COMPLETED'
        }
      });
    } catch (error) {
      logger.error(`Failed to complete recording with ID ${id}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const recordingRepository = new RecordingRepository();