import { Request, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { startStream, stopStream, getStreamStatus, getActiveStreams } from '../utils/streamHandler';
import config from '../config/config';
import logger from '../utils/logger';

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Get camera by ID
 * This fetches camera information from the metadata service
 */
export const getCameraById = async (cameraId: string): Promise<any> => {
  try {
    const response = await axios.get(`${config.api.metadataServiceUrl}/api/cameras/${cameraId}`, {
      headers: {
        'x-service-name': 'stream-ingestion'
      },
      timeout: config.api.timeout
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Error fetching camera ${cameraId}:`, error);
    throw error;
  }
};

/**
 * Update stream status in the database
 */
export const updateStreamStatus = async (streamId: string, data: any): Promise<void> => {
  try {
    await prisma.stream.upsert({
      where: { id: streamId },
      update: {
        ...data,
        updatedAt: new Date()
      },
      create: {
        id: streamId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error(`Error updating stream status for ${streamId}:`, error);
    throw error;
  }
};

/**
 * Start a new stream
 */
export const startStreamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cameraId, rtspUrl, options } = req.body;
    
    if (!cameraId || !rtspUrl) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Camera ID and RTSP URL are required'
        }
      });
      return;
    }
    
    // Start the stream
    const streamId = await startStream(cameraId, rtspUrl, options);
    
    res.status(200).json({
      streamId,
      cameraId,
      rtspUrl,
      status: 'started'
    });
  } catch (error) {
    logger.error('Error starting stream:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start stream',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Stop a stream
 */
export const stopStreamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { streamId } = req.params;
    
    if (!streamId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stream ID is required'
        }
      });
      return;
    }
    
    // Stop the stream
    await stopStream(streamId);
    
    res.status(200).json({
      streamId,
      status: 'stopped'
    });
  } catch (error) {
    logger.error(`Error stopping stream ${req.params.streamId}:`, error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to stop stream',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Get stream status
 */
export const getStreamStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { streamId } = req.params;
    
    if (!streamId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stream ID is required'
        }
      });
      return;
    }
    
    // Get stream status
    const status = getStreamStatus(streamId);
    
    if (!status) {
      res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Stream ${streamId} not found`
        }
      });
      return;
    }
    
    res.status(200).json(status);
  } catch (error) {
    logger.error(`Error getting stream status for ${req.params.streamId}:`, error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get stream status',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * List active streams
 */
export const listStreamsController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get active streams
    const activeStreams = getActiveStreams();
    
    // Convert Map to array
    const streams = Array.from(activeStreams.entries()).map(([streamId, stream]) => ({
      streamId,
      ...stream
    }));
    
    res.status(200).json({
      streams,
      count: streams.length
    });
  } catch (error) {
    logger.error('Error listing streams:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list streams',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * List all streams from database (including inactive)
 */
export const listAllStreamsController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get query parameters
    const { status, cameraId, page = '1', limit = '10' } = req.query;
    
    // Parse pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (cameraId) {
      filter.cameraId = cameraId;
    }
    
    // Get streams from database
    const streams = await prisma.stream.findMany({
      where: filter,
      skip,
      take: limitNum,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get total count
    const totalCount = await prisma.stream.count({
      where: filter
    });
    
    res.status(200).json({
      streams,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error listing all streams:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list all streams',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Get stream details by ID
 */
export const getStreamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { streamId } = req.params;
    
    if (!streamId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stream ID is required'
        }
      });
      return;
    }
    
    // Check if stream is active
    const activeStatus = getStreamStatus(streamId);
    
    // Get stream from database
    const dbStream = await prisma.stream.findUnique({
      where: { id: streamId }
    });
    
    if (!dbStream && !activeStatus) {
      res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Stream ${streamId} not found`
        }
      });
      return;
    }
    
    // Combine active status with database record
    const streamInfo = {
      ...dbStream,
      ...(activeStatus ? { liveStatus: activeStatus } : {})
    };
    
    res.status(200).json(streamInfo);
  } catch (error) {
    logger.error(`Error getting stream ${req.params.streamId}:`, error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get stream details',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};