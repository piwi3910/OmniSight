# OmniSight Database Schema with Sequelize ORM

This document outlines the database schema for the OmniSight system, implemented using Sequelize ORM with PostgreSQL.

## Database Models

### Camera Model

```javascript
// models/camera.js
module.exports = (sequelize, DataTypes) => {
  const Camera = sequelize.define('Camera', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rtspUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isUrl: true
      }
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
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIP: true
      }
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'cameras',
    timestamps: true
  });

  Camera.associate = (models) => {
    Camera.hasMany(models.Stream, {
      foreignKey: 'cameraId',
      as: 'streams'
    });
    
    Camera.hasMany(models.Recording, {
      foreignKey: 'cameraId',
      as: 'recordings'
    });
  };

  return Camera;
};
```

### Stream Model

```javascript
// models/stream.js
module.exports = (sequelize, DataTypes) => {
  const Stream = sequelize.define('Stream', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cameraId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cameras',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'error'),
      defaultValue: 'inactive'
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'streams',
    timestamps: true
  });

  Stream.associate = (models) => {
    Stream.belongsTo(models.Camera, {
      foreignKey: 'cameraId',
      as: 'camera'
    });
    
    Stream.hasMany(models.Segment, {
      foreignKey: 'streamId',
      as: 'segments'
    });
  };

  return Stream;
};
```

### Recording Model

```javascript
// models/recording.js
module.exports = (sequelize, DataTypes) => {
  const Recording = sequelize.define('Recording', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cameraId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cameras',
        key: 'id'
      }
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER, // in seconds
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'recordings',
    timestamps: true
  });

  Recording.associate = (models) => {
    Recording.belongsTo(models.Camera, {
      foreignKey: 'cameraId',
      as: 'camera'
    });
    
    Recording.hasMany(models.Segment, {
      foreignKey: 'recordingId',
      as: 'segments'
    });
    
    Recording.hasMany(models.Event, {
      foreignKey: 'recordingId',
      as: 'events'
    });
  };

  return Recording;
};
```

### Segment Model

```javascript
// models/segment.js
module.exports = (sequelize, DataTypes) => {
  const Segment = sequelize.define('Segment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    recordingId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'recordings',
        key: 'id'
      }
    },
    streamId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'streams',
        key: 'id'
      }
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER, // in seconds
      allowNull: true
    },
    fileSize: {
      type: DataTypes.BIGINT, // in bytes
      allowNull: true
    },
    format: {
      type: DataTypes.STRING, // e.g., 'mp4', 'mkv'
      allowNull: true
    },
    resolution: {
      type: DataTypes.STRING, // e.g., '1920x1080'
      allowNull: true
    },
    thumbnailPath: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'segments',
    timestamps: true
  });

  Segment.associate = (models) => {
    Segment.belongsTo(models.Recording, {
      foreignKey: 'recordingId',
      as: 'recording'
    });
    
    Segment.belongsTo(models.Stream, {
      foreignKey: 'streamId',
      as: 'stream'
    });
  };

  return Segment;
};
```

### Event Model

```javascript
// models/event.js
module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    recordingId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'recordings',
        key: 'id'
      }
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
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    segmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'segments',
        key: 'id'
      }
    },
    thumbnailPath: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'events',
    timestamps: true
  });

  Event.associate = (models) => {
    Event.belongsTo(models.Recording, {
      foreignKey: 'recordingId',
      as: 'recording'
    });
    
    Event.belongsTo(models.Segment, {
      foreignKey: 'segmentId',
      as: 'segment'
    });
    
    Event.hasMany(models.DetectedObject, {
      foreignKey: 'eventId',
      as: 'detectedObjects'
    });
  };

  return Event;
};
```

### DetectedObject Model

```javascript
// models/detectedObject.js
module.exports = (sequelize, DataTypes) => {
  const DetectedObject = sequelize.define('DetectedObject', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.STRING, // e.g., 'person', 'car', 'dog'
      allowNull: false
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    boundingBox: {
      type: DataTypes.JSONB, // {x, y, width, height}
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'detected_objects',
    timestamps: true
  });

  DetectedObject.associate = (models) => {
    DetectedObject.belongsTo(models.Event, {
      foreignKey: 'eventId',
      as: 'event'
    });
  };

  return DetectedObject;
};
```

### User Model

```javascript
// models/user.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
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
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'user', 'viewer'),
      defaultValue: 'user'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'users',
    timestamps: true
  });

  return User;
};
```

## Sequelize Index Setup

