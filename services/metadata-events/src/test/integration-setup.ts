/**
 * Jest setup file for integration tests
 * This runs before each integration test file
 */

// Import actual database and other dependencies for integration testing
import { PrismaClient } from '@prisma/client';

// Use a test-specific database URL for integration tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_integration_db';

// Create an actual Prisma client instance for integration tests
const prisma = new PrismaClient();

// Before all tests, connect to the database and set up test data
beforeAll(async () => {
  // Connect to the test database
  await prisma.$connect();
  
  // Clean the database before tests
  await prisma.$transaction([
    prisma.detectedObject.deleteMany(),
    prisma.event.deleteMany(),
    prisma.segment.deleteMany(),
    prisma.recording.deleteMany(),
    prisma.camera.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  
  // Insert test data
  await prisma.user.create({
    data: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      role: 'ADMIN',
    },
  });
  
  await prisma.camera.create({
    data: {
      id: 'test-camera-id',
      name: 'Test Camera',
      url: 'rtsp://example.com/test',
      status: 'ONLINE',
      type: 'RTSP',
      location: 'Test Location',
      userId: 'test-user-id',
    },
  });
});

// After all tests, clean up and disconnect
afterAll(async () => {
  // Clean up test data
  await prisma.$transaction([
    prisma.detectedObject.deleteMany(),
    prisma.event.deleteMany(),
    prisma.segment.deleteMany(),
    prisma.recording.deleteMany(),
    prisma.camera.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  
  // Disconnect from the database
  await prisma.$disconnect();
});

// Expose the prisma client for tests to use
export { prisma };