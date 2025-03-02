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

// More restrictive rate limiter for sensitive operations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' }
});

// Rate limiter for API endpoints
const endpointLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Public routes
router.post('/auth/login', authLimiter, login);
router.post('/auth/register', authLimiter, register);
router.post('/auth/refresh', authLimiter, refresh);

// Protected routes
router.get('/auth/me', authenticate, endpointLimiter, getCurrentUser);

// Metadata & Events Service routes
router.use('/metadata', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/events', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/cameras', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/recordings', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/segments', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/users', authenticate, authorize(['admin']), endpointLimiter, metadataEventsProxy);

// Stream Ingestion Service routes
router.use('/streams', authenticate, endpointLimiter, streamIngestionProxy);

// Recording Service routes
router.use('/recordings', authenticate, endpointLimiter, recordingProxy);
router.use('/segments', authenticate, endpointLimiter, recordingProxy);

// Object Detection Service routes
router.use('/detection', authenticate, endpointLimiter, objectDetectionProxy);

// Admin-only routes
router.use('/admin', authenticate, authorize(['admin']), endpointLimiter, (req, res, next) => {
  // This middleware will only be reached if the user is authenticated and has admin role
  next();
});

export default router;