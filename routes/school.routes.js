import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getSchools,
  getSchool,
  getSchoolProfile,
  createSchoolProfile,
  updateSchoolProfile,
  updateSchoolStatus,
  deleteSchoolProfile
} from '../controllers/school.controller.js';
import { protect, checkPermission } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';

const router = express.Router();

const workingDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const schoolIdValidation = [
  param('id').isMongoId().withMessage('Please provide a valid school id')
];

const schoolQueryValidation = [
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be true or false')
    .toBoolean()
];

const schoolPayloadValidation = [
  body().isObject().withMessage('Request body must be a valid object'),
  body('name')
    .optional()
    .isString()
    .withMessage('School name must be a string')
    .trim()
    .notEmpty()
    .withMessage('School name cannot be empty'),
  body('code')
    .optional()
    .isString()
    .withMessage('School code must be a string')
    .trim()
    .notEmpty()
    .withMessage('School code cannot be empty'),
  body('logo')
    .optional()
    .isString()
    .withMessage('School logo must be a string')
    .trim(),
  body('address')
    .optional()
    .isObject()
    .withMessage('Address must be an object'),
  body('address.street')
    .optional()
    .isString()
    .withMessage('Street must be a string')
    .trim(),
  body('address.city')
    .optional()
    .isString()
    .withMessage('City must be a string')
    .trim(),
  body('address.state')
    .optional()
    .isString()
    .withMessage('State must be a string')
    .trim(),
  body('address.country')
    .optional()
    .isString()
    .withMessage('Country must be a string')
    .trim(),
  body('address.zipCode')
    .optional()
    .isString()
    .withMessage('Zip code must be a string')
    .trim(),
  body('contact')
    .optional()
    .isObject()
    .withMessage('Contact must be an object'),
  body('contact.phone')
    .optional()
    .isArray()
    .withMessage('Contact phone must be an array'),
  body('contact.phone.*')
    .optional()
    .isString()
    .withMessage('Each contact phone must be a string')
    .trim()
    .notEmpty()
    .withMessage('Phone number cannot be empty'),
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid contact email')
    .normalizeEmail(),
  body('contact.website')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Website must be a valid URL and include http or https')
    .trim(),
  body('registration')
    .optional()
    .isObject()
    .withMessage('Registration must be an object'),
  body('registration.number')
    .optional()
    .isString()
    .withMessage('Registration number must be a string')
    .trim(),
  body('registration.date')
    .optional()
    .isISO8601()
    .withMessage('Registration date must be a valid date')
    .toDate(),
  body('registration.authority')
    .optional()
    .isString()
    .withMessage('Registration authority must be a string')
    .trim(),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  body('settings.timeZone')
    .optional()
    .isString()
    .withMessage('Time zone must be a string')
    .trim(),
  body('settings.language')
    .optional()
    .isString()
    .withMessage('Language must be a string')
    .trim(),
  body('settings.currency')
    .optional()
    .isString()
    .withMessage('Currency must be a string')
    .trim(),
  body('settings.workingDays')
    .optional()
    .isArray()
    .withMessage('Working days must be an array'),
  body('settings.workingDays.*')
    .optional()
    .isIn(workingDays)
    .withMessage(`Working days must be one of: ${workingDays.join(', ')}`),
  body('settings.schoolHours')
    .optional()
    .isObject()
    .withMessage('School hours must be an object'),
  body('settings.schoolHours.start')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('School start time must be in HH:MM format'),
  body('settings.schoolHours.end')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('School end time must be in HH:MM format'),
  body('settings.dateFormat')
    .optional()
    .isString()
    .withMessage('Date format must be a string')
    .trim(),
  body('branding')
    .optional()
    .isObject()
    .withMessage('Branding must be an object'),
  body('branding.primaryColor')
    .optional()
    .isString()
    .withMessage('Primary color must be a string')
    .trim(),
  body('branding.secondaryColor')
    .optional()
    .isString()
    .withMessage('Secondary color must be a string')
    .trim(),
  body('branding.letterhead')
    .optional()
    .isString()
    .withMessage('Letterhead must be a string')
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be true or false')
    .toBoolean()
];

const createSchoolValidation = [
  ...schoolPayloadValidation,
  body('name')
    .exists({ values: 'falsy' })
    .withMessage('School name is required'),
  body('code')
    .exists({ values: 'falsy' })
    .withMessage('School code is required')
];

const updateSchoolValidation = [
  ...schoolPayloadValidation,
  body().custom((value) => {
    const allowedFields = [
      'name',
      'code',
      'logo',
      'address',
      'contact',
      'registration',
      'settings',
      'branding',
      'isActive'
    ];

    const hasAtLeastOneAllowedField = allowedFields.some((field) => value?.[field] !== undefined);

    if (!hasAtLeastOneAllowedField) {
      throw new Error('Please provide at least one valid school field to update');
    }

    return true;
  })
];

const statusValidation = [
  ...schoolIdValidation,
  body('isActive')
    .exists()
    .withMessage('isActive is required')
    .bail()
    .isBoolean()
    .withMessage('isActive must be true or false')
    .toBoolean()
];

router.get(
  '/profile',
  protect,
  checkPermission('school_setup', 'view'),
  getSchoolProfile
);

router.post(
  '/profile',
  protect,
  checkPermission('school_setup', 'create'),
  createSchoolValidation,
  validate,
  createSchoolProfile
);

router.put(
  '/profile/:id',
  protect,
  checkPermission('school_setup', 'update'),
  [...schoolIdValidation, ...updateSchoolValidation],
  validate,
  updateSchoolProfile
);

router.get(
  '/',
  protect,
  checkPermission('school_setup', 'view'),
  schoolQueryValidation,
  validate,
  getSchools
);

router.get(
  '/:id',
  protect,
  checkPermission('school_setup', 'view'),
  schoolIdValidation,
  validate,
  getSchool
);

router.put(
  '/:id',
  protect,
  checkPermission('school_setup', 'update'),
  [...schoolIdValidation, ...updateSchoolValidation],
  validate,
  updateSchoolProfile
);

router.patch(
  '/:id/status',
  protect,
  checkPermission('school_setup', 'update'),
  statusValidation,
  validate,
  updateSchoolStatus
);

router.delete(
  '/:id',
  protect,
  checkPermission('school_setup', 'delete'),
  schoolIdValidation,
  validate,
  deleteSchoolProfile
);

export default router;
