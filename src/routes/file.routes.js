const express = require('express');
const path = require('path');
const uploadMiddleware = require('../middleware/upload.middleware');

const uploadDir = uploadMiddleware.uploadDir;
const router = express.Router();

router.get('/:taskKey/:emp/:date/:filename', (req, res) => {
  const { taskKey, emp, date, filename } = req.params;
  const parts = [taskKey, emp, date, filename].map((p) =>
    path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '')
  );
  const abs = path.resolve(uploadDir, parts[0], parts[1], parts[2], parts[3]);
  const base = path.resolve(uploadDir);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    return res.status(400).json({ success: false, message: 'Invalid path' });
  }
  res.sendFile(abs, (err) => {
    if (err) res.status(404).json({ success: false, message: 'File not found' });
  });
});

module.exports = router;
