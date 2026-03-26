import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from './CloudnaryUpload.js';

const teacherStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const baseFolder = 'sms/teachers';
    const folder = file.fieldname === 'photo'
      ? `${baseFolder}/photos`
      : `${baseFolder}/documents`;

    const params = { folder };

    if (file.fieldname === 'photo') {
      params.transformation = [{ width: 512, height: 512, crop: 'limit' }];
    }

    return params;
  }
});

const allowedDocumentTypes = [
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
      return cb(null, true);
    }
    return cb(new Error('Profile photo must be an image (jpg, jpeg, png, webp)'), false);
  }

  if (file.fieldname === 'documents') {
    if (allowedDocumentTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Documents must be PDF/DOC/DOCX or image files'), false);
  }

  cb(new Error('Invalid upload field'), false);
};

const teacherUpload = multer({
  storage: teacherStorage,
  fileFilter: teacherFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // up to 15MB per file
});

export { teacherUpload };
