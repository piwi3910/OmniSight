/**
 * Jest setup file that runs before each test file
 * Use this file to set up environment variables, mocks, and other test prerequisites
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

// Global mocks
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    camera: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    detectedObject: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    recording: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    segment: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((callback) => callback()),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock socket.io
jest.mock('socket.io', () => {
  const mockSocketIo = {
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    use: jest.fn(),
  };

  return jest.fn(() => mockSocketIo);
});

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Global test cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});