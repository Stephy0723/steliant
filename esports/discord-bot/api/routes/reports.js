// ============================================
// GlitchGang API - Reports Routes
// ============================================

const express = require('express');
const { loadReports } = require('../../services/reportService');

const router = express.Router();

// GET /reports - Get all reports
router.get('/', (req, res) => {
  res.json(loadReports());
});

// GET /reports/team/:name - Get reports for a team
router.get('/team/:name', (req, res) => {
  const reports = loadReports().filter(
    r => r.teamName.toLowerCase() === req.params.name.toLowerCase()
  );
  res.json(reports);
});

module.exports = router;
