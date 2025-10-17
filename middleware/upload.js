const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Создаем директории, если они не существуют
const uploadsDir = path.join(__dirname, '../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const productsDir = path.join(uploadsDir, 'products');
const tempDir = path.join(uploadsDir, 'temp');

[uploadsDir, avatarsDir, productsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Конфигурация хранилища для multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = tempDir; // По умолчанию временная директория
    
    if (req.baseUrl.includes('/users') || req.originalUrl.includes('/avatar')) {
      uploadPath = avatarsDir;
    } else if (req.baseUrl.includes('/products') || req.originalUrl.includes('/products')) {
      uploadPath = productsDir;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Генерируем безопасное имя файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const originalName = path.parse(file.originalname).name;
    const safeName = originalName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const ext = path.extname(file.originalname).toLowerCase();
    
    const filename = `file_${timestamp}_${randomString}_${safeName}${ext}`;
    cb(null, filename);
  }
});

// Расширенный фильтр файлов
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  const allowedTypes = [...allowedImageTypes, ...allowedDocumentTypes];
  
  // Проверяем MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }

  // Проверяем расширение файла
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
  
  if (!allowedExts.includes(fileExt)) {
    return cb(new Error(`Invalid file extension. Allowed extensions: ${allowedExts.join(', ')}`), false);
  }

  // Дополнительные проверки для изображений
  if (allowedImageTypes.includes(file.mimetype)) {
    // Можно добавить проверку на минимальные размеры изображения и т.д.
    if (file.size === 0) {
      return cb(new Error('File is empty'), false);
    }
  }

  cb(null, true);
};

// Настройка multer с улучшенной обработкой ошибок
const createMulterConfig = (options = {}) => {
  const config = {
    storage: storage,
    limits: {
      fileSize: options.fileSize || 5 * 1024 * 1024, // 5MB по умолчанию
      files: options.files || 1, // Количество файлов по умолчанию
    },
    fileFilter: fileFilter,
  };

  return multer(config);
};

// Специализированные конфигурации
const avatarConfig = createMulterConfig({
  fileSize: 2 * 1024 * 1024, // 2MB для аватаров
  files: 1,
});

const productImagesConfig = createMulterConfig({
  fileSize: 10 * 1024 * 1024, // 10MB для изображений продуктов
  files: 10, // До 10 файлов
});

const documentConfig = createMulterConfig({
  fileSize: 20 * 1024 * 1024, // 20MB для документов
  files: 5,
});

// Middleware для обработки ошибок загрузки
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error occurred.';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Please upload a smaller file.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded. Please reduce the number of files.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field in file upload. Please check the field name.';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts in the upload.';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long.';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long.';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields in the form.';
        break;
    }

    return res.status(400).json({
      success: false,
      message: message,
      code: error.code,
    });
  } else if (error) {
    // Обработка кастомных ошибок из fileFilter
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  next();
};

// Валидация загруженных файлов
const validateUploadedFiles = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: 'No files were uploaded.',
    });
  }

  // Проверяем отдельный файл
  if (req.file) {
    req.file.uploadPath = req.file.destination;
    req.file.fullPath = path.join(req.file.destination, req.file.filename);
    req.file.relativePath = `/uploads/${path.relative(uploadsDir, req.file.fullPath)}`;
  }

  // Проверяем массив файлов
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach(file => {
      file.uploadPath = file.destination;
      file.fullPath = path.join(file.destination, file.filename);
      file.relativePath = `/uploads/${path.relative(uploadsDir, file.fullPath)}`;
    });
  }

  next();
};

// Специализированные middleware для разных типов загрузок
const uploadAvatar = [
  avatarConfig.single('avatar'),
  handleUploadError,
  validateUploadedFiles
];

const uploadProductImages = [
  productImagesConfig.array('images', 10), // Максимум 10 изображений
  handleUploadError,
  validateUploadedFiles
];

const uploadDocuments = [
  documentConfig.array('documents', 5), // Максимум 5 документов
  handleUploadError,
  validateUploadedFiles
];

// Функция для очистки загруженных файлов при ошибках
const cleanupUploadedFiles = (files) => {
  if (!files) return;
  
  const filesArray = Array.isArray(files) ? files : [files];
  
  filesArray.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error('Error cleaning up file:', file.path, err);
        }
      });
    }
  });
};

module.exports = {
  upload: createMulterConfig(),
  uploadAvatar,
  uploadProductImages,
  uploadDocuments,
  handleUploadError,
  validateUploadedFiles,
  cleanupUploadedFiles,
  uploadsDir,
  avatarsDir,
  productsDir,
};