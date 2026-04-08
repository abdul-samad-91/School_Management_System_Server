import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import Teacher from '../models/Teacher.model.js';
import { generateEmployeeId } from './generateNumber.js';
import dotenv from 'dotenv';


dotenv.config();

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

const sanitizeCloudinarySegment = (value = '') =>
  String(value)
    .trim()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const normalizeEmployeeId = (value) => {
  const sanitized = sanitizeCloudinarySegment(value);
  return sanitized ? sanitized.toUpperCase() : null;
};

const createTeacherUploadError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolveTeacherEmployeeId = async (req) => {
  if (req.teacherUploadEmployeeId) {
    return req.teacherUploadEmployeeId;
  }

  if (req.teacherUploadEmployeeIdPromise) {
    return req.teacherUploadEmployeeIdPromise;
  }

  req.teacherUploadEmployeeIdPromise = (async () => {
    const requestEmployeeId = normalizeEmployeeId(req.body?.employeeId);

    if (req.params?.id) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createTeacherUploadError('Teacher not found', 404);
      }

      const teacher = await Teacher.findById(req.params.id).select('employeeId');
      if (!teacher) {
        throw createTeacherUploadError('Teacher not found', 404);
      }

      req.teacherUploadEmployeeId = requestEmployeeId || teacher.employeeId;
    } else {
      req.teacherUploadEmployeeId = requestEmployeeId || generateEmployeeId(new Date().getFullYear());
    }

    req.body = req.body || {};
    req.body.employeeId = req.teacherUploadEmployeeId;

    return req.teacherUploadEmployeeId;
  })();

  return req.teacherUploadEmployeeIdPromise;
};

const buildTeacherAssetPublicId = (employeeId, file) => {
  const assetLabel = file.fieldname === 'photo' ? 'photo' : 'document';
  const originalName = sanitizeCloudinarySegment(path.parse(file.originalname || file.fieldname || 'file').name) || assetLabel;

  return `${employeeId}-${assetLabel}-${originalName}-${Date.now()}`;
};

const teacherStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const employeeId = await resolveTeacherEmployeeId(req);
    const baseFolder = `sms/teachers/${employeeId}`;
    const folder = file.fieldname === 'photo' ? `${baseFolder}/photo` : `${baseFolder}/documents`;
    const publicId = buildTeacherAssetPublicId(employeeId, file);

    if (file.fieldname === 'photo') {
      return {
        folder,
        public_id: publicId,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 512, height: 512, crop: 'limit' }]
      };
    }

    return {
      folder,
      public_id: publicId,
      resource_type: 'auto'
    };
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
