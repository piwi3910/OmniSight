import { Router } from 'express';
import { 
  startStreamController,
  stopStreamController,
  getStreamStatusController,
  listStreamsController,
  listAllStreamsController,
  getStreamController
} from '../controllers/streamController';
import { authenticate, authorize } from '@omnisight/shared';

const router = Router();

/**
 * @swagger
 * /streams:
 *   get:
 *     summary: List active streams
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active streams
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/active', authenticate, listStreamsController);

/**
 * @swagger
 * /streams:
 *   get:
 *     summary: List all streams (including inactive)
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: cameraId
 *         schema:
 *           type: string
 *         description: Filter by camera ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of all streams
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authenticate, listAllStreamsController);

/**
 * @swagger
 * /streams/{streamId}:
 *   get:
 *     summary: Get stream details
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Stream ID
 *     responses:
 *       200:
 *         description: Stream details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Stream not found
 *       500:
 *         description: Server error
 */
router.get('/:streamId', authenticate, getStreamController);

/**
 * @swagger
 * /streams/{streamId}/status:
 *   get:
 *     summary: Get stream status
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Stream ID
 *     responses:
 *       200:
 *         description: Stream status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Stream not found
 *       500:
 *         description: Server error
 */
router.get('/:streamId/status', authenticate, getStreamStatusController);

/**
 * @swagger
 * /streams:
 *   post:
 *     summary: Start a new stream
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cameraId
 *               - rtspUrl
 *             properties:
 *               cameraId:
 *                 type: string
 *                 description: Camera ID
 *               rtspUrl:
 *                 type: string
 *                 description: RTSP URL
 *               options:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Stream name
 *                   frameRate:
 *                     type: number
 *                     description: Frame rate
 *                   width:
 *                     type: number
 *                     description: Width in pixels
 *                   height:
 *                     type: number
 *                     description: Height in pixels
 *                   quality:
 *                     type: number
 *                     description: Quality (1-31, lower is better)
 *                   authentication:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       password:
 *                         type: string
 *                   publishFrames:
 *                     type: boolean
 *                     description: Whether to publish frames to RabbitMQ
 *     responses:
 *       200:
 *         description: Stream started
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, startStreamController);

/**
 * @swagger
 * /streams/{streamId}:
 *   delete:
 *     summary: Stop a stream
 *     tags: [Streams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: streamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Stream ID
 *     responses:
 *       200:
 *         description: Stream stopped
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Stream not found
 *       500:
 *         description: Server error
 */
router.delete('/:streamId', authenticate, stopStreamController);

export default router;