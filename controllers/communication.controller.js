import mongoose from 'mongoose';
import Announcement from '../models/Announcement.model.js';
import Class from '../models/Class.model.js';

const ANNOUNCEMENT_TYPES = ['general', 'urgent', 'holiday', 'exam', 'event', 'fee'];
const ANNOUNCEMENT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TARGET_AUDIENCES = ['all', 'students', 'teachers', 'parents', 'staff', 'specific'];

const createCommunicationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getCommunicationErrorStatus = (error) => {
  if (error.statusCode) {
    return error.statusCode;
  }

  if (
    error.name === 'ValidationError' ||
    error.name === 'CastError' ||
    error.code === 11000
  ) {
    return 400;
  }

  return 500;
};

const handleCommunicationError = (res, error) => {
  res.status(getCommunicationErrorStatus(error)).json({
    success: false,
    message: error.message
  });
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return String(value);
};

const ensureObjectId = (value, fieldName) => {
  if (!value) {
    throw createCommunicationError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createCommunicationError(`${fieldName} must be a valid id`);
  }

  return toIdString(value);
};

const parseStructuredField = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const looksLikeJson =
    (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
    (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'));

  if (!looksLikeJson) {
    return value;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    throw createCommunicationError(`Invalid ${fieldName} JSON`);
  }
};

const normalizeTrimmedString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createCommunicationError(`${fieldName} is required`);
    }

    return undefined;
  }

  return String(value).trim();
};

const normalizeDateValue = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createCommunicationError(`${fieldName} is required`);
    }

    return undefined;
  }

  const normalizedDate = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw createCommunicationError(`${fieldName} must be a valid date`);
  }

  return normalizedDate;
};

const normalizeBoolean = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return Boolean(value);
};

const normalizeObjectIdArray = (values, fieldName) => {
  if (values === undefined || values === null || values === '') {
    return [];
  }

  const normalizedValues = Array.isArray(values) ? values : [values];

  return [
    ...new Set(normalizedValues.map((value) => ensureObjectId(value, fieldName)))
  ];
};

const normalizeStringArray = (values, fieldName) => {
  if (values === undefined || values === null || values === '') {
    return [];
  }

  const normalizedValues = Array.isArray(values) ? values : [values];

  return [
    ...new Set(
      normalizedValues
        .map((value) => normalizeTrimmedString(value, fieldName))
        .filter(Boolean)
    )
  ];
};

const normalizePagination = (pageValue, limitValue) => {
  const page = Number.parseInt(pageValue, 10);
  const limit = Number.parseInt(limitValue, 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 10 : limit
  };
};

const getUserSchoolId = (req) => (req.user?.school ? toIdString(req.user.school) : null);
const isMasterAdmin = (req) => req.user?.role === 'master_admin';

const resolveScopedSchoolId = (req, explicitSchoolId) => {
  const userSchoolId = getUserSchoolId(req);
  const requestedSchoolId = explicitSchoolId
    ? ensureObjectId(explicitSchoolId, 'school')
    : null;

  if (!isMasterAdmin(req) && userSchoolId) {
    if (requestedSchoolId && requestedSchoolId !== userSchoolId) {
      throw createCommunicationError(
        'You can only access communication records for your assigned branch',
        403
      );
    }

    return userSchoolId;
  }

  return requestedSchoolId || userSchoolId || null;
};

const resolveRequiredSchoolId = (req, explicitSchoolId) => {
  const schoolId = resolveScopedSchoolId(req, explicitSchoolId);

  if (!schoolId) {
    throw createCommunicationError('school is required');
  }

  return schoolId;
};

