import mongoose from 'mongoose';
import Student from '../models/Student.model.js';
import { generateAdmissionNumber } from '../utils/generateNumber.js';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isMissingRequiredValue = (value) => {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  return false;
};

const isValidDateInput = (value) => {
  if (isMissingRequiredValue(value)) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
};

const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(`Invalid ${fieldName} JSON`);
    error.statusCode = 400;
    throw error;
  }
};

const mergeDefined = (target = {}, source = {}) => {
  const merged = isPlainObject(target) ? { ...target } : {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (isPlainObject(value)) {
      merged[key] = mergeDefined(merged[key], value);
      return;
    }

    merged[key] = value;
  });

  return merged;
};

const toPlainObject = (value) => {
  if (value && typeof value.toObject === 'function') {
    return value.toObject();
  }

  return value;
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const normalizeTrimmedString = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value).trim();
};

const normalizeUppercaseString = (value) => {
  const normalizedValue = normalizeTrimmedString(value);

  if (normalizedValue === undefined || normalizedValue === null) {
    return normalizedValue;
  }

  return normalizedValue.toUpperCase();
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validateObjectId = (value, fieldName) => {
  if (isMissingRequiredValue(value)) {
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createValidationError(`${fieldName} must be a valid id`);
  }
};

const normalizeProfilePayload = (profile = {}) => {
  const normalizedProfile = { ...profile };

  [
    'firstName',
    'lastName',
    'middleName',
    'gender',
    'bloodGroup',
    'email',
    'phone'
  ].forEach((field) => {
    if (normalizedProfile[field] !== undefined) {
      normalizedProfile[field] = normalizeTrimmedString(normalizedProfile[field]);
    }
  });

  if (normalizedProfile.email !== undefined && normalizedProfile.email !== null) {
    normalizedProfile.email = normalizedProfile.email.toLowerCase();
  }

  const requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'gender'];
  const missingFields = requiredFields.filter((field) =>
    isMissingRequiredValue(normalizedProfile[field])
  );

  if (missingFields.length > 0) {
    throw createValidationError(`Missing required profile fields: ${missingFields.join(', ')}`);
  }

  if (!isValidDateInput(normalizedProfile.dateOfBirth)) {
    throw createValidationError('dateOfBirth must be a valid date');
  }

  if (
    normalizedProfile.email !== undefined &&
    normalizedProfile.email !== '' &&
    !isValidEmail(normalizedProfile.email)
  ) {
    throw createValidationError('profile.email must be a valid email address');
  }

  return normalizedProfile;
};

const normalizeParentsPayload = (parents, { requireAtLeastOne = true } = {}) => {
  if (!Array.isArray(parents)) {
    throw createValidationError('parents must be an array');
  }

  if (requireAtLeastOne && parents.length === 0) {
    throw createValidationError('At least one parent or guardian is required');
  }

  const normalizedParents = parents.map((parent, index) => {
    if (!isPlainObject(parent)) {
      throw createValidationError(`parents[${index}] must be a valid object`);
    }

    const normalizedParent = { ...parent };

    [
      'relationship',
      'firstName',
      'lastName',
      'occupation',
      'phone',
      'whatsappNumber',
      'email',
      'address'
    ].forEach((field) => {
      if (normalizedParent[field] !== undefined) {
        normalizedParent[field] = normalizeTrimmedString(normalizedParent[field]);
      }
    });

    const missingFields = ['relationship', 'firstName', 'phone'].filter((field) =>
      isMissingRequiredValue(normalizedParent[field])
    );

    if (missingFields.length > 0) {
      throw createValidationError(
        `Missing required parent fields in parents[${index}]: ${missingFields.join(', ')}`
      );
    }

    if (
      normalizedParent.email !== undefined &&
      normalizedParent.email !== '' &&
      !isValidEmail(normalizedParent.email)
    ) {
      throw createValidationError(`parents[${index}].email must be a valid email address`);
    }

    return normalizedParent;
  });

  const primaryContacts = normalizedParents.filter((parent) => parent.isPrimary === true);
  if (primaryContacts.length > 1) {
    throw createValidationError('Only one primary parent or guardian contact is allowed');
  }

  if (normalizedParents.length > 0 && primaryContacts.length === 0) {
    normalizedParents[0].isPrimary = true;
  }

  return normalizedParents;
};

