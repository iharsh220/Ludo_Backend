const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const COMMON_ENTRY_FIELDS = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mr_emp_code: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  }
};

const COMMON_DOC_FIELDS = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  task_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mr_emp_code: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  original_name: { type: DataTypes.STRING(255), allowNull: true },
  file_name: { type: DataTypes.STRING(255), allowNull: true },
  file_path: { type: DataTypes.STRING(500), allowNull: true },
  file_type: { type: DataTypes.STRING(100), allowNull: true },
  file_size: { type: DataTypes.INTEGER, allowNull: true },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  },
  points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  approved_by: { type: DataTypes.STRING(50), allowNull: true },
  approved_at: { type: DataTypes.DATE, allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true }
};

function buildModels({ key, modelName, taskId, entryFields, excludeTotalPoints, flatPoints }) {
  const EntryModel = sequelize.define(`${modelName}Entry`, {
    ...(excludeTotalPoints ? {} : { total_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 } }),
    ...COMMON_ENTRY_FIELDS,
    ...entryFields
  }, {
    tableName: `task_${key}`,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const DocModel = sequelize.define(`${modelName}Doc`, {
    ...COMMON_DOC_FIELDS
  }, {
    tableName: `task_${key}_docs`,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  EntryModel.hasMany(DocModel, { foreignKey: 'task_entry_id', as: 'documents', constraints: false });
  DocModel.belongsTo(EntryModel, { foreignKey: 'task_entry_id', as: 'entry', constraints: false });

  const recalc = async (entryId) => {
    const entry = await EntryModel.findByPk(entryId);
    if (!entry) return;
    const approved = await DocModel.findAll({ where: { task_entry_id: entryId, approval_status: 'approved' } });
    let totalPoints = approved.reduce((s, d) => s + (d.points || 0), 0);
    if (flatPoints && approved.length > 0) totalPoints = flatPoints;
    const all = await DocModel.findAll({ where: { task_entry_id: entryId } });
    let status = entry.status;
    if (all.length > 0) {
      const anyRejected = all.some((d) => d.approval_status === 'rejected');
      const allApproved = all.every((d) => d.approval_status === 'approved');
      if (allApproved) status = 'approved';
      else if (anyRejected) status = 'rejected';
      else status = 'pending';
    }
    const update = { status };
    if (!excludeTotalPoints) update.total_points = totalPoints;
    await entry.update(update);
  };

  DocModel.addHook('afterUpdate', async (doc) => {
    if (doc.changed('approval_status') || doc.changed('points')) await recalc(doc.task_entry_id);
  });
  DocModel.addHook('afterDestroy', async (doc) => { await recalc(doc.task_entry_id); });

  return { Entry: EntryModel, Doc: DocModel, recalc, taskId, excludeTotalPoints: !!excludeTotalPoints, flatPoints };
}

const TASK_CONFIG = [
  {
    key: 'doctor_conversions',
    modelName: 'DoctorConversions',
    taskId: 1,
    flatPoints: 6,
    entryFields: {
      doctor_name: { type: DataTypes.STRING(200), allowNull: true },
      pcode: { type: DataTypes.STRING(50), allowNull: true },
      num_prescriptions: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      num_pob: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
    }
  },
  {
    key: 'pob',
    modelName: 'Pob',
    taskId: 2,
    excludeTotalPoints: true,
    entryFields: {
      doctor_name: { type: DataTypes.STRING(200), allowNull: true },
      pcode: { type: DataTypes.STRING(50), allowNull: true },
      num_pob: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
    }
  },
  {
    key: 'combo_pob',
    modelName: 'ComboPob',
    taskId: 3,
    entryFields: {
      doctor_name: { type: DataTypes.STRING(200), allowNull: true },
      pcode: { type: DataTypes.STRING(50), allowNull: true },
      tab1_units: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      tab2_units: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
    }
  },
  {
    key: 'live_prescriptions',
    modelName: 'LivePrescriptions',
    taskId: 4,
    entryFields: {
      doctor_name: { type: DataTypes.STRING(200), allowNull: true },
      pcode: { type: DataTypes.STRING(50), allowNull: true },
      num_prescriptions: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
    }
  },
  {
    key: 'jcc_conversion',
    modelName: 'JccConversion',
    taskId: 5,
    entryFields: {
      meeting_with: { type: DataTypes.ENUM('AM', 'RM', 'ZM'), allowNull: true },
      doctor_name: { type: DataTypes.STRING(200), allowNull: true },
      pcode: { type: DataTypes.STRING(50), allowNull: true },
      num_prescriptions_pob: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }
    }
  }
];

const taskModels = {};
for (const cfg of TASK_CONFIG) {
  taskModels[cfg.key] = buildModels(cfg);
}

module.exports = { taskModels, TASK_CONFIG };
