const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const routes = require('./routes');


const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: false,
  allowedHeaders: ["Content-Type", "Authorization", "x-socket-id", "X-Requested-With"],
  exposedHeaders: ["x-socket-id", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/corium/ludo/api', routes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_UNEXPECTED_FILE: 'Unexpected upload field. Use the "documents" field for image files.',
      LIMIT_FILE_SIZE: 'File too large. Max size is 100MB.'
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || err.message
    });
  }
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
