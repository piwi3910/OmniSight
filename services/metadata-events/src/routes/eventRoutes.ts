import express from 'express';
import {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsByCamera,
  getEventsByRecording,
  searchEventsByObjectTypes,
  exportEvents,
  getEventCountsByType,
  applyRetentionPolicy
} from '../controllers/eventController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route   GET /api/events
 * @desc    Get all events with pagination and filtering
 * @access  Private
 */
router.get('/', getAllEvents);

/**
 * @route   GET /api/events/search
 * @desc    Search events with advanced filters
 * @access  Private
 */
router.get('/search', searchEventsByObjectTypes);

/**
 * @route   GET /api/events/export
 * @desc    Export events to CSV or JSON
 * @access  Private
 */
router.get('/export', exportEvents);

/**
 * @route   GET /api/events/counts
 * @desc    Get event counts by type
 * @access  Private
 */
router.get('/counts', getEventCountsByType);

/**
 * @route   POST /api/events/retention
 * @desc    Apply retention policy to events
 * @access  Private/Admin
 */
router.post('/retention', applyRetentionPolicy);

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
 * @route   GET /api/events/cameras/:cameraId
 * @desc    Get events by camera ID
 * @access  Private
 */
router.get('/cameras/:cameraId', getEventsByCamera);

/**
 * @route   GET /api/events/recordings/:recordingId
 * @desc    Get events by recording ID
 * @access  Private
 */
router.get('/recordings/:recordingId', getEventsByRecording);

export default router;