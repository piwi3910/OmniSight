import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { 
  getDetectionStats, 
  processImage, 
  getRecentDetections, 
  getDetectionsByClass,
  getDetectionsByTimeRange,
  updateDetectionSettings,
  getDetectionSettings
} from '../controllers/detectionController';
import { authenticate, authorize } from '@omnisight/shared';

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'tmp'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const router = Router();

/**
 * @swagger
 * /detection/stats:
 *   get:
 *     summary: Get detection statistics
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detection statistics
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, getDetectionStats);

/**
 * @swagger
 * /detection/settings:
 *   get:
 *     summary: Get detection settings
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detection settings
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/settings', authenticate, getDetectionSettings);

/**
 * @swagger
 * /detection/settings:
 *   post:
 *     summary: Update detection settings
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minConfidence:
 *                 type: number
 *                 description: Minimum confidence threshold (0-1)
 *               detectionInterval:
 *                 type: number
 *                 description: Detection interval in milliseconds
 *               classes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Classes to detect (empty array = all classes)
 *               motionSensitivity:
 *                 type: number
 *                 description: Motion sensitivity (0-1)
 *               regionOfInterest:
 *                 type: object
 *                 description: Region of interest
 *     responses:
 *       200:
 *         description: Detection settings updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/settings', authenticate, authorize(['admin']), updateDetectionSettings);

/**
 * @swagger
 * /detection/process:
 *   post:
 *     summary: Process an image for detection
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *               - cameraId
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to process
 *               cameraId:
 *                 type: string
 *                 description: Camera ID
 *     responses:
 *       202:
 *         description: Image queued for detection
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/process', authenticate, upload.single('image'), processImage);

/**
 * @swagger
 * /detection/camera/{cameraId}:
 *   get:
 *     summary: Get recent detections for a camera
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cameraId
 *         required: true
 *         schema:
 *           type: string
 *         description: Camera ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limit results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset results
 *     responses:
 *       200:
 *         description: Recent detections
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Camera not found
 *       500:
 *         description: Server error
 */
router.get('/camera/:cameraId', authenticate, getRecentDetections);

/**
 * @swagger
 * /detection/class/{objectClass}:
 *   get:
 *     summary: Get detections by object class
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectClass
 *         required: true
 *         schema:
 *           type: string
 *         description: Object class (e.g., person, car)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limit results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset results
 *     responses:
 *       200:
 *         description: Detections by class
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/class/:objectClass', authenticate, getDetectionsByClass);

/**
 * @swagger
 * /detection/timerange/{cameraId}:
 *   get:
 *     summary: Get detections within a time range
 *     tags: [Detection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cameraId
 *         required: true
 *         schema:
 *           type: string
 *         description: Camera ID (use 'all' for all cameras)
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time (ISO 8601)
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limit results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset results
 *     responses:
 *       200:
 *         description: Detections in time range
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/timerange/:cameraId', authenticate, getDetectionsByTimeRange);

export default router;