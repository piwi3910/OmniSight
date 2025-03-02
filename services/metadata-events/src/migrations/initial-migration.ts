const { DataTypes } = require('sequelize');

// @ts-ignore
module.exports = {
  // @ts-ignore
  up: async (queryInterface, sequelize) => {
    // Create cameras table
    await queryInterface.createTable('cameras', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      rtsp_url: {
        type: DataTypes.STRING,
        allowNull: false
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('online', 'offline', 'error'),
        defaultValue: 'offline'
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      model: {
        type: DataTypes.STRING,
        allowNull: true
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true
      },
      settings: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create streams table
    await queryInterface.createTable('streams', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      camera_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'cameras',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'error'),
        defaultValue: 'inactive'
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ended_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create recordings table
    await queryInterface.createTable('recordings', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      camera_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'cameras',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: false
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: true
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('recording', 'completed', 'error'),
        defaultValue: 'recording'
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create segments table
    await queryInterface.createTable('segments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      recording_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'recordings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      stream_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'streams',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      file_path: {
        type: DataTypes.STRING,
        allowNull: false
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: false
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: true
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      file_size: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      format: {
        type: DataTypes.STRING,
        allowNull: true
      },
      resolution: {
        type: DataTypes.STRING,
        allowNull: true
      },
      thumbnail_path: {
        type: DataTypes.STRING,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create events table
    await queryInterface.createTable('events', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      recording_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'recordings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('motion', 'person', 'vehicle', 'animal', 'custom'),
        allowNull: false
      },
      confidence: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      segment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'segments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      thumbnail_path: {
        type: DataTypes.STRING,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create detected_objects table
    await queryInterface.createTable('detected_objects', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      event_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      confidence: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      bounding_box: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      role: {
        type: DataTypes.ENUM('admin', 'user', 'viewer'),
        defaultValue: 'user'
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true
      },
      settings: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create indexes
    // Camera indexes
    await queryInterface.addIndex('cameras', ['status']);
    
    // Stream indexes
    await queryInterface.addIndex('streams', ['camera_id']);
    await queryInterface.addIndex('streams', ['status']);
    await queryInterface.addIndex('streams', ['started_at']);
    
    // Recording indexes
    await queryInterface.addIndex('recordings', ['camera_id']);
    await queryInterface.addIndex('recordings', ['start_time']);
    await queryInterface.addIndex('recordings', ['status']);
    
    // Segment indexes
    await queryInterface.addIndex('segments', ['recording_id']);
    await queryInterface.addIndex('segments', ['stream_id']);
    await queryInterface.addIndex('segments', ['start_time']);
    
    // Event indexes
    await queryInterface.addIndex('events', ['recording_id']);
    await queryInterface.addIndex('events', ['timestamp']);
    await queryInterface.addIndex('events', ['type']);
    
    // DetectedObject indexes
    await queryInterface.addIndex('detected_objects', ['event_id']);
    await queryInterface.addIndex('detected_objects', ['type']);
  },

  // @ts-ignore
  down: async (queryInterface, sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('detected_objects');
    await queryInterface.dropTable('events');
    await queryInterface.dropTable('segments');
    await queryInterface.dropTable('recordings');
    await queryInterface.dropTable('streams');
    await queryInterface.dropTable('cameras');
    await queryInterface.dropTable('users');
    
    // Drop ENUMs
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cameras_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_streams_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_recordings_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_events_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  }
};