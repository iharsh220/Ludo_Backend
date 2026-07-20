const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskKey = req.params && req.params.taskKey ? req.params.taskKey : 'misc';
    const emp = (req.user && req.user.user && req.user.user.emp_code) || 'unknown';
    const dateStr = new Date().toISOString().slice(0, 10);
    const dir = path.join(uploadDir, taskKey, emp, dateStr);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImages = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedImages.includes(ext) && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    const err = new Error('Only image files are allowed (png, jpg, jpeg, webp, gif, bmp)');
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

upload.uploadDir = uploadDir;
module.exports = upload;
