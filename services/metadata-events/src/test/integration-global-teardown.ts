/**
 * Global teardown for integration tests
 * This runs once after all integration tests
 */

export default async function integrationGlobalTeardown() {
  console.log('Tearing down integration test environment...');
  
  // Clean up resources that were created in integrationGlobalSetup
  // For example, stopping docker containers, cleaning up test databases, etc.
  
  console.log('Integration test environment teardown complete');
}