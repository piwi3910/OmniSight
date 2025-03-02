import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// Stream attributes interface
interface StreamAttributes {
  id: string;
  cameraId: string;
  status: 'active' | 'inactive' | 'error';
  startedAt?: Date;
  endedAt?: Date;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

// Stream creation attributes interface (optional fields)
interface StreamCreationAttributes extends Optional<StreamAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Stream model class
class Stream extends Model<StreamAttributes, StreamCreationAttributes> implements StreamAttributes {
  public id!: string;
  public cameraId!: string;
  public status!: 'active' | 'inactive' | 'error';
  public startedAt?: Date;
  public endedAt?: Date;
  public metadata?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  public static associate(models: any) {
    Stream.belongsTo(models.Camera, {
      foreignKey: 'cameraId',
      as: 'camera'
    });
    
    Stream.hasMany(models.Segment, {
      foreignKey: 'streamId',
      as: 'segments'
    });
  }
}

// Stream model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Stream.init({
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
    status: {
      type: dataTypes.ENUM('active', 'inactive', 'error'),
      defaultValue: 'inactive'
    },
    startedAt: {
      type: dataTypes.DATE,
      allowNull: true
    },
    endedAt: {
      type: dataTypes.DATE,
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
    tableName: 'streams',
    sequelize
  });

  return Stream;
};