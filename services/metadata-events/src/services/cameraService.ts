import { Camera, CameraStatus } from '@prisma/client';
import { cameraRepository, CreateCameraInput, UpdateCameraInput } from '../repositories/cameraRepository';
import logger from '../utils/logger';

/**
 * Service class for Camera business logic
 */
export class CameraService {
  /**
   * Create a new camera
   */
  async createCamera(cameraData: CreateCameraInput): Promise<Camera> {
    try {
      logger.info(`Creating new camera: ${cameraData.name}`);
      return await cameraRepository.create(cameraData);
    } catch (error) {
      logger.error('Error in createCamera service:', error);
      throw error;
    }
  }

  /**
   * Get a camera by ID
   */
  async getCameraById(id: string): Promise<Camera | null> {
    try {
      return await cameraRepository.findById(id);
    } catch (error) {
      logger.error(`Error getting camera by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all cameras
   */
  async getAllCameras(params?: {
    status?: CameraStatus;
    location?: string;
    skip?: number;
    take?: number;
  }): Promise<Camera[]> {
    try {
      const where: any = {};
      
      if (params?.status) {
        where.status = params.status;
      }
      
      if (params?.location) {
        where.location = params.location;
      }
      
      return await cameraRepository.findAll({
        where,
        skip: params?.skip,
        take: params?.take,
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting all cameras:', error);
      throw error;
    }
  }

  /**
   * Update a camera
   */
  async updateCamera(id: string, cameraData: UpdateCameraInput): Promise<Camera> {
    try {
      logger.info(`Updating camera with ID ${id}`);
      return await cameraRepository.update(id, cameraData);
    } catch (error) {
      logger.error(`Error updating camera ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a camera
   */
  async deleteCamera(id: string): Promise<Camera> {
    try {
      logger.info(`Deleting camera with ID ${id}`);
      return await cameraRepository.delete(id);
    } catch (error) {
      logger.error(`Error deleting camera ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update camera status
   */
  async updateCameraStatus(id: string, status: CameraStatus): Promise<Camera> {
    try {
      logger.info(`Updating status of camera ${id} to ${status}`);
      return await cameraRepository.updateStatus(id, status);
    } catch (error) {
      logger.error(`Error updating camera status ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get camera with related data
   */
  async getCameraWithRelations(id: string): Promise<Camera | null> {
    try {
      return await cameraRepository.findWithRelations(id);
    } catch (error) {
      logger.error(`Error getting camera relations for ${id}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const cameraService = new CameraService();