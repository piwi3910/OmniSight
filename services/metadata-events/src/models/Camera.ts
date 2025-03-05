import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// Camera capabilities interface
interface CameraCapabilities {
  ptz: boolean;
  presets: boolean;
  digitalPtz: boolean;
  motionDetection: boolean;
  audio: boolean;
  twoWayAudio: boolean;
  events: boolean;
  ioPorts: boolean;
  privacyMask: boolean;
  configuration: boolean;
  wdr: boolean;
}

// Camera settings interface
interface CameraSettings {
  capabilities?: CameraCapabilities;
  protocolSettings?: object;
  hardwareAcceleration?: {
    enabled: boolean;
    deviceId?: string;
    profile?: string;
  };
  [key: string]: any; // For backward compatibility with existing settings
}

// Camera attributes interface
interface CameraAttributes {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  status: 'online' | 'offline' | 'error';
  ipAddress?: string;
  model?: string;
  location?: string;
  protocolType?: 'rtsp' | 'onvif' | 'hikvision' | 'dahua' | 'axis' | 'mjpeg' | 'webrtc' | 'hls';
  settings?: CameraSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Camera creation attributes interface (optional fields)
interface CameraCreationAttributes extends Optional<CameraAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Camera model class
class Camera extends Model<CameraAttributes, CameraCreationAttributes> implements CameraAttributes {
  public id!: string;
  public name!: string;
  public rtspUrl!: string;
  public username?: string;
  public password?: string;
  public status!: 'online' | 'offline' | 'error';
  public ipAddress?: string;
  public model?: string;
  public location?: string;
  public protocolType?: 'rtsp' | 'onvif' | 'hikvision' | 'dahua' | 'axis' | 'mjpeg' | 'webrtc' | 'hls';
  public settings?: CameraSettings;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  public static associate(models: any) {
    Camera.hasMany(models.Stream, {
      foreignKey: 'cameraId',
      as: 'streams'
    });
    
    Camera.hasMany(models.Recording, {
      foreignKey: 'cameraId',
      as: 'recordings'
    });
  }
}

// Camera model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Camera.init({
    id: {
      type: dataTypes.UUID,
      defaultValue: dataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: dataTypes.STRING,
      allowNull: false
    },
    rtspUrl: {
      type: dataTypes.STRING,
      allowNull: false,
      validate: {
        isUrl: true
      }
    },
    username: {
      type: dataTypes.STRING,
      allowNull: true
    },
    password: {
      type: dataTypes.STRING,
      allowNull: true
    },
    status: {
      type: dataTypes.ENUM('online', 'offline', 'error'),
      defaultValue: 'offline'
    },
    ipAddress: {
      type: dataTypes.STRING,
      allowNull: true,
      validate: {
        isIP: true
      }
    },
    model: {
      type: dataTypes.STRING,
      allowNull: true
    },
    location: {
      type: dataTypes.STRING,
      allowNull: true
    },
    protocolType: {
      type: dataTypes.ENUM('rtsp', 'onvif', 'hikvision', 'dahua', 'axis', 'mjpeg', 'webrtc', 'hls'),
      allowNull: true,
      defaultValue: 'rtsp'
    },
    settings: {
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
    tableName: 'cameras',
    sequelize
  });

  return Camera;
};