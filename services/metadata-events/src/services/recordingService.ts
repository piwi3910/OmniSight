import { Recording, RecordingStatus, Camera, Segment, Event } from '@prisma/client';
import { recordingRepository, CreateRecordingInput, UpdateRecordingInput } from '../repositories/recordingRepository';
import prisma from '../prisma/client';
import logger from '../utils/logger';

export interface RecordingWithRelations extends Recording {
  camera?: Camera;
  segments?: Segment[];
  events?: Event[];
}

/**
 * Service class for Recording business logic
 */
export class RecordingService {
  /**
   * Create a new recording
   */
  async createRecording(recordingData: CreateRecordingInput): Promise<Recording> {
    try {
      logger.info(`Creating new recording for camera: ${recordingData.cameraId}`);
      return await recordingRepository.create(recordingData);
    } catch (error) {
      logger.error('Error in createRecording service:', error);
      throw error;
    }
  }

  /**
   * Get a recording by ID
   */
  async getRecordingById(id: string): Promise<Recording | null> {
    try {
      return await recordingRepository.findById(id);
    } catch (error) {
      logger.error(`Error getting recording by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get a recording with all relations
   */
  async getRecordingWithRelations(id: string): Promise<RecordingWithRelations | null> {
    try {
      const recording = await prisma.recording.findUnique({
        where: { id },
        include: {
          camera: true,
          segments: true,
          events: {
            include: {
              detectedObjects: true
            }
          }
        }
      });
      
      return recording as RecordingWithRelations | null;
    } catch (error) {
      logger.error(`Error getting recording with relations for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all recordings with filtering and pagination
   */
  async getAllRecordings(params?: {
    cameraId?: string;
    status?: RecordingStatus;
    startDate?: Date;
    endDate?: Date;
    skip?: number;
    take?: number;
  }): Promise<{
    recordings: Recording[];
    total: number;
    pages: number;
  }> {
    try {
      const where: any = {};
      
      if (params?.cameraId) {
        where.cameraId = params.cameraId;
      }
      
      if (params?.status) {
        where.status = params.status;
      }
      
      // Add time range filter if provided
      if (params?.startDate || params?.endDate) {
        where.startTime = {};
        
        if (params?.startDate) {
          where.startTime.gte = params.startDate;
        }
        
        if (params?.endDate) {
          where.startTime.lte = params.endDate;
        }
      }
      
      // Get total count for pagination
      const total = await recordingRepository.count(where);
      
      // Calculate pagination values
      const skip = params?.skip || 0;
      const take = params?.take || 10;
      const pages = Math.ceil(total / take);
      
      // Get recordings with pagination
      const recordings = await recordingRepository.findAll({
        where,
        orderBy: { startTime: 'desc' },
        skip,
        take
      });
      
      return {
        recordings,
        total,
        pages
      };
    } catch (error) {
      logger.error('Error getting all recordings:', error);
      throw error;
    }
  }

  /**
   * Update a recording
   */
  async updateRecording(id: string, recordingData: UpdateRecordingInput): Promise<Recording> {
    try {
      logger.info(`Updating recording with ID ${id}`);
      return await recordingRepository.update(id, recordingData);
    } catch (error) {
      logger.error(`Error updating recording ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a recording
   */
  async deleteRecording(id: string): Promise<Recording> {
    try {
      logger.info(`Deleting recording with ID ${id}`);
      return await recordingRepository.delete(id);
    } catch (error) {
      logger.error(`Error deleting recording ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get recordings by camera ID
   */
  async getRecordingsByCameraId(
    cameraId: string,
    params?: {
      status?: RecordingStatus;
      skip?: number;
      take?: number;
    }
  ): Promise<{
    recordings: Recording[];
    total: number;
    pages: number;
  }> {
    try {
      // Check if camera exists
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId }
      });
      
      if (!camera) {
        throw new Error(`Camera with ID ${cameraId} not found`);
      }
      
      // Build where clause
      const where: any = { cameraId };
      
      if (params?.status) {
        where.status = params.status;
      }
      
      // Get total count for pagination
      const total = await recordingRepository.count(where);
      
      // Calculate pagination values
      const skip = params?.skip || 0;
      const take = params?.take || 10;
      const pages = Math.ceil(total / take);
      
      // Get recordings
      const recordings = await recordingRepository.findAll({
        where,
        orderBy: { startTime: 'desc' },
        skip,
        take
      });
      
      return {
        recordings,
        total,
        pages
      };
    } catch (error) {
      logger.error(`Error getting recordings for camera ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Complete a recording
   */
  async completeRecording(id: string, endTime: Date): Promise<Recording> {
    try {
      logger.info(`Completing recording with ID ${id}`);
      return await recordingRepository.completeRecording(id, endTime);
    } catch (error) {
      logger.error(`Error completing recording ${id}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const recordingService = new RecordingService();