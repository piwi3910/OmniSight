import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../config/database';

// Import models
import CameraInit from './Camera';
import StreamInit from './Stream';
import RecordingInit from './Recording';
import SegmentInit from './Segment';
import EventInit from './Event';
import DetectedObjectInit from './DetectedObject';
import UserInit from './User';

// Initialize models
const Camera = CameraInit(sequelize, DataTypes);
const Stream = StreamInit(sequelize, DataTypes);
const Recording = RecordingInit(sequelize, DataTypes);
const Segment = SegmentInit(sequelize, DataTypes);
const Event = EventInit(sequelize, DataTypes);
const DetectedObject = DetectedObjectInit(sequelize, DataTypes);
const User = UserInit(sequelize, DataTypes);

// Define models object with a simple type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const models: any = {
  Camera,
  Stream,
  Recording,
  Segment,
  Event,
  DetectedObject,
  User
};

// Set up associations
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

export { sequelize, Sequelize };
export default models;