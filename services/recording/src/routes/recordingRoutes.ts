import express from 'express';
import {
  createRecording,
  stopRecordingById,
  getAllActiveRecordings,
  getRecording,
  getRecordingsForCamera,
  getStorage,
  getSegmentFile,
  getThumbnailFile
} from '../controllers/recordingController';

const router = express.Router();

/**
 * @route   POST /api/recordings/start
 * @desc    Start a new recording
 * @access  Private
 */
router.post('/start', createRecording);

/**
 * @route   GET /api/recordings/active
 * @desc    Get all active recordings
 * @access  Private
 */
router.get('/active', getAllActiveRecordings);

/**
 * @route   GET /api/recordings/storage
 * @desc    Get storage information
 * @access  Private
 */
router.get('/storage', getStorage);

/**
 * @route   GET /api/recordings/:id
 * @desc    Get a specific recording by ID
 * @access  Private
 */
router.get('/:id', getRecording);

/**
 * @route   POST /api/recordings/:id/stop
 * @desc    Stop a recording
 * @access  Private
 */
router.post('/:id/stop', stopRecordingById);

/**
 * @route   GET /api/cameras/:cameraId/recordings
 * @desc    Get all recordings for a camera
 * @access  Private
 */
router.get('/cameras/:cameraId/recordings', getRecordingsForCamera);

/**
 * @route   GET /api/segments/:id/file
 * @desc    Get a segment file
 * @access  Private
 */
router.get('/segments/:id/file', getSegmentFile);

/**
 * @route   GET /api/segments/:id/thumbnail
 * @desc    Get a thumbnail file
 * @access  Private
 */
router.get('/segments/:id/thumbnail', getThumbnailFile);

export default router;