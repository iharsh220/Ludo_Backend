const Task = require('../models/Task');
const { taskModels, TASK_CONFIG } = require('../models');

const CROWN_POINTS = 48;

const pobUnitsPoints = (numPob) => {
  const n = parseInt(numPob, 10) || 0;
  return Math.floor(n / 5) * 2;
};

const taskController = {
  getAllTasks: async (req, res) => {
    try {
      const user = req.user && req.user.user;
      const mr_emp_code = user ? user.emp_code : null;

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
          if (cfg && mr_emp_code) {
            const models = taskModels[cfg.key];
            entry_count = await models.Entry.count({ where: { mr_emp_code } });
            document_count = await models.Doc.count({ where: { mr_emp_code } });
            pending_count = await models.Doc.count({
              where: { mr_emp_code, approval_status: 'pending' }
            });
            if (models.excludeTotalPoints) {
              const entries = await models.Entry.findAll({
                where: { mr_emp_code },
                attributes: ['num_pob']
              });
              total_points = entries.reduce((s, e) => s + pobUnitsPoints(e.num_pob), 0);
            } else {
              total_points = (await models.Entry.sum('total_points', { where: { mr_emp_code } })) || 0;
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
