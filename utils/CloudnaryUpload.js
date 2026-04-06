import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

const userStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sms/admins',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 512, height: 512, crop: 'limit' }]
  }
});

const teacherStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const baseFolder = 'sms/teachers';
    const folder = file.fieldname === 'photo' ? `${baseFolder}/photos` : `${baseFolder}/documents`;

    if (file.fieldname === 'photo') {
      return {
        folder,
        transformation: [{ width: 512, height: 512, crop: 'limit' }]
      };
    }

    return { folder };
  }
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(new Error('Only image files are allowed'), false);
};

const teacherDocumentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const teacherFileFilter = (req, file, cb) => {
  if (file.fieldname === 'photo') {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    return cb(new Error('Profile photo must be an image (jpg,jpeg,png,webp)'), false);
  }

  if (file.fieldname === 'documents') {
    if (teacherDocumentTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    return cb(new Error('Documents must be PDF/DOC/DOCX/image'), false);
  }

  cb(new Error('Invalid upload field'), false);
};

const upload = multer({
  storage: userStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const teacherUpload = multer({
  storage: teacherStorage,
  fileFilter: teacherFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});

export { cloudinary, upload, teacherUpload };
