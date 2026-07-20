const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Organogram = sequelize.define('Organogram', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  emp_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  emp_name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  level: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  hq: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  region: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  zone: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  division: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  sap: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  AM_employee_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  RM_employee_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ZM_employee_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  mobileno: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email_id: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: {
      isEmail: true
    }
  }
}, {
  tableName: 'organogram',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Organogram;
