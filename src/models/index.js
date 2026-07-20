const Task = require('./Task');
const Organogram = require('./organogram');
const { taskModels, TASK_CONFIG } = require('./taskTables');

module.exports = {
  Task,
  Organogram,
  taskModels,
  TASK_CONFIG
};
