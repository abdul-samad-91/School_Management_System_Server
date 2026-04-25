import mongoose from 'mongoose';
import User from '../models/User.model.js';
import School from '../models/School.model.js';

const USER_ROLES = [
  'master_admin',
  'super_admin',
  'admin',
  'teacher',
  'fee_editor',
  'exam_controller',
  'exam_officer',
  'exam_leader'
];

const PERMISSION_MODULES = [
  'school_setup',
  'students',
  'teachers',
  'academics',
  'attendance',
  'fees',
  'exams',
  'certificates',
  'communication',
  'reports',
  'users'
];

const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

const createUserError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserErrorStatus = (error) => {
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

const handleUserError = (res, error) => {
  res.status(getUserErrorStatus(error)).json({
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
    throw createUserError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createUserError(`${fieldName} must be a valid id`);
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
    throw createUserError(`Invalid ${fieldName} JSON`);
  }
};

const normalizeTrimmedString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createUserError(`${fieldName} is required`);
    }

    return undefined;
  }

  return String(value).trim();
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

const normalizeDateValue = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalizedDate = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw createUserError(`${fieldName} must be a valid date`);
  }

  return normalizedDate;
};

const normalizePagination = (pageValue, limitValue) => {
  const page = Number.parseInt(pageValue, 10);
  const limit = Number.parseInt(limitValue, 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 10 : limit
  };
};

const normalizeRole = (value) => {
  const normalizedRole = normalizeTrimmedString(value, 'role', { required: true }).toLowerCase();

  if (!USER_ROLES.includes(normalizedRole)) {
    throw createUserError(`role must be one of ${USER_ROLES.join(', ')}`);
  }

  return normalizedRole;
};

const normalizePermissions = (permissionsInput) => {
  if (!Array.isArray(permissionsInput)) {
    throw createUserError('permissions must be an array');
  }

  const permissionMap = new Map();

  permissionsInput.forEach((permission, index) => {
    if (!isPlainObject(permission)) {
      throw createUserError(`permissions[${index}] must be a valid object`);
    }

    const module = normalizeTrimmedString(permission.module, `permissions[${index}].module`, {
      required: true
    });

    if (!PERMISSION_MODULES.includes(module)) {
      throw createUserError(
        `permissions[${index}].module must be one of ${PERMISSION_MODULES.join(', ')}`
      );
    }

    if (!Array.isArray(permission.actions) || permission.actions.length === 0) {
      throw createUserError(`permissions[${index}].actions must be a non-empty array`);
    }

    if (!permissionMap.has(module)) {
      permissionMap.set(module, new Set());
    }

    permission.actions.forEach((action, actionIndex) => {
      const normalizedAction = normalizeTrimmedString(
        action,
        `permissions[${index}].actions[${actionIndex}]`,
        { required: true }
      );

      if (!PERMISSION_ACTIONS.includes(normalizedAction)) {
        throw createUserError(
          `permissions[${index}].actions[${actionIndex}] must be one of ${PERMISSION_ACTIONS.join(', ')}`
        );
      }

      permissionMap.get(module).add(normalizedAction);
    });
  });

  return [...permissionMap.entries()].map(([module, actions]) => ({
    module,
    actions: [...actions]
  }));
};

const normalizeProfile = (profileInput = {}) => {
  if (!isPlainObject(profileInput)) {
    throw createUserError('profile must be a valid object');
  }

  const normalizedProfile = {};

  if (profileInput.firstName !== undefined) {
    normalizedProfile.firstName = normalizeTrimmedString(
      profileInput.firstName,
      'profile.firstName'
    );
  }

  if (profileInput.lastName !== undefined) {
    normalizedProfile.lastName = normalizeTrimmedString(
      profileInput.lastName,
      'profile.lastName'
    );
  }

  if (profileInput.phone !== undefined) {
    normalizedProfile.phone = normalizeTrimmedString(profileInput.phone, 'profile.phone');
  }

  if (profileInput.address !== undefined) {
    normalizedProfile.address = normalizeTrimmedString(profileInput.address, 'profile.address');
  }

  if (profileInput.photo !== undefined) {
    normalizedProfile.photo = normalizeTrimmedString(profileInput.photo, 'profile.photo');
  }

  if (profileInput.dateOfBirth !== undefined) {
    normalizedProfile.dateOfBirth = normalizeDateValue(
      profileInput.dateOfBirth,
      'profile.dateOfBirth'
    );
  }

  if (profileInput.gender !== undefined) {
    normalizedProfile.gender = normalizeTrimmedString(profileInput.gender, 'profile.gender');
  }

  return normalizedProfile;
};

const ensureSchoolExists = async (schoolId) => {
  if (!schoolId) {
    return null;
  }

  const school = await School.findById(schoolId).select('_id name code');

  if (!school) {
    throw createUserError('School not found', 404);
  }

  return school;
};

const ensureUserExists = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw createUserError('User not found', 404);
  }

  return user;
};

const ensureCanManageTargetUser = (req, targetUser, action) => {
  if (targetUser.role === 'master_admin' && req.user?.role !== 'master_admin') {
    throw createUserError(`Only master admin can ${action} a master admin account`, 403);
  }
};