const normalizeEmergencyContactPayload = (emergencyContact = {}) => {
  const normalizedEmergencyContact = { ...emergencyContact };

  ['name', 'relationship', 'phone'].forEach((field) => {
    if (normalizedEmergencyContact[field] !== undefined) {
      normalizedEmergencyContact[field] = normalizeTrimmedString(
        normalizedEmergencyContact[field]
      );
    }
  });

  return normalizedEmergencyContact;
};

const normalizeMedicalPayload = (medical = {}) => {
  const normalizedMedical = { ...medical };

  ['conditions', 'allergies', 'medications'].forEach((field) => {
    if (normalizedMedical[field] !== undefined && !Array.isArray(normalizedMedical[field])) {
      throw createValidationError(`medical.${field} must be an array`);
    }
  });

  ['specialNeeds', 'bloodGroup'].forEach((field) => {
    if (normalizedMedical[field] !== undefined) {
      normalizedMedical[field] = normalizeTrimmedString(normalizedMedical[field]);
    }
  });

  return normalizedMedical;
};

const normalizeAcademicPayload = (
  academic = {},
  { requireCoreFields = false, allowAdmissionDateUpdate = true } = {}
) => {
  const normalizedAcademic = { ...academic };

  if (normalizedAcademic.currentClass !== undefined) {
    validateObjectId(normalizedAcademic.currentClass, 'academic.currentClass');
  }

  if (normalizedAcademic.session !== undefined) {
    validateObjectId(normalizedAcademic.session, 'academic.session');
  }

  if (normalizedAcademic.currentSection !== undefined) {
    normalizedAcademic.currentSection = normalizeTrimmedString(normalizedAcademic.currentSection);
  }

  if (normalizedAcademic.admissionDate !== undefined) {
    if (!allowAdmissionDateUpdate) {
      throw createValidationError('Admission date cannot be updated once the student is created');
    }

    if (!isValidDateInput(normalizedAcademic.admissionDate)) {
      throw createValidationError('academic.admissionDate must be a valid date');
    }
  }

  if (
    normalizedAcademic.previousSchool !== undefined &&
    !isPlainObject(normalizedAcademic.previousSchool)
  ) {
    throw createValidationError('academic.previousSchool must be a valid object');
  }

  if (isPlainObject(normalizedAcademic.previousSchool)) {
    normalizedAcademic.previousSchool = {
      ...normalizedAcademic.previousSchool
    };

    ['name', 'board', 'lastClass'].forEach((field) => {
      if (normalizedAcademic.previousSchool[field] !== undefined) {
        normalizedAcademic.previousSchool[field] = normalizeTrimmedString(
          normalizedAcademic.previousSchool[field]
        );
      }
    });
  }

  if (requireCoreFields) {
    const missingFields = ['currentClass', 'currentSection', 'session'].filter((field) =>
      isMissingRequiredValue(normalizedAcademic[field])
    );

    if (missingFields.length > 0) {
      throw createValidationError(`Missing required academic fields: ${missingFields.join(', ')}`);
    }
  }

  return normalizedAcademic;
};

const buildStudentDocumentEntries = (files = []) =>
  files.map((file) => ({
    name: file.originalname,
    type: file.mimetype,
    publicId: file.filename || file.public_id,
    url: file.path || file.secure_url || file.url,
    uploadDate: new Date()
  }));

const extractProfilePayload = (req, profileInput = {}) => {
  if (!isPlainObject(profileInput)) {
    throw createValidationError('profile must be a valid object');
  }

  const profile = { ...profileInput };
  const profileFields = [
    'firstName',
    'lastName',
    'middleName',
    'dateOfBirth',
    'gender',
    'bloodGroup',
    'email',
    'phone'
  ];

  profileFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      profile[field] = req.body[field];
    }
  });

  return profile;
};

const extractAcademicPayload = (req, academicInput = {}) => {
  if (!isPlainObject(academicInput)) {
    throw createValidationError('academic must be a valid object');
  }

  const academic = { ...academicInput };

  if (req.body.currentClass !== undefined) {
    academic.currentClass = req.body.currentClass;
  }

  if (req.body.currentSection !== undefined) {
    academic.currentSection = req.body.currentSection;
  }

  if (req.body.section !== undefined) {
    academic.currentSection = req.body.section;
  }

  if (req.body.session !== undefined) {
    academic.session = req.body.session;
  }

  if (req.body.admissionDate !== undefined) {
    academic.admissionDate = req.body.admissionDate;
  }

  return academic;
};

const ensureStudentIdentifierUniqueness = async ({
  admissionNumber,
  registrationNumber,
  currentStudentId
}) => {
  if (admissionNumber) {
    const admissionNumberExists = await Student.findOne({ admissionNumber }).select('_id');
    if (
      admissionNumberExists &&
      admissionNumberExists._id.toString() !== String(currentStudentId || '')
    ) {
      throw createValidationError('Admission number already exists');
    }
  }

  if (registrationNumber) {
    const registrationNumberExists = await Student.findOne({ registrationNumber }).select('_id');
    if (
      registrationNumberExists &&
      registrationNumberExists._id.toString() !== String(currentStudentId || '')
    ) {
      throw createValidationError('Registration number already exists');
    }
  }
};

export const getStudents = async (req, res) => {
  try {
    const {
      status,
      class: classIdFromClass,
      classId: classIdFromClassId,
      section,
      session,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const currentPage = Number(page) || 1;
    const perPage = Number(limit) || 10;
    const query = {};
    
    if (req.user?.school) {
      query.school = req.user.school;
    }

    const classId = classIdFromClass || classIdFromClassId;
    if (status) query.status = status;
    if (classId) query['academic.currentClass'] = classId;
    if (section) query['academic.currentSection'] = section;
    if (session) query['academic.session'] = session;

    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .populate('academic.currentClass', 'name level')
      .populate('academic.session', 'name')
      .limit(perPage)
      .skip((currentPage - 1) * perPage)
      .sort({ createdAt: -1 });

    const count = await Student.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / perPage),
      currentPage,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('academic.currentClass', 'name level sections')
      .populate('academic.session', 'name startDate endDate');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Ensure student belongs to user's school
    if (req.user?.school && student.school && student.school.toString() !== req.user.school.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this student'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createStudent = async (req, res) => {
  try {
    console.log('📝 [Student Create] Starting student creation...');
    console.log('📁 [Student Create] Files received:', req.files ? Object.keys(req.files) : 'no files');
    
    if (!req.files?.photo || req.files.photo.length === 0) {
      console.log('❌ [Student Create] No photo provided');
      return res.status(400).json({
        success: false,
        message: 'Profile photo is required'
      });
    }

    // Documents are now optional
    console.log('✅ [Student Create] Photo validated');

    let admissionNumber =
      normalizeUppercaseString(req.body.admissionNumber) ||
      req.studentUploadAdmissionNumber ||
      generateAdmissionNumber(new Date().getFullYear());

    const registrationNumber = normalizeUppercaseString(req.body.registrationNumber);
    const rollNumber = normalizeTrimmedString(req.body.rollNumber);

    const profile = extractProfilePayload(req, parseJsonField(req.body.profile, 'profile') || {});
    const parentsInput = parseJsonField(req.body.parents, 'parents');
    const emergencyContactInput = parseJsonField(
      req.body.emergencyContact,
      'emergencyContact'
    );
    const medicalInput = parseJsonField(req.body.medical, 'medical');
    const academic = extractAcademicPayload(
      req,
      parseJsonField(req.body.academic, 'academic') || {}
    );

    if (parentsInput === undefined) {
      throw createValidationError('parents is required');
    }

    if (emergencyContactInput !== undefined && !isPlainObject(emergencyContactInput)) {
      throw createValidationError('emergencyContact must be a valid object');
    }

    if (medicalInput !== undefined && !isPlainObject(medicalInput)) {
      throw createValidationError('medical must be a valid object');
    }

    const normalizedProfile = normalizeProfilePayload(profile);
    const normalizedParents = normalizeParentsPayload(parentsInput);

    const hasBiologicalParent = normalizedParents.some(
      (p) => p.relationship === 'father' || p.relationship === 'mother'
    );
    const hasGuardianEntry = normalizedParents.some((p) => p.relationship === 'guardian');
    if (!hasBiologicalParent && !hasGuardianEntry) {
      throw createValidationError(
        'Guardian information is required when no parent (father or mother) is provided'
      );
    }

    const normalizedEmergencyContact =
      emergencyContactInput !== undefined
        ? normalizeEmergencyContactPayload(emergencyContactInput)
        : undefined;
    const normalizedMedical =
      medicalInput !== undefined ? normalizeMedicalPayload(medicalInput) : undefined;
    const normalizedAcademic = normalizeAcademicPayload(academic, {
      requireCoreFields: true,
      allowAdmissionDateUpdate: true
    });

    await ensureStudentIdentifierUniqueness({ admissionNumber, registrationNumber });

    const photoFile = req.files.photo[0];
    normalizedProfile.photo = photoFile.path || photoFile.secure_url || photoFile.url;

    const statusValue = normalizeTrimmedString(req.body.status);
    const admissionStatusValue = normalizeTrimmedString(req.body.admissionStatus);

    const studentPayload = {
      school: req.user.school,
      admissionNumber,
      registrationNumber: registrationNumber || undefined,
      rollNumber: rollNumber || undefined,
      profile: normalizedProfile,
      parents: normalizedParents,
      emergencyContact: normalizedEmergencyContact,
      medical: normalizedMedical,
      academic: normalizedAcademic,
      documents: buildStudentDocumentEntries(req.files.documents),
      status: statusValue || undefined,
      admissionStatus: admissionStatusValue || undefined
    };

    const student = new Student(studentPayload);
    console.log('💾 [Student Create] Saving student to database...');
    await student.save();
    console.log('✅ [Student Create] Student saved successfully:', student._id);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student
    });
    console.log('📤 [Student Create] Response sent');
  } catch (error) {
    console.error('❌ [Student Create] Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Ensure student belongs to user's school
    if (req.user?.school && student.school && student.school.toString() !== req.user.school.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this student'
      });
    }

    const profileInput = parseJsonField(req.body.profile, 'profile');
    const parentsInput = parseJsonField(req.body.parents, 'parents');
    const emergencyContactInput = parseJsonField(req.body.emergencyContact, 'emergencyContact');
    const medicalInput = parseJsonField(req.body.medical, 'medical');
    const academicInput = parseJsonField(req.body.academic, 'academic');

    if (profileInput !== undefined && !isPlainObject(profileInput)) {
      return res.status(400).json({
        success: false,
        message: 'profile must be a valid object'
      });
    }

    if (parentsInput !== undefined && !Array.isArray(parentsInput)) {
      return res.status(400).json({
        success: false,
        message: 'parents must be an array'
      });
    }

    if (emergencyContactInput !== undefined && !isPlainObject(emergencyContactInput)) {
      return res.status(400).json({
        success: false,
        message: 'emergencyContact must be a valid object'
      });
    }

    if (medicalInput !== undefined && !isPlainObject(medicalInput)) {
      return res.status(400).json({
        success: false,
        message: 'medical must be a valid object'
      });
    }

    if (academicInput !== undefined && !isPlainObject(academicInput)) {
      return res.status(400).json({
        success: false,
        message: 'academic must be a valid object'
      });
    }

    const requestedAdmissionNumber = normalizeUppercaseString(req.body.admissionNumber);
    if (
      requestedAdmissionNumber !== undefined &&
      requestedAdmissionNumber !== '' &&
      requestedAdmissionNumber !== student.admissionNumber
    ) {
      return res.status(400).json({
        success: false,
        message: 'Admission number cannot be updated once the student is created'
      });
    }

    const hasAdmissionDateUpdate =
      req.body.admissionDate !== undefined ||
      req.body['academic.admissionDate'] !== undefined ||
      req.body['academic[admissionDate]'] !== undefined ||
      (academicInput &&
        Object.prototype.hasOwnProperty.call(academicInput, 'admissionDate'));

    if (hasAdmissionDateUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Admission date cannot be updated once the student is created'
      });
    }

    const updateData = {};
    const pushData = {};

    const profileUpdates = profileInput ? { ...profileInput } : {};
    [
      'firstName',
      'lastName',
      'middleName',
      'dateOfBirth',
      'gender',
      'bloodGroup',
      'email',
      'phone'
    ].forEach((field) => {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = req.body[field];
      }
    });

    if (req.files?.photo?.[0]) {
      const photoFile = req.files.photo[0];
      profileUpdates.photo = photoFile.path || photoFile.secure_url || photoFile.url;
    }

    if (Object.keys(profileUpdates).length > 0) {
      updateData.profile = mergeDefined(
        toPlainObject(student.profile),
        normalizeProfilePayload(mergeDefined(toPlainObject(student.profile), profileUpdates))
      );
    }

    if (parentsInput !== undefined) {
      const updatedParents = normalizeParentsPayload(parentsInput);
      const hasBiologicalParent = updatedParents.some(
        (p) => p.relationship === 'father' || p.relationship === 'mother'
      );
      const hasGuardianEntry = updatedParents.some((p) => p.relationship === 'guardian');
      if (!hasBiologicalParent && !hasGuardianEntry) {
        throw createValidationError(
          'Guardian information is required when no parent (father or mother) is provided'
        );
      }
      updateData.parents = updatedParents;
    }

    if (emergencyContactInput !== undefined) {
      updateData.emergencyContact = mergeDefined(
        toPlainObject(student.emergencyContact),
        normalizeEmergencyContactPayload(emergencyContactInput)
      );
    }

    if (medicalInput !== undefined) {
      updateData.medical = mergeDefined(
        toPlainObject(student.medical),
        normalizeMedicalPayload(medicalInput)
      );
    }

    const academicUpdates = academicInput ? { ...academicInput } : {};
    if (req.body.currentClass !== undefined) {
      academicUpdates.currentClass = req.body.currentClass;
    }

    if (req.body.currentSection !== undefined) {
      academicUpdates.currentSection = req.body.currentSection;
    }

    if (req.body.section !== undefined) {
      academicUpdates.currentSection = req.body.section;
    }

    if (req.body.session !== undefined) {
      academicUpdates.session = req.body.session;
    }

    if (Object.keys(academicUpdates).length > 0) {
      updateData.academic = mergeDefined(
        toPlainObject(student.academic),
        normalizeAcademicPayload(academicUpdates, {
          requireCoreFields: false,
          allowAdmissionDateUpdate: false
        })
      );
    }

    const registrationNumber = normalizeUppercaseString(req.body.registrationNumber);
    if (
      registrationNumber !== undefined &&
      registrationNumber !== '' &&
      registrationNumber !== student.registrationNumber
    ) {
      await ensureStudentIdentifierUniqueness({
        registrationNumber,
        currentStudentId: student._id
      });
      updateData.registrationNumber = registrationNumber;
    }

    if (req.body.rollNumber !== undefined) {
      updateData.rollNumber = normalizeTrimmedString(req.body.rollNumber);
    }

    if (req.body.status !== undefined) {
      updateData.status = normalizeTrimmedString(req.body.status);
    }

    if (req.body.admissionStatus !== undefined) {
      updateData.admissionStatus = normalizeTrimmedString(req.body.admissionStatus);
    }

    if (req.files?.documents?.length) {
      pushData.documents = {
        $each: buildStudentDocumentEntries(req.files.documents)
      };
    }

    const updateOperation = {};

    if (Object.keys(updateData).length > 0) {
      updateOperation.$set = updateData;
    }

    if (Object.keys(pushData).length > 0) {
      updateOperation.$push = pushData;
    }

    if (Object.keys(updateOperation).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update fields provided'
      });
    }

    const updatedStudent = await Student.findByIdAndUpdate(req.params.id, updateOperation, {
      new: true,
      runValidators: true
    })
      .populate('academic.currentClass', 'name level sections')
      .populate('academic.session', 'name startDate endDate');

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Ensure student belongs to user's school
    if (req.user?.school && student.school && student.school.toString() !== req.user.school.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this student'
      });
    }

    await Student.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateStudentStatus = async (req, res) => {
  try {
    const { status, reason, remarks } = req.body;

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Ensure student belongs to user's school
    if (req.user?.school && student.school && student.school.toString() !== req.user.school.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this student'
      });
    }

    student.statusHistory.push({
      status: student.status,
      reason,
      remarks
    });

    student.status = status;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student status updated successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const approveAdmission = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Ensure student belongs to the user's school
    if (req.user.school && student.school && student.school.toString() !== req.user.school.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve students from another school'
      });
    }

    student.admissionStatus = 'approved';
    student.status = 'active';
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Admission approved successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const promoteStudents = async (req, res) => {
  try {
    const { studentIds, toClass, toSection, toSession } = req.body;

    // School-scoped: only promote students belonging to this school
    const filter = { _id: { $in: studentIds } };
    if (req.user.school) {
      filter.school = req.user.school;
    }

    const result = await Student.updateMany(
      filter,
      {
        $set: {
          'academic.currentClass': toClass,
          'academic.currentSection': toSection,
          'academic.session': toSession
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} students promoted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
