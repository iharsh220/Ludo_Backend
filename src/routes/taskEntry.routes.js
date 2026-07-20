const express = require('express');
const router = express.Router();
const taskEntryController = require('../controllers/taskEntry.controller');
const upload = require('../middleware/upload.middleware');
const authMiddleware = require('../middleware/auth.middleware');

const requireMr = (req, res, next) => {
  const user = req.user && req.user.user;
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (user.level !== 'MR') {
    return res.status(403).json({ success: false, message: 'Only MRs are allowed to create task entries' });
  }
  next();
};

const requireManager = (req, res, next) => {
  const user = req.user && req.user.user;
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (user.level === 'MR') {
    return res.status(403).json({ success: false, message: 'Only AM/RM/ZM can access this' });
  }
  next();
};

router.post('/:taskKey/entries', authMiddleware, requireMr, upload.array('documents'), taskEntryController.createEntry);
router.get('/:taskKey/entries', authMiddleware, requireManager, taskEntryController.getEntries);
router.get('/:taskKey/documents/pending', authMiddleware, requireManager, taskEntryController.getPendingDocuments);
router.post('/:taskKey/documents/approve', authMiddleware, taskEntryController.approveDocuments);

module.exports = router;
