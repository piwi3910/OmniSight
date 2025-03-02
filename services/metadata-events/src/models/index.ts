import { Sequelize, DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

// Import models
import Camera from './Camera';
import Stream from './Stream';
import Recording from './Recording';
import Segment from './Segment';
import Event from './Event';
import DetectedObject from './DetectedObject';
import User from './User';

// Initialize models
const models = {
  Camera: Camera(sequelize, DataTypes),
  Stream: Stream(sequelize, DataTypes),
  Recording: Recording(sequelize, DataTypes),
  Segment: Segment(sequelize, DataTypes),
  Event: Event(sequelize, DataTypes),
  DetectedObject: DetectedObject(sequelize, DataTypes),
  User: User(sequelize, DataTypes)
};

// Set up associations
Object.keys(models).forEach((modelName) => {
  if (models[modelName as keyof typeof models].associate) {
    models[modelName as keyof typeof models].associate(models);
  }
});

export { sequelize, Sequelize };
export default models;