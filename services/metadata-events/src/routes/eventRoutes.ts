import express from 'express';
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsByCamera,
  getEventsByRecording
} from '../controllers/eventController';

const router = express.Router();

/**
 * @route   GET /api/events
 * @desc    Get all events with pagination and filtering
 * @access  Private
 */
router.get('/', getAllEvents);

/**
 * @route   GET /api/events/:id
 * @desc    Get a single event by ID
 * @access  Private
 */
router.get('/:id', getEventById);

/**
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Private
 */
router.post('/', createEvent);

/**
 * @route   PUT /api/events/:id
 * @desc    Update an event
 * @access  Private
 */
router.put('/:id', updateEvent);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete an event
 * @access  Private
 */
router.delete('/:id', deleteEvent);

/**
 * @route   GET /api/cameras/:cameraId/events
 * @desc    Get events by camera ID
 * @access  Private
 */
router.get('/cameras/:cameraId/events', getEventsByCamera);

/**
 * @route   GET /api/recordings/:recordingId/events
 * @desc    Get events by recording ID
 * @access  Private
 */
router.get('/recordings/:recordingId/events', getEventsByRecording);

export default router;