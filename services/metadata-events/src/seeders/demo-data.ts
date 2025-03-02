import { QueryInterface, Op } from 'sequelize';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Hash password for admin user
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    // Add admin user
    await queryInterface.bulkInsert('users', [{
      id: uuidv4(),
      username: 'admin',
      email: 'admin@omnisight.com',
      password: hashedPassword,
      role: 'admin',
      settings: JSON.stringify({ theme: 'dark', notifications: true }),
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Add demo cameras
    const cameras = [
      {
        id: uuidv4(),
        name: 'Front Door Camera',
        rtsp_url: 'rtsp://demo:demo@192.168.1.100:554/stream1',
        username: 'demo',
        password: 'demo',
        status: 'offline',
        ip_address: '192.168.1.100',
        location: 'Front Door',
        model: 'Generic RTSP Camera',
        settings: JSON.stringify({ resolution: '1080p', framerate: 30 }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Backyard Camera',
        rtsp_url: 'rtsp://demo:demo@192.168.1.101:554/stream1',
        username: 'demo',
        password: 'demo',
        status: 'offline',
        ip_address: '192.168.1.101',
        location: 'Backyard',
        model: 'Generic RTSP Camera',
        settings: JSON.stringify({ resolution: '1080p', framerate: 30 }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('cameras', cameras);
  },

  down: async (queryInterface: QueryInterface) => {
    // Remove seeded data
    await queryInterface.bulkDelete('users', { username: 'admin' }, {});
    await queryInterface.bulkDelete('cameras', { 
      [Op.or]: [
        { name: 'Front Door Camera' },
        { name: 'Backyard Camera' }
      ]
    }, {});
  }
};