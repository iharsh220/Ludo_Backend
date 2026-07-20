const express = require('express');
const router = express.Router();

const taskRoutes = require('./task.routes');
const authRoutes = require('./auth.routes');
const taskEntryRoutes = require('./taskEntry.routes');
const fileRoutes = require('./file.routes');

router.use('/tasks', taskRoutes);
router.use('/auth', authRoutes);
router.use('/task-entries', taskEntryRoutes);
router.use('/', fileRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Corium Ludo API',
    version: '1.0.0',
    basePath: '/corium/ludo/api'
  });
});

module.exports = router;
