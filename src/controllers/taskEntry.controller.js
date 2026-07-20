const { taskModels } = require('../models');
const Organogram = require('../models/organogram');
const fs = require('fs');
const path = require('path');
const uploadMiddleware = require('../middleware/upload.middleware');
const uploadDir = uploadMiddleware.uploadDir;

const cleanupFiles = (files) => {
  if (!Array.isArray(files)) return;
  files.forEach((f) => {
    try { if (f.path) fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
  });
};

const getUser = (req) => (req.user && req.user.user) || null;
const isManager = (level) => ['AM', 'RM', 'ZM'].includes(level);

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
  if (!isManager(user.level)) return [];
  return Object.keys(map).filter(
    (code) => code !== user.emp_code && isUnderManager(map, code, user.emp_code)
  );
};

const pickKnown = (model, body) => {
  const attrs = Object.keys(model.getAttributes());
  const data = {};
  for (const key of attrs) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
};

const prescCountFieldByTask = { 4: 'num_prescriptions' };

const PER_IMAGE_APPROVAL_POINTS = { 4: 2 };

const TASK1_FLAT_POINTS = 6;

const pobUnitsPoints = (numPob) => {
  const n = parseInt(numPob, 10) || 0;
  return Math.floor(n / 5) * 2;
};

const taskEntryController = {
  createEntry: async (req, res) => {
    try {
      const models = taskModels[req.params.taskKey];
      if (!models) return res.status(404).json({ success: false, message: 'Task not found' });

      const user = getUser(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (user.level !== 'MR') {
        return res.status(403).json({ success: false, message: 'Only MRs are allowed to create task entries' });
      }

      const mr_emp_code = user.emp_code;
      if (!mr_emp_code) return res.status(400).json({ success: false, message: 'mr_emp_code is required' });

      const mr = await Organogram.findOne({ where: { emp_code: mr_emp_code } });
      if (!mr) return res.status(404).json({ success: false, message: 'MR not found' });

      const files = req.files && req.files.length ? req.files : [];

      const taskId = models.taskId;
      if (taskId === 1) {
        const numPrescriptions = parseInt(req.body.num_prescriptions, 10);
        const numPob = parseInt(req.body.num_pob, 10);
        if ((!numPrescriptions || numPrescriptions <= 0) && (!numPob || numPob <= 0)) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: 'Either num_prescriptions or num_pob is required for Doctor Conversions task.'
          });
        }
        if (files.length < 1) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: 'At least 1 image is required for Doctor Conversions task.'
          });
        }
      }
      if (taskId === 2 || taskId === 3) {
        if (files.length !== 1) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: `Task ${taskId} allows exactly 1 image, got ${files.length}.`
          });
        }
      }
      if (taskId === 2) {
        const numPob = parseInt(req.body.num_pob, 10);
        if (!numPob || numPob <= 0) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: 'num_pob (units) is required and must be greater than 0 for POB task.'
          });
        }
      }
      if (taskId === 3) {
        const doctorName = (req.body.doctor_name || '').toString().trim();
        const pcode = (req.body.pcode || '').toString().trim();
        if (!doctorName || !pcode) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: 'doctor_name and pcode are both required for Combo POB task.'
          });
        }
        const tab1 = parseInt(req.body.tab1_units, 10);
        const tab2 = parseInt(req.body.tab2_units, 10);
        if (!tab1 || tab1 <= 0 || !tab2 || tab2 <= 0) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: 'Both tab1_units and tab2_units are required and must be greater than 0 for Combo POB task.'
          });
        }
      }
      if (taskId === 4) {
        const prescField = prescCountFieldByTask[taskId];
        const expected = parseInt(req.body[prescField], 10) || 0;
        const actual = files.length;
        if (expected !== actual) {
          cleanupFiles(files);
          return res.status(400).json({
            success: false,
            message: `Number of uploaded images (${actual}) must equal ${prescField} (${expected}) for this task.`
          });
        }
      }

      const data = pickKnown(models.Entry, req.body);
      data.mr_emp_code = mr_emp_code;
      data.task_id = models.taskId;
      const entry = await models.Entry.create(data);

      const documents = await Promise.all(
        files.map((file) =>
          models.Doc.create({
            task_entry_id: entry.id,
            mr_emp_code,
            original_name: file.originalname,
            file_name: file.filename,
            file_path: path.relative(uploadDir, file.path),
            file_type: file.mimetype,
            file_size: file.size,
            approval_status: 'pending',
            points: 0
          })
        )
      );

      res.status(201).json({ success: true, message: 'Entry created', data: { entry, documents } });
    } catch (error) {
      cleanupFiles(req.files);
      res.status(500).json({ success: false, message: 'Error creating entry', error: error.message });
    }
  },

  getEntries: async (req, res) => {
    try {
      const models = taskModels[req.params.taskKey];
      if (!models) return res.status(404).json({ success: false, message: 'Task not found' });

      const user = getUser(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (user.level === 'MR') {
        return res.status(403).json({ success: false, message: 'Only AM/RM/ZM can access this' });
      }

      let mrCodes;
      if (user && isManager(user.level)) {
        const map = await loadOrgMap();
        mrCodes = getApprovableEmpCodes(user, map);
      } else if (user) {
        mrCodes = [user.emp_code];
      } else if (req.query.mr_emp_code) {
        mrCodes = [req.query.mr_emp_code];
      } else {
        mrCodes = [];
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const offset = (page - 1) * limit;

      const result = await models.Entry.findAndCountAll({
        where: { mr_emp_code: mrCodes },
        include: [{ model: models.Doc, as: 'documents' }],
        order: [['created_at', 'DESC']],
        limit,
        offset,
        distinct: true
      });

      const orgRows = await Organogram.findAll({
        where: { emp_code: mrCodes },
        attributes: ['emp_code', 'emp_name', 'region']
      });
      const orgMap = {};
      orgRows.forEach((r) => {
        orgMap[r.emp_code] = { name: r.emp_name, region: r.region };
      });

      const rows = result.rows.map((r) => {
        const o = r.get({ plain: true });
        o.mr_details = orgMap[o.mr_emp_code] || null;
        if (models.excludeTotalPoints && o.num_pob !== undefined) {
          o.total_points = pobUnitsPoints(o.num_pob);
        }
        return o;
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: result.count,
          page,
          limit,
          total_pages: Math.ceil(result.count / limit)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching entries', error: error.message });
    }
  },

  getPendingDocuments: async (req, res) => {
    try {
      const models = taskModels[req.params.taskKey];
      if (!models) return res.status(404).json({ success: false, message: 'Task not found' });

      const user = getUser(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (user.level === 'MR') {
        return res.status(403).json({ success: false, message: 'Only AM/RM/ZM can access this' });
      }

      let mrCodes;
      if (isManager(user.level)) {
        const map = await loadOrgMap();
        mrCodes = getApprovableEmpCodes(user, map);
      } else {
        mrCodes = [user.emp_code];
      }

      const documents = await models.Doc.findAll({
        where: { approval_status: 'pending', mr_emp_code: mrCodes },
        include: [{ model: models.Entry, as: 'entry' }],
        order: [['created_at', 'ASC']]
      });
      res.json({ success: true, data: documents });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching documents', error: error.message });
    }
  },

  approveDocuments: async (req, res) => {
    try {
      const models = taskModels[req.params.taskKey];
      if (!models) return res.status(404).json({ success: false, message: 'Task not found' });

      const taskId = models.taskId;

      const user = getUser(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (user.level === 'MR') {
        return res.status(403).json({ success: false, message: 'MRs are not allowed to approve documents' });
      }

      const { approvals } = req.body;
      if (!Array.isArray(approvals) || approvals.length === 0) {
        return res.status(400).json({ success: false, message: 'approvals array is required' });
      }

      const map = await loadOrgMap();
      const approvable = new Set(getApprovableEmpCodes(user, map));
      if (approvable.size === 0) {
        return res.status(403).json({ success: false, message: 'You have no team members to approve' });
      }

      const results = [];
      for (const item of approvals) {
        const { id, status, points, remarks } = item;
        if (!['approved', 'rejected'].includes(status)) {
          results.push({ id, success: false, message: 'status must be approved or rejected' });
          continue;
        }

        const doc = await models.Doc.findByPk(id);
        if (!doc) {
          results.push({ id, success: false, message: 'Document not found' });
          continue;
        }
        if (!approvable.has(doc.mr_emp_code)) {
          results.push({ id, success: false, message: 'Not authorized to approve this document' });
          continue;
        }

        const entry = await models.Entry.findByPk(doc.task_entry_id);
        let approvedPoints = 0;
        if (status === 'approved') {
          if (taskId === 1) approvedPoints = TASK1_FLAT_POINTS;
          else if (taskId === 2) approvedPoints = pobUnitsPoints(entry ? entry.num_pob : 0);
          else if (taskId === 3) approvedPoints = 4;
          else approvedPoints = PER_IMAGE_APPROVAL_POINTS[4];
        }

        await doc.update({
          approval_status: status,
          points: approvedPoints,
          remarks: remarks || null,
          approved_by: user.emp_code,
          approved_at: new Date()
        });

        await models.recalc(doc.task_entry_id);
        results.push({ id, success: true, status, entry_points: entry.total_points });
      }

      const allOk = results.every((r) => r.success);
      res.status(allOk ? 200 : 207).json({ success: allOk, data: results });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error approving documents', error: error.message });
    }
  }
};

module.exports = taskEntryController;