```javascript
// migrations/YYYYMMDDHHMMSS-add-indexes.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Camera indexes
    await queryInterface.addIndex('cameras', ['status']);
    
    // Stream indexes
    await queryInterface.addIndex('streams', ['cameraId']);
    await queryInterface.addIndex('streams', ['status']);
    await queryInterface.addIndex('streams', ['startedAt']);
    
    // Recording indexes
    await queryInterface.addIndex('recordings', ['cameraId']);
    await queryInterface.addIndex('recordings', ['startTime']);
    await queryInterface.addIndex('recordings', ['status']);
    
    // Segment indexes
    await queryInterface.addIndex('segments', ['recordingId']);
    await queryInterface.addIndex('segments', ['streamId']);
    await queryInterface.addIndex('segments', ['startTime']);
    
    // Event indexes
    await queryInterface.addIndex('events', ['recordingId']);
    await queryInterface.addIndex('events', ['timestamp']);
    await queryInterface.addIndex('events', ['type']);
    
    // DetectedObject indexes
    await queryInterface.addIndex('detected_objects', ['eventId']);
    await queryInterface.addIndex('detected_objects', ['type']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all indexes
    await queryInterface.removeIndex('cameras', ['status']);
    
    await queryInterface.removeIndex('streams', ['cameraId']);
    await queryInterface.removeIndex('streams', ['status']);
    await queryInterface.removeIndex('streams', ['startedAt']);
    
    await queryInterface.removeIndex('recordings', ['cameraId']);
    await queryInterface.removeIndex('recordings', ['startTime']);
    await queryInterface.removeIndex('recordings', ['status']);
    
    await queryInterface.removeIndex('segments', ['recordingId']);
    await queryInterface.removeIndex('segments', ['streamId']);
    await queryInterface.removeIndex('segments', ['startTime']);
    
    await queryInterface.removeIndex('events', ['recordingId']);
    await queryInterface.removeIndex('events', ['timestamp']);
    await queryInterface.removeIndex('events', ['type']);
    
    await queryInterface.removeIndex('detected_objects', ['eventId']);
    await queryInterface.removeIndex('detected_objects', ['type']);
  }
};
```

## Sequelize Model Initialization

```javascript
// models/index.js
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require('../config/database.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
```

## Sequelize Database Configuration

```javascript
// config/database.js
module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'omnisight_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    define: {
      timestamps: true,
      underscored: true
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'omnisight_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps: true,
      underscored: true
    }
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps: true,
      underscored: true
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};
```

## Sequelize Migrations

### Create Tables Migration

```javascript
// migrations/YYYYMMDDHHMMSS-create-tables.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create cameras table
    await queryInterface.createTable('cameras', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rtsp_url: {
        type: Sequelize.STRING,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        allowNull: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('online', 'offline', 'error'),
        defaultValue: 'offline'
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      model: {
        type: Sequelize.STRING,
        allowNull: true
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true
      },
      settings: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create streams table
    await queryInterface.createTable('streams', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      camera_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cameras',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'error'),
        defaultValue: 'inactive'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create recordings table
    await queryInterface.createTable('recordings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      camera_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cameras',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('recording', 'completed', 'error'),
        defaultValue: 'recording'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create segments table
    await queryInterface.createTable('segments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      recording_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'recordings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      stream_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'streams',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      file_path: {
        type: Sequelize.STRING,
        allowNull: false
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      format: {
        type: Sequelize.STRING,
        allowNull: true
      },
      resolution: {
        type: Sequelize.STRING,
        allowNull: true
      },
      thumbnail_path: {
        type: Sequelize.STRING,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create events table
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      recording_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'recordings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('motion', 'person', 'vehicle', 'animal', 'custom'),
        allowNull: false
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      segment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'segments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      thumbnail_path: {
        type: Sequelize.STRING,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create detected_objects table
    await queryInterface.createTable('detected_objects', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      bounding_box: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('admin', 'user', 'viewer'),
        defaultValue: 'user'
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true
      },
      settings: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
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
```

## Sequelize Seeders

```javascript
// seeders/YYYYMMDDHHMMSS-demo-data.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add demo user
    await queryInterface.bulkInsert('users', [{
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'admin@example.com',
      password: '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // hashed 'password'
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Add demo camera
    await queryInterface.bulkInsert('cameras', [{
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Camera',
      rtsp_url: 'rtsp://example.com/stream1',
      status: 'offline',
      location: 'Front Door',
      created_at: new Date(),
      updated_at: new Date()
    }]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('cameras', null, {});
  }
};
```

## Sequelize Usage Examples

### Basic CRUD Operations

