import express from 'express';
import multer from 'multer';
import {
  getStatus,
  detectObjects,
  getCameraDetections,
  getConfig,
  updateConfig,
  restartService
} from '../controllers/detectionController';

const router = express.Router();

// Set up multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * @route   GET /api/detection/status
 * @desc    Get detection service status
 * @access  Private
 */
router.get('/status', getStatus);

/**
 * @route   POST /api/detection/detect
 * @desc    Process an image for object detection
 * @access  Private
 */
router.post('/detect', upload.single('image'), detectObjects);

/**
 * @route   GET /api/detection/cameras/:cameraId/detections
 * @desc    Get recent detections for a camera
 * @access  Private
 */
router.get('/cameras/:cameraId/detections', getCameraDetections);

/**
 * @route   GET /api/detection/config
 * @desc    Get detection configuration
 * @access  Private
 */
router.get('/config', getConfig);

/**
 * @route   PUT /api/detection/config
 * @desc    Update detection configuration
 * @access  Private
 */
router.put('/config', updateConfig);

/**
 * @route   POST /api/detection/restart
 * @desc    Restart detection service
 * @access  Private
 */
router.post('/restart', restartService);

export default router;