import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcrypt';

// User attributes interface
interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'viewer';
  lastLogin?: Date;
  settings?: object;
  createdAt: Date;
  updatedAt: Date;
}

// User creation attributes interface (optional fields)
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'lastLogin' | 'settings' | 'createdAt' | 'updatedAt'> {}

// User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: 'admin' | 'user' | 'viewer';
  public lastLogin?: Date;
  public settings?: object;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Instance methods
  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

// User model initialization function
export default (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  User.init({
    id: {
      type: dataTypes.UUID,
      defaultValue: dataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: dataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 30]
      }
    },
    email: {
      type: dataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: dataTypes.STRING,
      allowNull: false
    },
    role: {
      type: dataTypes.ENUM('admin', 'user', 'viewer'),
      defaultValue: 'user'
    },
    lastLogin: {
      type: dataTypes.DATE,
      allowNull: true
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
    tableName: 'users',
    sequelize,
    hooks: {
      beforeCreate: async (user: User) => {
        // Hash password before creating user
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user: User) => {
        // Hash password if it was changed
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  return User;
};