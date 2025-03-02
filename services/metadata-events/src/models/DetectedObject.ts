import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// DetectedObject attributes interface
interface DetectedObjectAttributes {
  id: string;
  eventId: string;
  type: string;
  confidence?: number;
  boundingBox?: object; // {x, y, width, height}
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// DetectedObject creation attributes interface (optional fields)
interface DetectedObjectCreationAttributes extends Optional<DetectedObjectAttributes, 'id' | 'confidence' | 'boundingBox' | 'metadata' | 'createdAt' | 'updatedAt'> {}

// DetectedObject model class
class DetectedObject extends Model<DetectedObjectAttributes, DetectedObjectCreationAttributes> implements DetectedObjectAttributes {
  public id!: string;
  public eventId!: string;
  public type!: string;
  public confidence?: number;
  public boundingBox?: object;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  public static associate(models: any) {
    DetectedObject.belongsTo(models.Event, {
      foreignKey: 'eventId',
      as: 'event'
    });
  }
}

// DetectedObject model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  DetectedObject.init({
    id: {
      type: dataTypes.UUID,
      defaultValue: dataTypes.UUIDV4,
      primaryKey: true
    },
    eventId: {
      type: dataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      }
    },
    type: {
      type: dataTypes.STRING, // e.g., 'person', 'car', 'dog'
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
    boundingBox: {
      type: dataTypes.JSONB, // {x, y, width, height}
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
    tableName: 'detected_objects',
    sequelize,
    indexes: [
      {
        name: 'detected_objects_event_id_idx',
        fields: ['event_id']
      },
      {
        name: 'detected_objects_type_idx',
        fields: ['type']
      }
    ]
  });

  return DetectedObject;
};