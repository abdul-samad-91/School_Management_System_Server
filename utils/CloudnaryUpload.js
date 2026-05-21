import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import Student from '../models/Student.model.js';
import Teacher from '../models/Teacher.model.js';
import { generateAdmissionNumber, generateEmployeeId } from './generateNumber.js';
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

const createTeacherUploadError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createStudentUploadError = (message, statusCode) => {
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
    if (req.params?.id) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createTeacherUploadError('Teacher not found', 404);
      }

      const teacher = await Teacher.findById(req.params.id).select('employeeId');
      if (!teacher) {
        throw createTeacherUploadError('Teacher not found', 404);
      }

      req.teacherUploadEmployeeId = teacher.employeeId || await generateEmployeeId();
    } else {
      req.teacherUploadEmployeeId = await generateEmployeeId();
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

const resolveStudentAdmissionNumber = async (req) => {
  if (req.studentUploadAdmissionNumber) {
    return req.studentUploadAdmissionNumber;
  }

  if (req.studentUploadAdmissionNumberPromise) {
    return req.studentUploadAdmissionNumberPromise;
  }

  req.studentUploadAdmissionNumberPromise = (async () => {
    if (req.params?.id) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createStudentUploadError('Student not found', 404);
      }

      const student = await Student.findById(req.params.id).select('admissionNumber');
      if (!student) {
        throw createStudentUploadError('Student not found', 404);
      }

      req.studentUploadAdmissionNumber =
        student.admissionNumber || generateAdmissionNumber(new Date().getFullYear());
    } else {
      const providedAdmissionNumber =
        typeof req.body?.admissionNumber === 'string'
          ? req.body.admissionNumber.trim().toUpperCase()
          : req.body?.admissionNumber;

      req.studentUploadAdmissionNumber =
        providedAdmissionNumber || generateAdmissionNumber(new Date().getFullYear());
    }

    req.body = req.body || {};
    req.body.admissionNumber = req.studentUploadAdmissionNumber;

    return req.studentUploadAdmissionNumber;
  })();

  return req.studentUploadAdmissionNumberPromise;
};

const buildStudentAssetPublicId = (admissionNumber, file) => {
  const assetLabel = file.fieldname === 'photo' ? 'photo' : 'document';
  const originalName = sanitizeCloudinarySegment(path.parse(file.originalname || file.fieldname || 'file').name) || assetLabel;

  return `${admissionNumber}-${assetLabel}-${originalName}-${Date.now()}`;
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

const studentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const admissionNumber = await resolveStudentAdmissionNumber(req);
    const baseFolder = `sms/students/${admissionNumber}`;
    const folder = file.fieldname === 'photo' ? `${baseFolder}/photo` : `${baseFolder}/documents`;
    const publicId = buildStudentAssetPublicId(admissionNumber, file);

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

const studentFileFilter = (req, file, cb) => {
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

const studentUpload = multer({
  storage: studentStorage,
  fileFilter: studentFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});

// Add timeout middleware for student uploads
const studentUploadWithTimeout = (req, res, next) => {
  const timeout = setTimeout(() => {
    res.status(408).json({
      success: false,
      message: 'File upload timeout. Please try again with smaller files.'
    });
  }, 30000); // 30 second timeout

  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));

  next();
};

export { cloudinary, upload, teacherUpload, studentUpload, studentUploadWithTimeout };