const ensureClassDocuments = async (classIds = [], schoolId) => {
  if (classIds.length === 0) {
    return new Map();
  }

  const query = {
    _id: { $in: classIds }
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const classDocs = await Class.find(query).select('_id name level sections school');

  if (classDocs.length !== classIds.length) {
    throw createCommunicationError('One or more classes were not found', 404);
  }

  return new Map(classDocs.map((classDoc) => [toIdString(classDoc._id), classDoc]));
};

const ensureSectionsBelongToTargetClasses = (targetSections, classDocsMap) => {
  if (targetSections.length === 0) {
    return;
  }

  const availableSections = new Set();

  [...classDocsMap.values()].forEach((classDoc) => {
    (classDoc.sections || []).forEach((section) => {
      const normalizedSection = section?.name?.trim();
      if (normalizedSection) {
        availableSections.add(normalizedSection);
      }
    });
  });

  const invalidSections = targetSections.filter((section) => !availableSections.has(section));

  if (invalidSections.length > 0) {
    throw createCommunicationError(
      `targetSections contain invalid section(s): ${invalidSections.join(', ')}`
    );
  }
};

const normalizeAnnouncementType = (value) => {
  const normalizedValue = normalizeTrimmedString(value, 'type', { required: true }).toLowerCase();

  if (!ANNOUNCEMENT_TYPES.includes(normalizedValue)) {
    throw createCommunicationError(
      `type must be one of ${ANNOUNCEMENT_TYPES.join(', ')}`
    );
  }

  return normalizedValue;
};

const normalizeAnnouncementPriority = (value) => {
  if (!value || value === '') return 'normal';
  const normalizedValue = normalizeTrimmedString(value, 'priority', { required: true }).toLowerCase();

  // Map 'general' to 'normal' for frontend compatibility
  if (normalizedValue === 'general') return 'normal';

  if (!ANNOUNCEMENT_PRIORITIES.includes(normalizedValue)) {
    throw createCommunicationError(
      `priority must be one of ${ANNOUNCEMENT_PRIORITIES.join(', ')}`
    );
  }

  return normalizedValue;
};

const normalizeTargetAudience = (value) => {
  // Default to 'all' if not provided (frontend doesn't always send this)
  if (!value || value === '') return 'all';
  const normalizedValue = normalizeTrimmedString(value, 'targetAudience', {
    required: true
  }).toLowerCase();

  if (!TARGET_AUDIENCES.includes(normalizedValue)) {
    throw createCommunicationError(
      `targetAudience must be one of ${TARGET_AUDIENCES.join(', ')}`
    );
  }

  return normalizedValue;
};

const normalizeAttachments = (attachmentsInput) => {
  if (attachmentsInput === undefined) {
    return [];
  }

  if (!Array.isArray(attachmentsInput)) {
    throw createCommunicationError('attachments must be an array');
  }

  return attachmentsInput.map((attachment, index) => {
    if (!isPlainObject(attachment)) {
      throw createCommunicationError(`attachments[${index}] must be a valid object`);
    }

    return {
      name: normalizeTrimmedString(attachment.name, `attachments[${index}].name`, {
        required: true
      }),
      url: normalizeTrimmedString(attachment.url, `attachments[${index}].url`, {
        required: true
      }),
      type: normalizeTrimmedString(attachment.type, `attachments[${index}].type`)
    };
  });
};

const buildAnnouncementQueryFilter = (req) => {
  const schoolId = resolveScopedSchoolId(req, req.query.school);
  const query = {};

  if (schoolId) {
    query.school = schoolId;
  }

  if (req.query.type) {
    query.type = normalizeAnnouncementType(req.query.type);
  }

  if (req.query.targetAudience) {
    query.targetAudience = normalizeTargetAudience(req.query.targetAudience);
  }

  if (req.query.isPublished !== undefined) {
    query.isPublished = normalizeBoolean(req.query.isPublished);
  }

  if (req.query.search) {
    const search = String(req.query.search).trim();
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } }
    ];
  }

  if (req.query.classId) {
    query.targetClasses = ensureObjectId(req.query.classId, 'classId');
  }

  if (req.query.activeOnly !== 'false') {
    query.$and = [
      {
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: null },
          { expiryDate: { $gte: new Date() } }
        ]
      }
    ];
  }

  return query;
};

const populateAnnouncementQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate('createdBy', 'username role profile.firstName profile.lastName')
    .populate('targetClasses', 'name level sections')
    .populate('readBy.user', 'username role profile.firstName profile.lastName');

const findScopedAnnouncementById = async (req, announcementId) => {
  const schoolId = resolveScopedSchoolId(req, undefined);
  const query = {
    _id: ensureObjectId(announcementId, 'announcement')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const announcement = await Announcement.findOne(query);

  if (!announcement) {
    throw createCommunicationError('Announcement not found', 404);
  }

  return announcement;
};

export const getAnnouncements = async (req, res) => {
  try {
    const query = buildAnnouncementQueryFilter(req);
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);

    const announcements = await populateAnnouncementQuery(
      Announcement.find(query)
        .sort({ isPublished: -1, publishDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    );

    const count = await Announcement.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: announcements
    });
  } catch (error) {
    handleCommunicationError(res, error);
  }
};

