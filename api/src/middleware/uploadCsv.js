const multer = require('multer');

// CSV files only, kept in memory (parsed immediately, never persisted to disk).
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okMime = ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain'];
    const okExt = file.originalname.toLowerCase().endsWith('.csv');
    if (okExt || okMime.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Please upload a .csv file'), false);
  },
});

module.exports = uploadCsv;