```javascript
// Create a new camera
const createCamera = async (cameraData) => {
  try {
    const camera = await Camera.create(cameraData);
    return camera;
  } catch (error) {
    console.error('Error creating camera:', error);
    throw error;
  }
};

// Find a camera by ID
const findCameraById = async (id) => {
  try {
    const camera = await Camera.findByPk(id);
    return camera;
  } catch (error) {
    console.error('Error finding camera:', error);
    throw error;
  }
};

// Update a camera
const updateCamera = async (id, cameraData) => {
  try {
    const [updated] = await Camera.update(cameraData, {
      where: { id }
    });
    if (updated) {
      const updatedCamera = await Camera.findByPk(id);
      return updatedCamera;
    }
    throw new Error('Camera not found');
  } catch (error) {
    console.error('Error updating camera:', error);
    throw error;
  }
};

// Delete a camera
const deleteCamera = async (id) => {
  try {
    const deleted = await Camera.destroy({
      where: { id }
    });
    return deleted;
  } catch (error) {
    console.error('Error deleting camera:', error);
    throw error;
  }
};
```

### Advanced Queries with Associations

```javascript
// Find all recordings for a camera with segments
const findCameraRecordings = async (cameraId) => {
  try {
    const recordings = await Recording.findAll({
      where: { cameraId },
      include: [
        {
          model: Segment,
          as: 'segments'
        }
      ],
      order: [['startTime', 'DESC']]
    });
    return recordings;
  } catch (error) {
    console.error('Error finding camera recordings:', error);
    throw error;
  }
};

// Find all events with detected objects
const findEventsWithObjects = async (options) => {
  try {
    const { recordingId, type, startTime, endTime, limit = 10, offset = 0 } = options;
    
    const whereClause = {};
    if (recordingId) whereClause.recordingId = recordingId;
    if (type) whereClause.type = type;
    
    if (startTime || endTime) {
      whereClause.timestamp = {};
      if (startTime) whereClause.timestamp[Op.gte] = startTime;
      if (endTime) whereClause.timestamp[Op.lte] = endTime;
    }
    
    const events = await Event.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: DetectedObject,
          as: 'detectedObjects'
        },
        {
          model: Recording,
          as: 'recording',
          include: [
            {
              model: Camera,
              as: 'camera',
              attributes: ['id', 'name', 'location']
            }
          ]
        }
      ],
      order: [['timestamp', 'DESC']],
      limit,
      offset
    });
    
    return events;
  } catch (error) {
    console.error('Error finding events:', error);
    throw error;
  }
};
```

### Transactions

```javascript
// Create a recording with segments in a transaction
const createRecordingWithSegments = async (recordingData, segmentsData) => {
  const t = await sequelize.transaction();
  
  try {
    // Create recording
    const recording = await Recording.create(recordingData, { transaction: t });
    
    // Create segments with recording ID
    const segments = await Promise.all(
      segmentsData.map(segmentData => 
        Segment.create({
          ...segmentData,
          recordingId: recording.id
        }, { transaction: t })
      )
    );
    
    // Commit transaction
    await t.commit();
    
    return { recording, segments };
  } catch (error) {
    // Rollback transaction on error
    await t.rollback();
    console.error('Error creating recording with segments:', error);
    throw error;
  }
};
```

## Sequelize Hooks

```javascript
// Example of using hooks in the Camera model
Camera.beforeCreate(async (camera) => {
  // Perform validation or transformation before creating
  camera.name = camera.name.trim();
});

Camera.afterCreate(async (camera) => {
  // Perform actions after camera is created
  console.log(`New camera created: ${camera.name}`);
});

// Example of using hooks in the Recording model
Recording.beforeUpdate(async (recording) => {
  // Calculate duration if endTime is set
  if (recording.endTime && recording.startTime) {
    const startTime = new Date(recording.startTime);
    const endTime = new Date(recording.endTime);
    recording.duration = Math.floor((endTime - startTime) / 1000);
  }
});
```

## Sequelize Scopes

```javascript
// Define scopes in the Camera model
Camera.init({
  // ... model attributes
}, {
  scopes: {
    online: {
      where: {
        status: 'online'
      }
    },
    withStreams: {
      include: [
        {
          model: sequelize.models.Stream,
          as: 'streams'
        }
      ]
    },
    withActiveStreams: {
      include: [
        {
          model: sequelize.models.Stream,
          as: 'streams',
          where: {
            status: 'active'
          }
        }
      ]
    }
  }
});

// Usage of scopes
const onlineCameras = await Camera.scope('online').findAll();
const camerasWithStreams = await Camera.scope('withStreams').findAll();
const camerasWithActiveStreams = await Camera.scope('withActiveStreams').findAll();
```

## Sequelize Migrations CLI Commands

```bash
# Create a new migration
npx sequelize-cli migration:generate --name create-tables

# Run migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Create a seeder
npx sequelize-cli seed:generate --name demo-data

# Run seeders
npx sequelize-cli db:seed:all

# Undo seeders
npx sequelize-cli db:seed:undo:all