export const getAnnouncement = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, undefined);
    const query = {
      _id: ensureObjectId(req.params.id, 'announcement')
    };

    if (schoolId) {
      query.school = schoolId;
    }

    const announcement = await populateAnnouncementQuery(Announcement.findOne(query));

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.status(200).json({
      success: true,
      data: announcement
    });
  } catch (error) {
    handleCommunicationError(res, error);
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    const targetClasses = normalizeObjectIdArray(
      parseStructuredField(req.body.targetClasses, 'targetClasses'),
      'targetClasses'
    );
    const classDocsMap = await ensureClassDocuments(targetClasses, schoolId);
    const targetSections = normalizeStringArray(
      parseStructuredField(req.body.targetSections, 'targetSections'),
      'targetSections'
    );
    ensureSectionsBelongToTargetClasses(targetSections, classDocsMap);

    const publishDate =
      req.body.publishDate !== undefined
        ? normalizeDateValue(req.body.publishDate, 'publishDate', { required: true })
        : new Date();
    const expiryDate =
      req.body.expiryDate !== undefined
        ? normalizeDateValue(req.body.expiryDate, 'expiryDate')
        : undefined;

    if (publishDate && expiryDate && expiryDate < publishDate) {
      throw createCommunicationError(
        'expiryDate must be greater than or equal to publishDate'
      );
    }

    const announcement = await Announcement.create({
      school: schoolId,
      title: normalizeTrimmedString(req.body.title, 'title', { required: true }),
      message: normalizeTrimmedString(req.body.message, 'message', { required: true }),
      type:
        req.body.type !== undefined ? normalizeAnnouncementType(req.body.type) : 'general',
      priority:
        req.body.priority !== undefined
          ? normalizeAnnouncementPriority(req.body.priority)
          : 'normal',
      targetAudience: normalizeTargetAudience(req.body.targetAudience),
      targetClasses,
      targetSections,
      attachments: normalizeAttachments(
        parseStructuredField(req.body.attachments, 'attachments')
      ),
      publishDate,
      expiryDate,
      isPublished:
        req.body.isPublished !== undefined ? normalizeBoolean(req.body.isPublished) : true,
      createdBy: req.user?._id
    });

    const populatedAnnouncement = await populateAnnouncementQuery(
      Announcement.findById(announcement._id)
    );

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: populatedAnnouncement
    });
  } catch (error) {
    handleCommunicationError(res, error);
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await findScopedAnnouncementById(req, req.params.id);
    const schoolId = resolveScopedSchoolId(req, announcement.school);

    const targetClasses = hasOwn(req.body, 'targetClasses')
      ? normalizeObjectIdArray(
          parseStructuredField(req.body.targetClasses, 'targetClasses'),
          'targetClasses'
        )
      : (announcement.targetClasses || []).map((classId) => toIdString(classId));
    const classDocsMap = await ensureClassDocuments(targetClasses, schoolId);
    const targetSections = hasOwn(req.body, 'targetSections')
      ? normalizeStringArray(
          parseStructuredField(req.body.targetSections, 'targetSections'),
          'targetSections'
        )
      : normalizeStringArray(announcement.targetSections, 'targetSections');
    ensureSectionsBelongToTargetClasses(targetSections, classDocsMap);

    const publishDate =
      req.body.publishDate !== undefined
        ? normalizeDateValue(req.body.publishDate, 'publishDate', { required: true })
        : announcement.publishDate;
    const expiryDate =
      hasOwn(req.body, 'expiryDate')
        ? normalizeDateValue(req.body.expiryDate, 'expiryDate')
        : announcement.expiryDate;

    if (publishDate && expiryDate && expiryDate < publishDate) {
      throw createCommunicationError(
        'expiryDate must be greater than or equal to publishDate'
      );
    }

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      announcement._id,
      {
        title:
          req.body.title !== undefined
            ? normalizeTrimmedString(req.body.title, 'title', { required: true })
            : announcement.title,
        message:
          req.body.message !== undefined
            ? normalizeTrimmedString(req.body.message, 'message', { required: true })
            : announcement.message,
        type:
          req.body.type !== undefined
            ? normalizeAnnouncementType(req.body.type)
            : announcement.type,
        priority:
          req.body.priority !== undefined
            ? normalizeAnnouncementPriority(req.body.priority)
            : announcement.priority,
        targetAudience:
          req.body.targetAudience !== undefined
            ? normalizeTargetAudience(req.body.targetAudience)
            : announcement.targetAudience,
        targetClasses,
        targetSections,
        attachments: hasOwn(req.body, 'attachments')
          ? normalizeAttachments(parseStructuredField(req.body.attachments, 'attachments'))
          : (announcement.attachments || []).map((attachment) =>
              typeof attachment.toObject === 'function' ? attachment.toObject() : attachment
            ),
        publishDate,
        expiryDate,
        isPublished:
          req.body.isPublished !== undefined
            ? normalizeBoolean(req.body.isPublished)
            : announcement.isPublished
      },
      { new: true, runValidators: true }
    );

    const populatedAnnouncement = await populateAnnouncementQuery(
      Announcement.findById(updatedAnnouncement._id)
    );

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: populatedAnnouncement
    });
  } catch (error) {
    handleCommunicationError(res, error);
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await findScopedAnnouncementById(req, req.params.id);
    await announcement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    handleCommunicationError(res, error);
  }
};

export const markAsRead = async (req, res) => {
  try {
    const announcement = await findScopedAnnouncementById(req, req.params.id);
    const alreadyRead = (announcement.readBy || []).some(
      (readRecord) => toIdString(readRecord.user) === toIdString(req.user?._id)
    );

    if (!alreadyRead) {
      announcement.readBy.push({
        user: req.user?._id,
        readAt: new Date()
      });
      await announcement.save();
    }

    res.status(200).json({
      success: true,
      message: 'Announcement marked as read',
      data: {
        readCount: announcement.readBy.length
      }
    });
  } catch (error) {
    handleCommunicationError(res, error);
  }
};
