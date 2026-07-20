const Organogram = require('../models/organogram');
const { CROWN_POINTS, computeMrPoints } = require('../utils/points');

const loadOrgMap = async () => {
  const rows = await Organogram.findAll({
    attributes: ['emp_code', 'level', 'region', 'AM_employee_code', 'RM_employee_code', 'ZM_employee_code']
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
  if (!['MR', 'AM', 'RM', 'ZM'].includes(user.level)) return [];
  return Object.keys(map).filter(
    (code) => code !== user.emp_code && isUnderManager(map, code, user.emp_code)
  );
};

const buildMember = async (org) => {
  const total_points = await computeMrPoints(org.emp_code);
  return {
    emp_code: org.emp_code,
    emp_name: org.emp_name,
    level: org.level,
    hq: org.hq,
    region: org.region,
    zone: org.zone,
    total_points,
    total_crowns: Math.floor(total_points / CROWN_POINTS)
  };
};

const leaderboardController = {
  teamSummary: async (req, res) => {
    try {
      const user = req.user && req.user.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (!['MR', 'AM', 'RM', 'ZM'].includes(user.level)) {
        return res.status(403).json({
          success: false,
          message: 'Only MR/AM/RM/ZM can view the team leaderboard'
        });
      }

      const map = await loadOrgMap();
      let mrCodes = [];
      if (user.level === 'MR') {
        const self = map[user.emp_code];
        const region = self ? (self.region || '').trim() : '';
        mrCodes = Object.keys(map).filter((code) => {
          const o = map[code];
          if (!o || o.level !== 'MR' || !region) return false;
          return (o.region || '').trim() === region;
        });
      } else {
        const approvable = getApprovableEmpCodes(user, map);
        mrCodes = approvable.filter((code) => map[code] && map[code].level === 'MR');
      }

      const orgRows = await Organogram.findAll({ where: { emp_code: mrCodes } });
      const members = await Promise.all(orgRows.map(buildMember));

      const team_total_points = members.reduce((s, m) => s + m.total_points, 0);
      const team_total_crowns = Math.floor(team_total_points / CROWN_POINTS);

      res.json({
        success: true,
        data: members,
        team_total_points,
        team_total_crowns
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching team summary', error: error.message });
    }
  },

  indiaSummary: async (req, res) => {
    try {
      const user = req.user && req.user.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const allMr = await Organogram.findAll({ where: { level: 'MR' } });
      const members = await Promise.all(allMr.map(buildMember));

      const india_total_points = members.reduce((s, m) => s + m.total_points, 0);
      const india_total_crowns = Math.floor(india_total_points / CROWN_POINTS);
      res.json({
        success: true,
        data: members,
        india_total_points,
        india_total_crowns
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching India summary', error: error.message });
    }
  }
};

module.exports = leaderboardController;
