import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import {
  login,
  register,
  refresh,
  getCurrentUser
} from '../controllers/authController';
import {
  metadataEventsProxy,
  streamIngestionProxy,
  recordingProxy,
  objectDetectionProxy
} from '../middleware/proxy';
import config from '../config/config';

const router = express.Router();

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Public routes
router.post('/auth/login', apiLimiter, login);
router.post('/auth/register', apiLimiter, register);
router.post('/auth/refresh', apiLimiter, refresh);

// Protected routes
router.get('/auth/me', authenticate, getCurrentUser);

// Metadata & Events Service routes
router.use('/metadata', authenticate, metadataEventsProxy);
router.use('/events', authenticate, metadataEventsProxy);
router.use('/cameras', authenticate, metadataEventsProxy);
router.use('/recordings', authenticate, metadataEventsProxy);
router.use('/segments', authenticate, metadataEventsProxy);
router.use('/users', authenticate, authorize(['admin']), metadataEventsProxy);

// Stream Ingestion Service routes
router.use('/streams', authenticate, streamIngestionProxy);

// Recording Service routes
router.use('/recordings', authenticate, recordingProxy);
router.use('/segments', authenticate, recordingProxy);

// Object Detection Service routes
router.use('/detection', authenticate, objectDetectionProxy);

// Admin-only routes
router.use('/admin', authenticate, authorize(['admin']), (req, res, next) => {
  // This middleware will only be reached if the user is authenticated and has admin role
  next();
});

export default router;