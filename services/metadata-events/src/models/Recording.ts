import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// Recording attributes interface
interface RecordingAttributes {
  id: string;
  cameraId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'recording' | 'completed' | 'error';
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Recording creation attributes interface (optional fields)
interface RecordingCreationAttributes extends Optional<RecordingAttributes, 'id' | 'endTime' | 'duration' | 'createdAt' | 'updatedAt'> {}

// Recording model class
class Recording extends Model<RecordingAttributes, RecordingCreationAttributes> implements RecordingAttributes {
  public id!: string;
  public cameraId!: string;
  public startTime!: Date;
  public endTime?: Date;
  public duration?: number;
  public status!: 'recording' | 'completed' | 'error';
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  public static associate(models: any) {
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
  }
}

// Recording model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Recording.init({
    id: {
      type: dataTypes.UUID,
      defaultValue: dataTypes.UUIDV4,
      primaryKey: true
    },
    cameraId: {
      type: dataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cameras',
        key: 'id'
      }
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
    status: {
      type: dataTypes.ENUM('recording', 'completed', 'error'),
      defaultValue: 'recording'
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
    tableName: 'recordings',
    sequelize,
    hooks: {
      beforeUpdate: (recording: Recording) => {
        // Calculate duration if endTime is set
        if (recording.endTime && recording.startTime) {
          const startTime = new Date(recording.startTime);
          const endTime = new Date(recording.endTime);
          recording.duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
      }
    }
  });

  return Recording;
};