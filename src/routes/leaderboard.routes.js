const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/team-summary', authMiddleware, leaderboardController.teamSummary);
router.get('/india-summary', authMiddleware, leaderboardController.indiaSummary);
router.get('/managers-summary', authMiddleware, leaderboardController.managersSummary);

module.exports = router;
