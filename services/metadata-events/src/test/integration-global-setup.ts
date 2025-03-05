/**
 * Global setup for integration tests
 * This runs once before all integration tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function integrationGlobalSetup() {
  console.log('Setting up integration test environment...');
  
  // Set up integration test environment variables
  process.env.NODE_ENV = 'test';
  
  // Generate Prisma client to ensure we have the latest types
  try {
    console.log('Generating Prisma client...');
    await execAsync('npx prisma generate');
    console.log('Prisma client generated successfully');
  } catch (error) {
    console.error('Failed to generate Prisma client:', error);
  }
  
  // You could also set up docker containers, test databases, etc. here
  
  console.log('Integration test environment setup complete');
}