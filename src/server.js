require('dotenv').config();
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 13000;

const server = http.createServer(app);

async function startServer() {
  try {
    const sequelize = require('./config/db');
    const Task = require('./models/Task');
    const { taskModels } = require('./models');

    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    await sequelize.sync({ force: false });

    for (const key of Object.keys(taskModels)) {
      await taskModels[key].Entry.sync({ alter: true });
      await taskModels[key].Doc.sync({ alter: true });
    }

    const ensureTaskFks = async () => {
      for (const key of Object.keys(taskModels)) {
        const eTable = taskModels[key].Entry.tableName;
        try {
          await sequelize.query(
            `ALTER TABLE \`${eTable}\` ADD CONSTRAINT \`fk_${eTable}_task\` ` +
            `FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
          );
        } catch (e) {
          if (!/ER_DUP_KEY|errno: 121|already exists|42S21/i.test(e.message)) throw e;
        }
      }
      console.log('Task FKs ensured.');
    };
    await ensureTaskFks();

    const ensureEntryFks = async () => {
      for (const key of Object.keys(taskModels)) {
        const eTable = taskModels[key].Entry.tableName;
        const dTable = taskModels[key].Doc.tableName;
        const [fks] = await sequelize.query(
          `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = ?
             AND COLUMN_NAME = 'task_entry_id'
             AND REFERENCED_TABLE_NAME IS NOT NULL`,
          { replacements: [dTable] }
        );
        for (const fk of fks) {
          await sequelize.query(
            `ALTER TABLE \`${dTable}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
          );
        }
        try {
          await sequelize.query(
            `ALTER TABLE \`${dTable}\` ADD CONSTRAINT \`fk_${dTable}_entry\` ` +
            `FOREIGN KEY (\`task_entry_id\`) REFERENCES \`${eTable}\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
          );
        } catch (e) {
          if (!/ER_DUP_KEY|errno: 121|already exists|42S21/i.test(e.message)) throw e;
        }
      }
      console.log('Entry FKs ensured.');
    };
    await ensureEntryFks();

    console.log('Database synced successfully.');

    const taskCount = await Task.count();
    if (taskCount === 0) {
      await Task.bulkCreate([
        { title: 'Doctor Coversions', description: 'Update status of new targeted HCPs.' },
        { title: 'POB (in units)', description: 'Record personal order book details.' },
        { title: 'Combo POB (in units)', description: 'Grogain Tab + Grogain PRO/MF' },
        { title: 'Live Prescriptions', description: 'Log new Rx details for current cycle.' },
        { title: 'JCC Conversion/POB', description: '3 pts with AM, 4 pts with RM, 5 pts with ZM' }
      ]);
      console.log('Initial tasks seeded successfully.');
    }

    const host = process.env.HOST || '0.0.0.0';
    server.listen(PORT, host, () => {
      console.log(`Server is running on http://${host}:${PORT}`);
      console.log(`API Base URL: http://${host}:${PORT}/corium/ludo/api`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  const sequelize = require('./config/db');
  await sequelize.close();
  process.exit(0);
});

startServer();
