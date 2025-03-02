import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

// Database configuration
const dbName = process.env.DB_NAME || 'omnisight';
const dbUser = process.env.DB_USERNAME || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

// Create Sequelize instance
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: console.log
});

async function setupDatabase() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Create sequelize-cli config file if it doesn't exist
    const configDir = path.join(__dirname, '../../.sequelizerc');
    if (!fs.existsSync(configDir)) {
      const configContent = `
const path = require('path');

module.exports = {
  'config': path.resolve('src/config', 'database.js'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'seeders'),
  'migrations-path': path.resolve('src', 'migrations')
};
      `;
      fs.writeFileSync(configDir, configContent);
      console.log('Created .sequelizerc file');
    }

    // Run migrations
    console.log('Running migrations...');
    execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
    console.log('Migrations completed successfully');

    // Run seeders
    console.log('Running seeders...');
    execSync('npx sequelize-cli db:seed:all', { stdio: 'inherit' });
    console.log('Seeders completed successfully');

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the setup
setupDatabase();