const ensureIsNotSelfManagement = (req, targetUser, action) => {
  if (toIdString(req.user?._id) === toIdString(targetUser._id)) {
    throw createUserError(
      `You cannot ${action} your own account through this route`,
      400
    );
  }
};

const ensureUniqueUsername = async (username, excludeId) => {
  if (!username) {
    return;
  }

  const existingUser = await User.findOne({
    username: username.toLowerCase(),
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  }).select('_id');

  if (existingUser) {
    throw createUserError('Username is already taken');
  }
};

const ensureUniqueEmail = async (email, excludeId) => {
  if (!email) {
    return;
  }

  const existingUser = await User.findOne({
    email: email.toLowerCase(),
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  }).select('_id');

  if (existingUser) {
    throw createUserError('Email is already in use');
  }
};



export const getUsers = async (req, res) => {
  try {
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);
    const query = {};

    if (req.query.role) {
      query.role = normalizeRole(req.query.role);
    }

    if (req.query.isActive !== undefined) {
      query.isActive = normalizeBoolean(req.query.isActive);
    }

    if (req.query.school) {
      query.school = ensureObjectId(req.query.school, 'school');
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('school', 'name code')
      .populate('createdBy', 'username role profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const count = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: users
    });
  } catch (error) {
    handleUserError(res, error);
  }
};



export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('school', 'name code')
      .populate('createdBy', 'username role profile.firstName profile.lastName');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    handleUserError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await ensureUserExists(req.params.id);
    ensureCanManageTargetUser(req, user, 'update');
    ensureIsNotSelfManagement(req, user, 'update');

    if (req.body.password !== undefined) {
      throw createUserError('Password cannot be updated from this route');
    }

    if (req.body.createdBy !== undefined) {
      throw createUserError('createdBy cannot be updated');
    }

    const profileInput = parseStructuredField(req.body.profile, 'profile');
    if (profileInput !== undefined && !isPlainObject(profileInput)) {
      throw createUserError('profile must be a valid object');
    }

    const nextUsername =
      req.body.username !== undefined
        ? normalizeTrimmedString(req.body.username, 'username', { required: true }).toLowerCase()
        : user.username;
    const nextEmail =
      req.body.email !== undefined
        ? normalizeTrimmedString(req.body.email, 'email', { required: true }).toLowerCase()
        : user.email;
    const nextRole =
      req.body.role !== undefined ? normalizeRole(req.body.role) : user.role;
    const nextSchool =
      hasOwn(req.body, 'school')
        ? req.body.school === null || req.body.school === ''
          ? null
          : ensureObjectId(req.body.school, 'school')
        : toIdString(user.school);

    if (nextRole === 'master_admin' && req.user?.role !== 'master_admin') {
      throw createUserError('Only master admin can assign the master_admin role', 403);
    }

    await ensureUniqueUsername(nextUsername, user._id);
    await ensureUniqueEmail(nextEmail, user._id);
    await ensureSchoolExists(nextSchool);

    const profileUpdates = profileInput ? normalizeProfile(profileInput) : {};
    const flatProfileFields = [
      'firstName',
      'lastName',
      'phone',
      'address',
      'photo',
      'dateOfBirth',
      'gender'
    ];

    flatProfileFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const normalizedValue =
          field === 'dateOfBirth'
            ? normalizeDateValue(req.body[field], `profile.${field}`)
            : normalizeTrimmedString(req.body[field], `profile.${field}`);
        profileUpdates[field] = normalizedValue;
      }
    });

    user.username = nextUsername;
    user.email = nextEmail;
    user.role = nextRole;
    user.school = nextSchool;

    if (req.body.isActive !== undefined) {
      user.isActive = normalizeBoolean(req.body.isActive);
    }

    if (Object.keys(profileUpdates).length > 0) {
      user.profile = {
        ...(user.profile && typeof user.profile.toObject === 'function'
          ? user.profile.toObject()
          : user.profile || {}),
        ...profileUpdates
      };
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('school', 'name code')
      .populate('createdBy', 'username role profile.firstName profile.lastName');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    handleUserError(res, error);
  }
};

export const updateUserPermissions = async (req, res) => {
  try {
    const user = await ensureUserExists(req.params.id);
    ensureCanManageTargetUser(req, user, 'update permissions for');
    ensureIsNotSelfManagement(req, user, 'update permissions for');

    const permissions = normalizePermissions(
      parseStructuredField(req.body.permissions, 'permissions')
    );

    user.permissions = permissions;
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('school', 'name code')
      .populate('createdBy', 'username role profile.firstName profile.lastName');

    res.status(200).json({
      success: true,
      message: 'User permissions updated successfully',
      data: updatedUser
    });
  } catch (error) {
    handleUserError(res, error);
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const user = await ensureUserExists(req.params.id);
    ensureCanManageTargetUser(req, user, 'toggle status for');
    ensureIsNotSelfManagement(req, user, 'toggle status for');

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: user.isActive }
    });
  } catch (error) {
    handleUserError(res, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await ensureUserExists(req.params.id);
    ensureCanManageTargetUser(req, user, 'delete');
    ensureIsNotSelfManagement(req, user, 'delete');

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    handleUserError(res, error);
  }
};
