/**
 * Global setup for Jest test environment
 * This runs once before all tests
 */

export default async function globalSetup() {
  console.log('Setting up test environment...');
  
  // Set up global test environment variables
  process.env.NODE_ENV = 'test';
  
  // You could also set up test databases, external services, etc. here
  // For example, starting an in-memory database or test containers
  
  console.log('Test environment setup complete');
}