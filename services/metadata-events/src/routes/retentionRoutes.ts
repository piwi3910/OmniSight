import express from 'express';
import {
  triggerRetention,
  getRetentionSettings,
  updateRetentionSettings
} from '../controllers/retentionController';

const router = express.Router();

/**
 * @route   POST /api/retention/trigger
 * @desc    Trigger retention tasks manually
 * @access  Private (Admin)
 */
router.post('/trigger', triggerRetention);

/**
 * @route   GET /api/retention/settings
 * @desc    Get retention settings
 * @access  Private
 */
router.get('/settings', getRetentionSettings);

/**
 * @route   PUT /api/retention/settings
 * @desc    Update retention settings
 * @access  Private (Admin)
 */
router.put('/settings', updateRetentionSettings);

export default router;