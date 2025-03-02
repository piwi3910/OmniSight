import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// Event attributes interface
interface EventAttributes {
  id: string;
  recordingId: string;
  timestamp: Date;
  type: 'motion' | 'person' | 'vehicle' | 'animal' | 'custom';
  confidence?: number;
  segmentId?: string;
  thumbnailPath?: string;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Event creation attributes interface (optional fields)
interface EventCreationAttributes extends Optional<EventAttributes, 'id' | 'confidence' | 'segmentId' | 'thumbnailPath' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// Event model class
class Event extends Model<EventAttributes, EventCreationAttributes> implements EventAttributes {
  public id!: string;
  public recordingId!: string;
  public timestamp!: Date;
  public type!: 'motion' | 'person' | 'vehicle' | 'animal' | 'custom';
  public confidence?: number;
  public segmentId?: string;
  public thumbnailPath?: string;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  public static associate(models: any) {
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
  }
}

// Event model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Event.init({
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
    timestamp: {
      type: dataTypes.DATE,
      allowNull: false
    },
    type: {
      type: dataTypes.ENUM('motion', 'person', 'vehicle', 'animal', 'custom'),
      allowNull: false
    },
    confidence: {
      type: dataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    segmentId: {
      type: dataTypes.UUID,
      allowNull: true,
      references: {
        model: 'segments',
        key: 'id'
      }
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
    tableName: 'events',
    sequelize,
    indexes: [
      {
        name: 'events_recording_id_idx',
        fields: ['recording_id']
      },
      {
        name: 'events_timestamp_idx',
        fields: ['timestamp']
      },
      {
        name: 'events_type_idx',
        fields: ['type']
      }
    ]
  });

  return Event;
};