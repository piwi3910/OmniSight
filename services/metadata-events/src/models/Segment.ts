import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// Segment attributes interface
interface SegmentAttributes {
  id: string;
  recordingId: string;
  streamId: string;
  filePath: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  fileSize?: number;
  format?: string;
  resolution?: string;
  thumbnailPath?: string;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Segment creation attributes interface (optional fields)
interface SegmentCreationAttributes extends Optional<SegmentAttributes, 'id' | 'endTime' | 'duration' | 'fileSize' | 'format' | 'resolution' | 'thumbnailPath' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Segment model class
class Segment extends Model<SegmentAttributes, SegmentCreationAttributes> implements SegmentAttributes {
  public id!: string;
  public recordingId!: string;
  public streamId!: string;
  public filePath!: string;
  public startTime!: Date;
  public endTime?: Date;
  public duration?: number;
  public fileSize?: number;
  public format?: string;
  public resolution?: string;
  public thumbnailPath?: string;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  public static associate(models: any) {
    Segment.belongsTo(models.Recording, {
      foreignKey: 'recordingId',
      as: 'recording'
    });
    
    Segment.belongsTo(models.Stream, {
      foreignKey: 'streamId',
      as: 'stream'
    });
    
    Segment.hasMany(models.Event, {
      foreignKey: 'segmentId',
      as: 'events'
    });
  }
}

// Segment model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Segment.init({
    id: {
      type: dataTypes.UUID,
      defaultValue: dataTypes.UUIDV4,
      primaryKey: true
    },
    recordingId: {
      type: dataTypes.UUID,
      allowNull: false,
      references: {
        model: 'recordings',
        key: 'id'
      }
    },
    streamId: {
      type: dataTypes.UUID,
      allowNull: false,
      references: {
        model: 'streams',
        key: 'id'
      }
    },
    filePath: {
      type: dataTypes.STRING,
      allowNull: false
    },
    startTime: {
      type: dataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: dataTypes.DATE,
      allowNull: true
    },
    duration: {
      type: dataTypes.INTEGER, // in seconds
      allowNull: true
    },
    fileSize: {
      type: dataTypes.BIGINT, // in bytes
      allowNull: true
    },
    format: {
      type: dataTypes.STRING, // e.g., 'mp4', 'mkv'
      allowNull: true
    },
    resolution: {
      type: dataTypes.STRING, // e.g., '1920x1080'
      allowNull: true
    },
    thumbnailPath: {
      type: dataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: dataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: dataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: dataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'segments',
    sequelize,
    hooks: {
      beforeUpdate: (segment: Segment) => {
        // Calculate duration if endTime is set
        if (segment.endTime && segment.startTime) {
          const startTime = new Date(segment.startTime);
          const endTime = new Date(segment.endTime);
          segment.duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
      }
    }
  });

  return Segment;
};