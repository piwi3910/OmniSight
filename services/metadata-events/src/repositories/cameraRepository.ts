import { Camera, CameraStatus, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import logger from '../utils/logger';

export interface CreateCameraInput {
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  status?: CameraStatus;
  ipAddress?: string;
  model?: string;
  location?: string;
  settings?: Record<string, any>;
}

export interface UpdateCameraInput {
  name?: string;
  rtspUrl?: string;
  username?: string;
  password?: string;
  status?: CameraStatus;
  ipAddress?: string;
  model?: string;
  location?: string;
  settings?: Record<string, any>;
}

/**
 * Repository class for Camera operations
 */
export class CameraRepository {
  /**
   * Create a new camera
   */
  async create(data: CreateCameraInput): Promise<Camera> {
    try {
      return await prisma.camera.create({
        data
      });
    } catch (error) {
      logger.error('Failed to create camera:', error);
      throw error;
    }
  }

  /**
   * Get a camera by ID
   */
  async findById(id: string): Promise<Camera | null> {
    try {
      return await prisma.camera.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to find camera with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all cameras with optional filters
   */
  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.CameraWhereInput;
    orderBy?: Prisma.CameraOrderByWithRelationInput;
  }): Promise<Camera[]> {
    const { skip, take, where, orderBy } = params;
    
    try {
      return await prisma.camera.findMany({
        skip,
        take,
        where,
        orderBy
      });
    } catch (error) {
      logger.error('Failed to find cameras:', error);
      throw error;
    }
  }

  /**
   * Update a camera
   */
  async update(id: string, data: UpdateCameraInput): Promise<Camera> {
    try {
      return await prisma.camera.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error(`Failed to update camera with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a camera
   */
  async delete(id: string): Promise<Camera> {
    try {
      return await prisma.camera.delete({
        where: { id }
      });
    } catch (error) {
      logger.error(`Failed to delete camera with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Count cameras with optional filters
   */
  async count(where?: Prisma.CameraWhereInput): Promise<number> {
    try {
      return await prisma.camera.count({ where });
    } catch (error) {
      logger.error('Failed to count cameras:', error);
      throw error;
    }
  }

  /**
   * Find cameras with streams and recordings (with relations)
   */
  async findWithRelations(id: string): Promise<Camera | null> {
    try {
      return await prisma.camera.findUnique({
        where: { id },
        include: {
          streams: true,
          recordings: true
        }
      });
    } catch (error) {
      logger.error(`Failed to find camera with relations for ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update camera status
   */
  async updateStatus(id: string, status: CameraStatus): Promise<Camera> {
    try {
      return await prisma.camera.update({
        where: { id },
        data: { status }
      });
    } catch (error) {
      logger.error(`Failed to update status for camera with ID ${id}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const cameraRepository = new CameraRepository();