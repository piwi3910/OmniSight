import { startStream, stopStream } from '../utils/streamHandler';
import logger from '../utils/logger';

/**
 * Script to test connection to real IP cameras
 * 
 * This script will attempt to connect to the real IP cameras and test the RTSP stream.
 * It will log the results of each connection attempt.
 */

// Camera configuration
const cameras = [
  {
    id: 'camera-1',
    name: 'Front Door Camera',
    ipAddress: '192.168.10.21',
    username: 'frigate',
    password: 'Jbz49teq01!'
  },
  {
    id: 'camera-2',
    name: 'Backyard Camera',
    ipAddress: '192.168.10.22',
    username: 'frigate',
    password: 'Jbz49teq01!'
  },
  {
    id: 'camera-3',
    name: 'Garage Camera',
    ipAddress: '192.168.10.23',
    username: 'frigate',
    password: 'Jbz49teq01!'
  },
  {
    id: 'camera-4',
    name: 'Driveway Camera',
    ipAddress: '192.168.10.24',
    username: 'frigate',
    password: 'Jbz49teq01!'
  },
  {
    id: 'camera-5',
    name: 'Side Entrance Camera',
    ipAddress: '192.168.10.25',
    username: 'frigate',
    password: 'Jbz49teq01!'
  }
];

/**
 * Test connection to an RTSP camera
 */
async function testCamera(camera: any) {
  logger.info(`Testing connection to ${camera.name} (${camera.ipAddress})...`);

  try {
    // Attempt to start the stream
    const streamOptions = {
      name: camera.name,
      url: `rtsp://${camera.ipAddress}:554/stream1`,
      username: camera.username,
      password: camera.password,
      frameRate: 10,  
      width: 640,
      height: 480
    };

    const stream = await startStream(camera.id, streamOptions);
    
    if (stream) {
      logger.info(`Successfully connected to ${camera.name} (${camera.ipAddress})`);
      
      // Keep stream open for a few seconds to check if frames are received
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Log stream stats
      logger.info(`Stream stats for ${camera.name}:`);
      logger.info(`- Frame count: ${stream.frameCount}`);
      logger.info(`- Is active: ${stream.isActive}`);
      logger.info(`- Last frame time: ${stream.lastFrameTime?.toISOString() || 'None'}`);
      
      // Stop the stream
      await stopStream(stream.id);
      logger.info(`Stream stopped for ${camera.name}`);

      return true;
    } else {
      logger.error(`Failed to connect to ${camera.name} (${camera.ipAddress})`);
      return false;
    }
  } catch (error) {
    logger.error(`Error testing ${camera.name} (${camera.ipAddress}):`, error);
    return false;
  }
}

/**
 * Test all cameras
 */
async function testAllCameras() {
  logger.info('Starting camera connection tests...');
  
  const results = [];
  
  for (const camera of cameras) {
    const success = await testCamera(camera);
    results.push({
      name: camera.name,
      ipAddress: camera.ipAddress,
      success
    });
    
    // Small delay between camera tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Log overall results
  logger.info('Camera connection test results:');
  
  let successCount = 0;
  for (const result of results) {
    if (result.success) {
      successCount++;
      logger.info(`✅ ${result.name} (${result.ipAddress}): Connected successfully`);
    } else {
      logger.error(`❌ ${result.name} (${result.ipAddress}): Connection failed`);
    }
  }
  
  logger.info(`Successfully connected to ${successCount} out of ${cameras.length} cameras`);
}

// Run the tests
testAllCameras()
  .catch(error => {
    logger.error('Error running camera tests:', error);
  })
  .finally(() => {
    // Allow time for logs to be flushed
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });