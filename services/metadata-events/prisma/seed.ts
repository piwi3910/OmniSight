import { v4 as uuidv4 } from 'uuid';
import { Camera } from '../src/types/models';

// Define enum-like constants to replace Prisma enums
const CameraStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  ERROR: 'ERROR'
};

const StreamStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ERROR: 'ERROR'
};

const RecordingStatus = {
  RECORDING: 'RECORDING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
};

const UserRole = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  VIEWER: 'VIEWER'
};

async function main() {
  console.log('Starting seed...');
  
  try {
    // This is a modified version that doesn't rely on Prisma directly
    console.log('Would create admin user with ID:', uuidv4());
    console.log('Would create regular user with ID:', uuidv4());
    
    // Create real cameras using the provided information
    const locations = ['Front Door', 'Backyard', 'Garage', 'Driveway', 'Side Entrance'];
    
    // Simulate creating cameras (without using Prisma)
    for (let i = 0; i < 5; i++) {
      const ipLastOctet = 21 + i;
      const cameraId = `real-camera-${ipLastOctet}`;
      const ipAddress = `192.168.10.${ipLastOctet}`;
      
      const camera: Camera = {
        id: cameraId,
        name: `${locations[i]} Camera`,
        rtspUrl: `rtsp://${ipAddress}:554/stream1`,
        username: 'frigate',
        password: 'Jbz49teq01!',
        status: 'OFFLINE', // Will be updated when stream is tested
        ipAddress: ipAddress,
        model: 'IP Camera',
        location: locations[i],
        settings: {
          resolution: '1080p',
          framerate: 30,
          compression: 'H.264'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log(`Would create camera: ${camera.name} (${camera.ipAddress})`);
      console.log(`RTSP URL: ${camera.rtspUrl}`);
      console.log(`Login credentials: ${camera.username} / ${camera.password}`);
      console.log('-----');
    }
    
    console.log('Seed simulation completed successfully!');
    console.log(`Note: This is just a simulation, not actually modifying the database.`);
    console.log(`To run the actual seed, fix the Prisma dependencies and run 'npx prisma db seed'.`);
    
    // Instructions for actual implementation
    console.log('\nTo implement the real cameras in the database:');
    console.log('1. Ensure all prisma dependencies are correctly installed');
    console.log('2. Run: npx prisma generate');
    console.log('3. Run: npx prisma migrate dev');
    console.log('4. Run: npx prisma db seed');
    
  } catch (error) {
    console.error('Error in seed script:', error);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });