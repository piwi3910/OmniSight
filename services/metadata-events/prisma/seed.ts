import { PrismaClient, UserRole, CameraStatus, StreamStatus, RecordingStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      id: uuidv4(),
      username: 'admin',
      email: 'admin@example.com',
      password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // password
      role: UserRole.ADMIN,
      isActive: true,
      lastLogin: new Date(),
      settings: {
        theme: 'dark',
        notifications: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create regular user
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      id: uuidv4(),
      username: 'user',
      email: 'user@example.com',
      password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // password
      role: UserRole.USER,
      isActive: true,
      settings: {
        theme: 'light',
        notifications: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create cameras
  const camera1 = await prisma.camera.upsert({
    where: { id: '7890-camera-1' },
    update: {},
    create: {
      id: '7890-camera-1',
      name: 'Front Door Camera',
      rtspUrl: 'rtsp://192.168.1.100:554/stream1',
      username: 'admin',
      password: 'admin123',
      status: CameraStatus.ONLINE,
      ipAddress: '192.168.1.100',
      model: 'Hikvision DS-2CD2143G0-I',
      location: 'Front Door',
      settings: {
        resolution: '1080p',
        framerate: 30,
        compression: 'H.264'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const camera2 = await prisma.camera.upsert({
    where: { id: '7890-camera-2' },
    update: {},
    create: {
      id: '7890-camera-2',
      name: 'Backyard Camera',
      rtspUrl: 'rtsp://192.168.1.101:554/stream1',
      username: 'admin',
      password: 'admin123',
      status: CameraStatus.OFFLINE,
      ipAddress: '192.168.1.101',
      model: 'Hikvision DS-2CD2143G0-I',
      location: 'Backyard',
      settings: {
        resolution: '1080p',
        framerate: 30,
        compression: 'H.264'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create stream
  const stream = await prisma.stream.create({
    data: {
      id: uuidv4(),
      cameraId: camera1.id,
      status: StreamStatus.ACTIVE,
      startedAt: new Date(Date.now() - 3600000),
      metadata: {
        bitrateKbps: 2000,
        resolution: '1080p'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create recordings
  const recording = await prisma.recording.create({
    data: {
      id: uuidv4(),
      cameraId: camera1.id,
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 3600000),
      duration: 3600,
      status: RecordingStatus.COMPLETED,
      metadata: {
        fileSize: 1024000,
        format: 'mp4'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create segments
  const segment = await prisma.segment.create({
    data: {
      id: uuidv4(),
      recordingId: recording.id,
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 6600000),
      duration: 600,
      filePath: '/recordings/segment1.mp4',
      fileSize: 102400,
      thumbnailPath: '/thumbnails/segment1.jpg',
      metadata: {
        codec: 'H.264',
        framerate: 30
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create events and detected objects
  // First, create event without detected objects
  const event1 = await prisma.event.create({
    data: {
      id: uuidv4(),
      recordingId: recording.id,
      timestamp: new Date(Date.now() - 7000000),
      eventType: 'motion',
      confidence: 0.95,
      thumbnailPath: '/thumbnails/event1.jpg',
      metadata: {
        zone: 'entrance',
        motion_level: 'high'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Then add detected objects separately
  await prisma.detectedObject.createMany({
    data: [
      {
        id: uuidv4(),
        eventId: event1.id,
        objectType: 'person',
        confidence: 0.98,
        boundingBox: { x: 100, y: 200, width: 50, height: 120 },
        metadata: { attributes: { clothing: 'dark' } },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        eventId: event1.id,
        objectType: 'vehicle',
        confidence: 0.85,
        boundingBox: { x: 300, y: 400, width: 150, height: 100 },
        metadata: { attributes: { type: 'car', color: 'blue' } },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  });

  // Create another event
  const event2 = await prisma.event.create({
    data: {
      id: uuidv4(),
      recordingId: recording.id,
      timestamp: new Date(Date.now() - 6800000),
      eventType: 'person',
      confidence: 0.92,
      thumbnailPath: '/thumbnails/event2.jpg',
      metadata: {
        zone: 'driveway',
        motion_level: 'medium'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Add detected object to event2
  await prisma.detectedObject.create({
    data: {
      id: uuidv4(),
      eventId: event2.id,
      objectType: 'person',
      confidence: 0.92,
      boundingBox: { x: 150, y: 250, width: 50, height: 120 },
      metadata: { attributes: { clothing: 'light' } },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('Seed completed successfully!');
  console.log({
    admin,
    user,
    camera1,
    camera2,
    stream,
    recording,
    segment,
    event1,
    event2
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });