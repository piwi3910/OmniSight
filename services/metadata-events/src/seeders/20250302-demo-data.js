'use strict';
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add admin user
    await queryInterface.bulkInsert('users', [{
      id: uuidv4(),
      username: 'admin',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Add demo cameras
    const cameras = [
      {
        id: uuidv4(),
        name: 'Front Door Camera',
        rtsp_url: 'rtsp://example.com/frontdoor',
        status: 'offline',
        location: 'Front Door',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Backyard Camera',
        rtsp_url: 'rtsp://example.com/backyard',
        status: 'offline',
        location: 'Backyard',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('cameras', cameras);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('cameras', null, {});
  }
};