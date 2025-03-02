import { Request, Response } from 'express';
import models from '../models';
import { Op } from 'sequelize';

const { Event, DetectedObject, Recording, Camera, Segment } = models;

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

    // Build where clause based on query parameters
    const whereClause: any = {};
    
    if (recordingId) {
      whereClause.recordingId = recordingId;
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    // If cameraId is provided, we need to find recordings for that camera
    if (cameraId) {
      const recordings = await Recording.findAll({
        where: { cameraId },
        attributes: ['id']
      });
      
      const recordingIds = recordings.map((recording: any) => recording.id);
      whereClause.recordingId = { [Op.in]: recordingIds };
    }
    
    // Add time range filter if provided
    if (startTime || endTime) {
      whereClause.timestamp = {};
      
      if (startTime) {
        whereClause.timestamp[Op.gte] = new Date(startTime as string);
      }
      
      if (endTime) {
        whereClause.timestamp[Op.lte] = new Date(endTime as string);
      }
    }
    
    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get events with pagination
    const { count, rows } = await Event.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        },
        {
          model: Recording,
          as: 'recording',
          include: [
            {
              model: Camera,
              as: 'camera',
              attributes: ['id', 'name', 'location']
            }
          ]
        },
        {
          model: Segment,
          as: 'segment',
          attributes: ['id', 'filePath', 'startTime', 'endTime']
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: Number(limit),
      offset
    });
    
    // Format response
    const events = rows.map((event: any) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      cameraId: event.recording?.camera?.id,
      cameraName: event.recording?.camera?.name,
      recordingId: event.recordingId,
      segmentId: event.segmentId,
      segmentPath: event.segment?.filePath,
      detectedObjects: event.detectedObjects?.map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    }));
    
    // Calculate total pages
    const totalPages = Math.ceil(count / Number(limit));
    
    return res.status(200).json({
      events,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a single event by ID
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findByPk(id, {
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        },
        {
          model: Recording,
          as: 'recording',
          include: [
            {
              model: Camera,
              as: 'camera',
              attributes: ['id', 'name', 'location']
            }
          ]
        },
        {
          model: Segment,
          as: 'segment',
          attributes: ['id', 'filePath', 'startTime', 'endTime']
        }
      ]
    });
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Format response
    const formattedEvent = {
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
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
      segment: event.segment ? {
        id: event.segmentId,
        filePath: event.segment.filePath,
        startTime: event.segment.startTime,
        endTime: event.segment.endTime
      } : null,
      detectedObjects: event.detectedObjects?.map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    };
    
    return res.status(200).json(formattedEvent);
  } catch (error) {
    console.error('Error getting event:', error);
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
      segmentId,
      thumbnailPath,
      metadata,
      detectedObjects
    } = req.body;
    
    // Validate required fields
    if (!recordingId || !timestamp || !type) {
      return res.status(400).json({ error: 'recordingId, timestamp, and type are required' });
    }
    
    // Check if recording exists
    const recording = await Recording.findByPk(recordingId);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    
    // Create event
    const event = await Event.create({
      recordingId,
      timestamp,
      type,
      confidence,
      segmentId,
      thumbnailPath,
      metadata
    });
    
    // Create detected objects if provided
    if (detectedObjects && Array.isArray(detectedObjects)) {
      await Promise.all(
        detectedObjects.map((obj: any) =>
          DetectedObject.create({
            eventId: event.id,
            type: obj.type,
            confidence: obj.confidence,
            boundingBox: obj.boundingBox,
            metadata: obj.metadata
          })
        )
      );
    }
    
    // Get the created event with its detected objects
    const createdEvent = await Event.findByPk(event.id, {
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        }
      ]
    });
    
    return res.status(201).json(createdEvent);
  } catch (error) {
    console.error('Error creating event:', error);
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
      segmentId,
      thumbnailPath,
      metadata
    } = req.body;
    
    // Find the event
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Update event
    await event.update({
      type,
      confidence,
      segmentId,
      thumbnailPath,
      metadata
    });
    
    // Get the updated event
    const updatedEvent = await Event.findByPk(id, {
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        }
      ]
    });
    
    return res.status(200).json(updatedEvent);
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete an event
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Find the event
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Delete event (this will cascade delete detected objects due to foreign key constraints)
    await event.destroy();
    
    return res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
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
    
    // Check if camera exists
    const camera = await Camera.findByPk(cameraId);
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    // Find recordings for this camera
    const recordings = await Recording.findAll({
      where: { cameraId },
      attributes: ['id']
    });
    
    const recordingIds = recordings.map((recording: any) => recording.id);
    
    // Build where clause
    const whereClause: any = {
      recordingId: { [Op.in]: recordingIds }
    };
    
    if (type) {
      whereClause.type = type;
    }
    
    // Add time range filter if provided
    if (startTime || endTime) {
      whereClause.timestamp = {};
      
      if (startTime) {
        whereClause.timestamp[Op.gte] = new Date(startTime as string);
      }
      
      if (endTime) {
        whereClause.timestamp[Op.lte] = new Date(endTime as string);
      }
    }
    
    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get events with pagination
    const { count, rows } = await Event.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        },
        {
          model: Segment,
          as: 'segment',
          attributes: ['id', 'filePath']
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: Number(limit),
      offset
    });
    
    // Format response
    const events = rows.map((event: any) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      recordingId: event.recordingId,
      segmentId: event.segmentId,
      segmentPath: event.segment?.filePath,
      detectedObjects: event.detectedObjects?.map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    }));
    
    // Calculate total pages
    const totalPages = Math.ceil(count / Number(limit));
    
    return res.status(200).json({
      events,
      camera: {
        id: camera.id,
        name: camera.name,
        location: camera.location
      },
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting events by camera:', error);
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
    
    // Check if recording exists
    const recording = await Recording.findByPk(recordingId, {
      include: [
        {
          model: Camera,
          as: 'camera',
          attributes: ['id', 'name', 'location']
        }
      ]
    });
    
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    
    // Build where clause
    const whereClause: any = {
      recordingId
    };
    
    if (type) {
      whereClause.type = type;
    }
    
    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get events with pagination
    const { count, rows } = await Event.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        },
        {
          model: Segment,
          as: 'segment',
          attributes: ['id', 'filePath', 'startTime', 'endTime']
        }
      ],
      order: [['timestamp', 'ASC']],
      limit: Number(limit),
      offset
    });
    
    // Format response
    const events = rows.map((event: any) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      confidence: event.confidence,
      thumbnailPath: event.thumbnailPath,
      segmentId: event.segmentId,
      segmentPath: event.segment?.filePath,
      detectedObjects: event.detectedObjects?.map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        confidence: obj.confidence,
        boundingBox: obj.boundingBox
      })),
      createdAt: event.createdAt
    }));
    
    // Calculate total pages
    const totalPages = Math.ceil(count / Number(limit));
    
    return res.status(200).json({
      events,
      recording: {
        id: recording.id,
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        camera: recording.camera
      },
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error getting events by recording:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};