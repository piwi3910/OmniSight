import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

// Create a global Prisma client instance
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Export a singleton Prisma client to be used throughout the application
export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Only assign to global object in non-production environments to prevent memory leaks
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export models and types for easier imports
export { Prisma } from '@prisma/client';

// Function to test database connection
export const testConnection = async (): Promise<void> => {
  try {
    // Use a simple query to test the connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

export default prisma;