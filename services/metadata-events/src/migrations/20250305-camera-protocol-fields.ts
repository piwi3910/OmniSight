import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    // Add protocolType field to cameras table
    await queryInterface.addColumn('cameras', 'protocolType', {
      type: DataTypes.ENUM('rtsp', 'onvif', 'hikvision', 'dahua', 'axis', 'mjpeg', 'webrtc', 'hls'),
      allowNull: true,
      defaultValue: 'rtsp'
    });

    // Update existing cameras to ensure settings is always a JSON object
    await queryInterface.sequelize.query(`
      UPDATE cameras 
      SET settings = '{}' 
      WHERE settings IS NULL OR settings::text = '';
    `);

    // Run a query to add the capability structure to existing cameras
    await queryInterface.sequelize.query(`
      UPDATE cameras 
      SET settings = jsonb_set(
        CASE 
          WHEN settings IS NULL THEN '{}'::jsonb 
          ELSE settings 
        END, 
        '{capabilities}', 
        '{"ptz": false, "presets": false, "digitalPtz": false, "motionDetection": true, "audio": false, "twoWayAudio": false, "events": true, "ioPorts": false, "privacyMask": false, "configuration": true, "wdr": false}'::jsonb,
        true
      );
    `);

    return Promise.resolve();
  },

  down: async (queryInterface: QueryInterface) => {
    // Remove protocolType field from cameras table
    await queryInterface.removeColumn('cameras', 'protocolType');

    // Remove capabilities from settings
    await queryInterface.sequelize.query(`
      UPDATE cameras 
      SET settings = settings - 'capabilities';
    `);

    return Promise.resolve();
  }
};