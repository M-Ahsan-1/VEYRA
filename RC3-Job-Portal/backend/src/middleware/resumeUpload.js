const multer = require('multer');
const AppError = require('../utils/AppError');

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname)) {
      return callback(new AppError('Only PDF resumes are accepted.', 415));
    }
    callback(null, true);
  },
}).single('resume');

module.exports = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Resume files must be 5 MB or smaller.', 413));
    }
    next(error);
  });
};

module.exports.MAX_RESUME_BYTES = MAX_RESUME_BYTES;