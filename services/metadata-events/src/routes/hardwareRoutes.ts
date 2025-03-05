import express from 'express';
import {
  getHardwareDevices,
  getAccelerationConfig,
  updateAccelerationConfig,
  runBenchmark,
  getCameraAccelerationStatus,
  updateCameraAcceleration
} from '../controllers/hardwareAccelerationController';

const router = express.Router();

// Hardware acceleration routes
router.get('/devices', getHardwareDevices);
router.get('/acceleration', getAccelerationConfig);
router.put('/acceleration', updateAccelerationConfig);
router.post('/benchmark', runBenchmark);
router.get('/cameras/:cameraId/acceleration', getCameraAccelerationStatus);
router.put('/cameras/:cameraId/acceleration', updateCameraAcceleration);

export default router;