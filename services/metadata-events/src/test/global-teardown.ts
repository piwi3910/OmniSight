/**
 * Global teardown for Jest test environment
 * This runs once after all tests are complete
 */

export default async function globalTeardown() {
  console.log('Tearing down test environment...');
  
  // Clean up any resources that were created in globalSetup
  // For example, closing database connections, stopping test containers, etc.
  
  console.log('Test environment teardown complete');
}