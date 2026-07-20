const { taskModels } = require('../models');

const CROWN_POINTS = 48;

const pobUnitsPoints = (numPob) => {
  const n = parseInt(numPob, 10) || 0;
  return Math.floor(n / 5) * 2;
};

const computeMrPoints = async (mr_emp_code) => {
  let total_points = 0;
  for (const key of Object.keys(taskModels)) {
    const models = taskModels[key];
    if (models.excludeTotalPoints) {
      const entries = await models.Entry.findAll({
        where: { mr_emp_code },
        attributes: ['num_pob']
      });
      total_points += entries.reduce((s, e) => s + pobUnitsPoints(e.num_pob), 0);
    } else {
      total_points += (await models.Entry.sum('total_points', { where: { mr_emp_code } })) || 0;
    }
  }
  return total_points;
};

module.exports = { CROWN_POINTS, pobUnitsPoints, computeMrPoints };
