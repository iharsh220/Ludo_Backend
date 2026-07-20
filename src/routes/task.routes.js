const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware, taskController.getAllTasks);

module.exports = router;
