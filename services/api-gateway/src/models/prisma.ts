import { PrismaClient } from '@prisma/client';

// Create a Prisma client instance
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Add hooks or extensions if needed
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  // Log slow queries in development
  if (process.env.NODE_ENV === 'development' && (after - before) > 100) {
    console.log(`Slow query detected (${after - before}ms): ${params.model}.${params.action}`);
  }
  
  return result;
});

// Export types from Prisma client
export * from '@prisma/client';

// Export the client
export default prisma;