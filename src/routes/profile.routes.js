const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/profile', authMiddleware, profileController.getProfile);

module.exports = router;
