import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { metadataEventsProxy } from '../middleware/proxy';
import rateLimit from 'express-rate-limit';
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

// Camera protocol routes
router.post('/discover', authenticate, endpointLimiter, metadataEventsProxy);
router.post('/:id/detect', authenticate, endpointLimiter, metadataEventsProxy);
router.get('/:id/capabilities', authenticate, endpointLimiter, metadataEventsProxy);
router.post('/:id/ptz', authenticate, endpointLimiter, metadataEventsProxy);
router.get('/:id/presets', authenticate, endpointLimiter, metadataEventsProxy);
router.post('/:id/presets', authenticate, endpointLimiter, metadataEventsProxy);
router.delete('/:id/presets/:presetId', authenticate, endpointLimiter, metadataEventsProxy);
router.post('/:id/reboot', authenticate, endpointLimiter, metadataEventsProxy);
router.get('/:id/streams', authenticate, endpointLimiter, metadataEventsProxy);
router.post('/:id/test-connection', authenticate, endpointLimiter, metadataEventsProxy);

// Hardware acceleration related routes
router.get('/hardware/devices', authenticate, authorize(['admin']), endpointLimiter, metadataEventsProxy);
router.post('/hardware/benchmark', authenticate, authorize(['admin']), endpointLimiter, metadataEventsProxy);
router.get('/hardware/acceleration', authenticate, endpointLimiter, metadataEventsProxy);
router.put('/hardware/acceleration', authenticate, authorize(['admin']), endpointLimiter, metadataEventsProxy);

export default router;