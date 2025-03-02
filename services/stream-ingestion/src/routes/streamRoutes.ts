import express from 'express';
import {
  createStream,
  stopStreamById,
  getAllStreams,
  getStreamById,
  getStreamsByCameraId,
  getStreamStatus
} from '../controllers/streamController';

const router = express.Router();

/**
 * @route   POST /api/streams
 * @desc    Start a new stream
 * @access  Private
 */
router.post('/', createStream);

/**
 * @route   GET /api/streams
 * @desc    Get all active streams
 * @access  Private
 */
router.get('/', getAllStreams);

/**
 * @route   GET /api/streams/:id
 * @desc    Get a specific stream by ID
 * @access  Private
 */
router.get('/:id', getStreamById);

/**
 * @route   POST /api/streams/:id/stop
 * @desc    Stop a stream
 * @access  Private
 */
router.post('/:id/stop', stopStreamById);

/**
 * @route   GET /api/streams/:id/status
 * @desc    Get stream status
 * @access  Private
 */
router.get('/:id/status', getStreamStatus);

/**
 * @route   GET /api/cameras/:cameraId/streams
 * @desc    Get all streams for a camera
 * @access  Private
 */
router.get('/cameras/:cameraId/streams', getStreamsByCameraId);

export default router;