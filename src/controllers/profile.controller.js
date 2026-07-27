const Task = require('../models/Task');
const Organogram = require('../models/organogram');
const { taskModels, TASK_CONFIG } = require('../models');
const { pobUnitsPoints } = require('../utils/points');

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

const profileController = {
  getProfile: async (req, res) => {
    try {
      const user = req.user && req.user.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

      let mrEmpCodes = [];
      if (user.level === 'MR') {
        mrEmpCodes = [user.emp_code];
      } else if (['AM', 'RM', 'ZM'].includes(user.level)) {
        const map = await loadOrgMap();
        const approvable = getApprovableEmpCodes(user, map);
        mrEmpCodes = approvable.filter((code) => map[code] && map[code].level === 'MR');
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;

      const allEntriesRaw = await Promise.all(
        Object.keys(taskModels).map(async (key) => {
          const models = taskModels[key];
          return models.Entry.findAll({
            where: { mr_emp_code: mrEmpCodes },
            include: [{ model: models.Doc, as: 'documents' }],
            order: [['created_at', 'DESC']]
          });
        })
      );

      let allEntries = [];
      allEntriesRaw.forEach((entries, idx) => {
        const key = Object.keys(taskModels)[idx];
        entries.forEach((e) => {
          allEntries.push({ entry: e, taskKey: key });
        });
      });

      allEntries.sort((a, b) => new Date(b.entry.created_at) - new Date(a.entry.created_at));

      const total = allEntries.length;
      const totalPages = Math.ceil(total / limit) || 0;
      const start = (page - 1) * limit;
      const paginated = allEntries.slice(start, start + limit);

      const uniqueMrCodes = [...new Set(paginated.map((item) => item.entry.mr_emp_code))];
      const orgRows = await Organogram.findAll({
        where: { emp_code: uniqueMrCodes },
        attributes: ['emp_code', 'emp_name', 'region', 'hq', 'zone']
      });
      const orgMap = {};
      orgRows.forEach((r) => { orgMap[r.emp_code] = r; });

      const tasks = await Task.findAll({ attributes: ['id', 'title'] });
      const taskTitleMap = {};
      tasks.forEach((t) => { taskTitleMap[t.id] = t.title; });

      const grouped = {};
      paginated.forEach((item) => {
        const entry = item.entry;
        const plain = entry.get({ plain: true });
        const org = orgMap[plain.mr_emp_code];
        const taskTitle = taskTitleMap[plain.task_id] || `Task ${plain.task_id}`;
        const models = taskModels[item.taskKey];
        let totalPoints = plain.total_points || 0;
        if (models.excludeTotalPoints && plain.num_pob !== undefined) {
          totalPoints = pobUnitsPoints(plain.num_pob);
        }

        const entryObj = {
          entry_id: plain.id,
          task_id: plain.task_id,
          mr_emp_code: plain.mr_emp_code,
          mr_name: org ? org.emp_name : '',
          region: org ? org.region : '',
          status: plain.status,
          total_points: totalPoints,
          created_at: plain.created_at,
          updated_at: plain.updated_at,
          documents: (plain.documents || []).map((d) => ({
            document_id: d.id,
            file_name: d.file_name,
            file_path: d.file_path,
            file_type: d.file_type,
            file_size: d.file_size,
            original_name: d.original_name,
            approval_status: d.approval_status,
            points: d.points,
            approved_by: d.approved_by,
            approved_at: d.approved_at,
            remarks: d.remarks,
            created_at: d.created_at,
            updated_at: d.updated_at
          }))
        };

        if (!grouped[taskTitle]) grouped[taskTitle] = [];
        grouped[taskTitle].push(entryObj);
      });

      res.json({
        success: true,
        data: grouped,
        pagination: {
          total,
          page,
          limit,
          total_pages: totalPages
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
    }
  }
};

module.exports = profileController;
