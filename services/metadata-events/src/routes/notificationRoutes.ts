import express from 'express';
import {
  getNotifications,
  markAsRead,
  createSystemNotification,
  createEventNotification,
  createCameraStatusNotification
} from '../controllers/notificationController';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all recent notifications
 * @access  Private
 */
router.get('/', getNotifications);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:id/read', markAsRead);

/**
 * @route   POST /api/notifications/system
 * @desc    Send a system notification
 * @access  Private (Admin)
 */
router.post('/system', createSystemNotification);

/**
 * @route   POST /api/notifications/event
 * @desc    Send an event notification
 * @access  Private
 */
router.post('/event', createEventNotification);

/**
 * @route   POST /api/notifications/camera
 * @desc    Send a camera status notification
 * @access  Private
 */
router.post('/camera', createCameraStatusNotification);

export default router;