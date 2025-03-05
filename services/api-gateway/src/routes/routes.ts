import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth';
import {
  login,
  register,
  refresh,
  logout, // Added logout function
  getCurrentUser
} from '../controllers/authController';
import {
  metadataEventsProxy,
  streamIngestionProxy,
  recordingProxy,
  objectDetectionProxy
} from '../middleware/proxy';
import {
  registerExtension,
  getExtension,
  listExtensions,
  updateExtension,
  deleteExtension,
  regenerateCredentials,
  authenticateExtension
} from '../controllers/extensionController';
import { authenticateExtensionApi, authorizeExtension } from '../middleware/extensionAuth';
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

// Public routes - Authentication
router.post('/auth/login', authLimiter, login);
router.post('/auth/register', authLimiter, register);
router.post('/auth/refresh-token', authLimiter, refresh); // Updated to match docs: /refresh -> /refresh-token
router.post('/auth/logout', authLimiter, logout); // Added logout endpoint

// Protected routes - User management
router.get('/users/me', authenticate, endpointLimiter, getCurrentUser); // Updated to match docs: /auth/me -> /users/me

// Metadata & Events Service routes
router.use('/metadata', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/events', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/cameras', authenticate, endpointLimiter, metadataEventsProxy);
router.use('/recordings/metadata', authenticate, endpointLimiter, metadataEventsProxy); // Updated path with /metadata prefix
router.use('/segments/metadata', authenticate, endpointLimiter, metadataEventsProxy); // Updated path with /metadata prefix
router.use('/users', authenticate, authorize(['admin']), endpointLimiter, metadataEventsProxy);

// Stream Ingestion Service routes
router.use('/streams', authenticate, endpointLimiter, streamIngestionProxy);

// Recording Service routes
router.use('/recordings/storage', authenticate, endpointLimiter, recordingProxy); // Updated path with /storage prefix
router.use('/segments/storage', authenticate, endpointLimiter, recordingProxy); // Updated path with /storage prefix

// Object Detection Service routes
router.use('/detection', authenticate, endpointLimiter, objectDetectionProxy);

// Camera Protocol routes
import protocolRoutes from './protocolRoutes';
router.use('/protocols', protocolRoutes);

// Extension management - For administrators only
router.post('/extensions', authenticate, authorize(['admin']), endpointLimiter, registerExtension);
router.get('/extensions', authenticate, authorize(['admin']), endpointLimiter, listExtensions);
router.get('/extensions/:extensionId', authenticate, authorize(['admin']), endpointLimiter, getExtension);
router.put('/extensions/:extensionId', authenticate, authorize(['admin']), endpointLimiter, updateExtension);
router.delete('/extensions/:extensionId', authenticate, authorize(['admin']), endpointLimiter, deleteExtension);
router.post('/extensions/:extensionId/regenerate', authenticate, authorize(['admin']), endpointLimiter, regenerateCredentials);

// Extension API authentication - For extensions to authenticate
router.post('/extension-auth', authLimiter, authenticateExtension);

// Extension API endpoints - Protected by extension authentication
// Camera access
router.get('/ext/cameras', authenticateExtensionApi, authorizeExtension(['read:cameras']), metadataEventsProxy);
router.get('/ext/cameras/:cameraId', authenticateExtensionApi, authorizeExtension(['read:cameras']), metadataEventsProxy);
router.post('/ext/cameras', authenticateExtensionApi, authorizeExtension(['write:cameras']), metadataEventsProxy);
router.put('/ext/cameras/:cameraId', authenticateExtensionApi, authorizeExtension(['write:cameras']), metadataEventsProxy);

// Event access
router.get('/ext/events', authenticateExtensionApi, authorizeExtension(['read:events']), metadataEventsProxy);
router.get('/ext/events/:eventId', authenticateExtensionApi, authorizeExtension(['read:events']), metadataEventsProxy);
router.post('/ext/events', authenticateExtensionApi, authorizeExtension(['write:events']), metadataEventsProxy);

// Recording access
router.get('/ext/recordings', authenticateExtensionApi, authorizeExtension(['read:recordings']), metadataEventsProxy);
router.get('/ext/recordings/:recordingId', authenticateExtensionApi, authorizeExtension(['read:recordings']), metadataEventsProxy);
router.get('/ext/recordings/:recordingId/segments', authenticateExtensionApi, authorizeExtension(['read:recordings']), metadataEventsProxy);

// Detection access
router.get('/ext/detections', authenticateExtensionApi, authorizeExtension(['read:detection']), objectDetectionProxy);
router.post('/ext/detections', authenticateExtensionApi, authorizeExtension(['read:detection']), objectDetectionProxy);

// Admin-only routes
router.use('/admin', authenticate, authorize(['admin']), endpointLimiter, (req, res, next) => {
  // This middleware will only be reached if the user is authenticated and has admin role
  next();
});

export default router;