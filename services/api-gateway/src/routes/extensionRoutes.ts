import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import {
  registerExtension,
  listExtensions,
  getExtension,
  updateExtension,
  deleteExtension,
  regenerateCredentials,
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getCapabilities
} from '../controllers/extensionManagementController';
import config from '../config/config';

const router = express.Router();

// Rate limiter for API endpoints
const endpointLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// More restrictive rate limiter for sensitive operations
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sensitive operations, please try again later' }
});

// Extension management routes - Requires admin privileges
router.get('/', authenticate, authorize(['admin']), endpointLimiter, listExtensions);
router.post('/', authenticate, authorize(['admin']), sensitiveLimiter, registerExtension);
router.get('/capabilities', authenticate, endpointLimiter, getCapabilities);
router.get('/:extensionId', authenticate, authorize(['admin']), endpointLimiter, getExtension);
router.put('/:extensionId', authenticate, authorize(['admin']), endpointLimiter, updateExtension);
router.delete('/:extensionId', authenticate, authorize(['admin']), sensitiveLimiter, deleteExtension);
router.post('/:extensionId/regenerate', authenticate, authorize(['admin']), sensitiveLimiter, regenerateCredentials);

// Webhook management routes - Requires admin privileges
router.get('/:extensionId/webhooks', authenticate, authorize(['admin']), endpointLimiter, listWebhooks);
router.post('/:extensionId/webhooks', authenticate, authorize(['admin']), endpointLimiter, createWebhook);
router.put('/:extensionId/webhooks/:webhookId', authenticate, authorize(['admin']), endpointLimiter, updateWebhook);
router.delete('/:extensionId/webhooks/:webhookId', authenticate, authorize(['admin']), endpointLimiter, deleteWebhook);
router.post('/:extensionId/webhooks/:webhookId/test', authenticate, authorize(['admin']), endpointLimiter, testWebhook);

export default router;