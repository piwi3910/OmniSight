// Simple script to test database connectivity
const { Sequelize } = require('sequelize');

// Database configuration
const dbName = process.env.DB_NAME || 'omnisight';
const dbUser = process.env.DB_USERNAME || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

// Log database connection parameters
console.log('Database connection parameters:');
console.log(`Host: ${dbHost}:${dbPort}`);
console.log(`Database: ${dbName}`);
console.log(`User: ${dbUser}`);

// Create Sequelize instance
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: console.log
});

// Test database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    
    // Check if sequelize is properly initialized
    console.log('Sequelize instance details:');
    console.log('- Is defined:', sequelize !== undefined);
    console.log('- Has define method:', typeof sequelize.define === 'function');
    console.log('- Has model method:', typeof sequelize.model === 'function');
    
    return sequelize;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}

// Run the test
testConnection()
  .then(sequelize => {
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });