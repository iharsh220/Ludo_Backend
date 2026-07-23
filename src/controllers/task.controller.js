const Task = require('../models/Task');
const Organogram = require('../models/organogram');
const { taskModels, TASK_CONFIG } = require('../models');

const CROWN_POINTS = 48;

const pobUnitsPoints = (numPob) => {
  const n = parseInt(numPob, 10) || 0;
  return Math.floor(n / 5) * 2;
};

const loadOrgMap = async () => {
  const rows = await Organogram.findAll({
    attributes: ['emp_code', 'level', 'AM_employee_code', 'RM_employee_code', 'ZM_employee_code']
  });
  const map = {};
  rows.forEach((r) => { map[r.emp_code] = r; });
  return map;
};

const isUnderManager = (map, ownerCode, managerCode, visited = new Set()) => {
  if (!ownerCode || visited.has(ownerCode)) return false;
  visited.add(ownerCode);
  const o = map[ownerCode];
  if (!o) return false;
  const managers = [o.AM_employee_code, o.RM_employee_code, o.ZM_employee_code].filter(Boolean);
  if (managers.includes(managerCode)) return true;
  return managers.some((m) => isUnderManager(map, m, managerCode, visited));
};

const getApprovableEmpCodes = (user, map) => {
  if (!['AM', 'RM', 'ZM'].includes(user.level)) return [];
  return Object.keys(map).filter(
    (code) => code !== user.emp_code && isUnderManager(map, code, user.emp_code)
  );
};

const taskController = {
  getAllTasks: async (req, res) => {
    try {
      const user = req.user && req.user.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

      let mrCodes;
      if (user.level === 'MR') {
        mrCodes = [user.emp_code];
      } else if (['AM', 'RM', 'ZM'].includes(user.level)) {
        const map = await loadOrgMap();
        const approvable = getApprovableEmpCodes(user, map);
        mrCodes = approvable.filter((code) => map[code] && map[code].level === 'MR');
      } else {
        mrCodes = [];
      }

      const tasks = await Task.findAll({
        attributes: ['id', 'title', 'description', 'created_at', 'updated_at']
      });

      const data = await Promise.all(
        tasks.map(async (task) => {
          const cfg = TASK_CONFIG.find((c) => c.taskId === task.id);
          let entry_count = 0;
          let total_points = 0;
          let document_count = 0;
          let pending_count = 0;
          if (cfg && mrCodes && mrCodes.length) {
            const models = taskModels[cfg.key];
            entry_count = await models.Doc.count({ where: { mr_emp_code: mrCodes, approval_status: 'approved' } });
            document_count = await models.Doc.count({ where: { mr_emp_code: mrCodes } });
            pending_count = await models.Doc.count({
              where: { mr_emp_code: mrCodes, approval_status: 'pending' }
            });
            if (models.excludeTotalPoints) {
              const entries = await models.Entry.findAll({
                where: { mr_emp_code: mrCodes },
                attributes: ['num_pob']
              });
              entries.forEach((e) => {
                total_points += pobUnitsPoints(e.num_pob);
              });
            } else {
              total_points = (await models.Entry.sum('total_points', { where: { mr_emp_code: mrCodes } })) || 0;
            }
          }
          return {
            ...task.get({ plain: true }),
            entry_count,
            document_count,
            pending_count,
            total_points
          };
        })
      );

      const grandTotal = data.reduce((sum, t) => sum + (t.total_points || 0), 0);
      const total_pending = data.reduce((sum, t) => sum + (t.pending_count || 0), 0);

      res.json({
        success: true,
        data,
        total_points: grandTotal,
        total_pending,
        my_crowns: Math.floor(grandTotal / CROWN_POINTS)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching tasks',
        error: error.message
      });
    }
  }
};

module.exports = taskController;
