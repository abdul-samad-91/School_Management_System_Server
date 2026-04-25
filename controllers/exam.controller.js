import mongoose from 'mongoose';
import Exam from '../models/Exam.model.js';
import Result from '../models/Result.model.js';
import AcademicSession from '../models/AcademicSession.model.js';
import Class from '../models/Class.model.js';
import Subject from '../models/Subject.model.js';
import Teacher from '../models/Teacher.model.js';
import Student from '../models/Student.model.js';
import GradingSystem from '../models/GradingSystem.model.js';

const EXAM_TYPES = [
  'midterm',
  'final',
  'unit_test',
  'quarterly',
  'half_yearly',
  'annual'
];

const createExamError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getExamErrorStatus = (error) => {
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

const handleExamError = (res, error) => {
  res.status(getExamErrorStatus(error)).json({
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
    throw createExamError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createExamError(`${fieldName} must be a valid id`);
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
    throw createExamError(`Invalid ${fieldName} JSON`);
  }
};

const normalizeTrimmedString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createExamError(`${fieldName} is required`);
    }

    return undefined;
  }

  return String(value).trim();
};

const normalizeNullableObjectId = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return ensureObjectId(value, fieldName);
};

const normalizeDateValue = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createExamError(`${fieldName} is required`);
    }

    return undefined;
  }

  const normalizedDate = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw createExamError(`${fieldName} must be a valid date`);
  }

  return normalizedDate;
};

const normalizeNumber = (value, fieldName, options = {}) => {
  const {
    required = false,
    min,
    max,
    integer = false
  } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createExamError(`${fieldName} is required`);
    }

    return undefined;
  }

  const normalizedNumber = Number(value);

  if (Number.isNaN(normalizedNumber)) {
    throw createExamError(`${fieldName} must be a valid number`);
  }

  if (integer && !Number.isInteger(normalizedNumber)) {
    throw createExamError(`${fieldName} must be an integer`);
  }

  if (min !== undefined && normalizedNumber < min) {
    throw createExamError(`${fieldName} must be greater than or equal to ${min}`);
  }

  if (max !== undefined && normalizedNumber > max) {
    throw createExamError(`${fieldName} must be less than or equal to ${max}`);
  }

  return normalizedNumber;
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

const normalizeExamType = (value, fieldName = 'type') => {
  const type = normalizeTrimmedString(value, fieldName, { required: true })?.toLowerCase();

  if (!EXAM_TYPES.includes(type)) {
    throw createExamError(`${fieldName} must be one of ${EXAM_TYPES.join(', ')}`);
  }

  return type;
};

const normalizePagination = (pageValue, limitValue) => {
  const page = Number.parseInt(pageValue, 10);
  const limit = Number.parseInt(limitValue, 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 10 : limit
  };
};

const roundToTwo = (value) => Number.parseFloat(Number(value).toFixed(2));

const getUserSchoolId = (req) => (req.user?.school ? toIdString(req.user.school) : null);
const isMasterAdmin = (req) => req.user?.role === 'master_admin';

const resolveScopedSchoolId = (req, explicitSchoolId) => {
  const userSchoolId = getUserSchoolId(req);
  const requestedSchoolId = explicitSchoolId
    ? ensureObjectId(explicitSchoolId, 'school')
    : null;

  if (!isMasterAdmin(req) && userSchoolId) {
    if (requestedSchoolId && requestedSchoolId !== userSchoolId) {
      throw createExamError(
        'You can only access exam records for your assigned branch',
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
    throw createExamError('school is required');
  }

  return schoolId;
};

const getSectionNameSet = (classDoc) =>
  new Set(
    (classDoc.sections || [])
      .map((section) => section?.name?.trim())
      .filter(Boolean)
  );

const ensureSectionsBelongToClass = (sections, classDoc, fieldName = 'sections') => {
  const validSections = getSectionNameSet(classDoc);
  const invalidSections = sections.filter((section) => !validSections.has(section));

  if (invalidSections.length > 0) {
    throw createExamError(
      `${fieldName} contain invalid section(s): ${invalidSections.join(', ')}`
    );
  }
};

const findSubjectClassConfig = (subjectDoc, classId) =>
  (subjectDoc.classes || []).find(
    (classConfig) => toIdString(classConfig.classId) === classId
  );

const ensureSessionExists = async (sessionId, schoolId) => {
  const query = { _id: ensureObjectId(sessionId, 'session') };

  if (schoolId) {
    query.school = schoolId;
  }

  const session = await AcademicSession.findOne(query).select('_id school name startDate endDate');

  if (!session) {
    throw createExamError('Academic session not found', 404);
  }

  return session;
};

const ensureClassDocuments = async (classIds = [], schoolId, sessionId) => {
  if (classIds.length === 0) {
    return new Map();
  }

  const query = {
    _id: { $in: classIds }
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  const classDocs = await Class.find(query).select('_id name level school session sections');

  if (classDocs.length !== classIds.length) {
    throw createExamError('One or more classes were not found', 404);
  }

  return new Map(classDocs.map((classDoc) => [toIdString(classDoc._id), classDoc]));
};

const ensureSubjectDocuments = async (subjectIds = [], schoolId, sessionId) => {
  if (subjectIds.length === 0) {
    return new Map();
  }

  const query = {
    _id: { $in: subjectIds }
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  const subjectDocs = await Subject.find(query).select(
    '_id code name school session classes'
  );

  if (subjectDocs.length !== subjectIds.length) {
    throw createExamError('One or more subjects were not found', 404);
  }

  return new Map(subjectDocs.map((subjectDoc) => [toIdString(subjectDoc._id), subjectDoc]));
};

const ensureTeacherDocuments = async (teacherIds = [], schoolId) => {
  if (teacherIds.length === 0) {
    return new Map();
  }

  const query = {
    _id: { $in: teacherIds }
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const teacherDocs = await Teacher.find(query).select(
    '_id employeeId school status profile.firstName profile.lastName'
  );

  if (teacherDocs.length !== teacherIds.length) {
    throw createExamError('One or more invigilators were not found', 404);
  }

  return new Map(teacherDocs.map((teacherDoc) => [toIdString(teacherDoc._id), teacherDoc]));
};

const ensureStudentDocument = async (studentId, schoolId) => {
  const query = {
    _id: ensureObjectId(studentId, 'student')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const student = await Student.findOne(query).select(
    '_id school status academic admissionNumber rollNumber profile.firstName profile.lastName'
  );

  if (!student) {
    throw createExamError('Student not found', 404);
  }

  return student;
};

const ensureGradingSystemExists = async (gradingSystemId, schoolId, sessionId) => {
  const query = {
    _id: ensureObjectId(gradingSystemId, 'gradingSystem')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  const gradingSystem = await GradingSystem.findOne(query);

  if (!gradingSystem) {
    throw createExamError('Grading system not found', 404);
  }

  return gradingSystem;
};

const ensureExamDocument = async (examId, schoolId, sessionId) => {
  const query = {
    _id: ensureObjectId(examId, 'exam')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  if (sessionId) {
    query.session = sessionId;
  }

  const exam = await Exam.findOne(query);

  if (!exam) {
    throw createExamError('Exam not found', 404);
  }

  return exam;
};

const getGradeName = (gradingSystem, percentage) => {
  if (!gradingSystem) {
    return undefined;
  }

  const matchedGrade =
    typeof gradingSystem.getGrade === 'function'
      ? gradingSystem.getGrade(percentage)
      : (gradingSystem.grades || []).find(
          (grade) =>
            percentage >= grade.minPercentage && percentage <= grade.maxPercentage
        );

  return matchedGrade?.name;
};

const buildExamQueryFilter = (req, baseFilter = {}) => {
  const schoolId = resolveScopedSchoolId(req, req.query.school);
  const query = { ...baseFilter };

  if (schoolId) {
    query.school = schoolId;
  }

  if (req.query.session) {
    query.session = ensureObjectId(req.query.session, 'session');
  }

  if (req.query.classId) {
    query.classes = ensureObjectId(req.query.classId, 'classId');
  }

  if (req.query.type) {
    query.type = normalizeExamType(req.query.type, 'type');
  }

  if (req.query.isPublished !== undefined) {
    query.isPublished = normalizeBoolean(req.query.isPublished);
  }

  if (req.query.isStarted !== undefined) {
    query.isStarted = normalizeBoolean(req.query.isStarted);
  }

  if (req.query.search) {
    query.name = {
      $regex: String(req.query.search).trim(),
      $options: 'i'
    };
  }

  return query;
};

const populateExamQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate('session', 'name startDate endDate')
    .populate('classes', 'name level sections')
    .populate('gradingSystem', 'name type passingGrade')
    .populate('schedule.subject', 'name code type')
    .populate('schedule.class', 'name level sections')
    .populate('schedule.invigilator', 'employeeId profile.firstName profile.lastName')
    .populate('createdBy', 'username role profile.firstName profile.lastName')
    .populate('publishedBy', 'username role profile.firstName profile.lastName')
    .populate('startedBy', 'username role profile.firstName profile.lastName');

const populateResultQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate(
      'student',
      'admissionNumber rollNumber profile.firstName profile.lastName profile.photo'
    )
    .populate('exam', 'name type startDate endDate isPublished isStarted')
    .populate('class', 'name level')
    .populate('session', 'name startDate endDate')
    .populate('subjectTeacher', 'employeeId profile.firstName profile.lastName')
    .populate('subjects.subject', 'name code type')
    .populate('enteredBy', 'username role profile.firstName profile.lastName');

const ensureScheduleArray = (schedule) => {
  if (schedule === undefined) {
    return [];
  }

  if (!Array.isArray(schedule)) {
    throw createExamError('schedule must be an array');
  }

  return schedule;
};

const extractScheduleIds = (schedule = []) => {
  const classIds = [];
  const subjectIds = [];
  const teacherIds = [];

  schedule.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw createExamError(`schedule[${index}] must be a valid object`);
    }

    if (entry.class !== undefined || entry.classId !== undefined) {
      classIds.push(
        ensureObjectId(entry.class || entry.classId, `schedule[${index}].class`)
      );
    }

    if (entry.subject !== undefined || entry.subjectId !== undefined) {
      subjectIds.push(
        ensureObjectId(entry.subject || entry.subjectId, `schedule[${index}].subject`)
      );
    }

    if (entry.invigilator !== undefined && entry.invigilator !== null && entry.invigilator !== '') {
      teacherIds.push(
        ensureObjectId(entry.invigilator, `schedule[${index}].invigilator`)
      );
    }
  });

  return {
    classIds: [...new Set(classIds)],
    subjectIds: [...new Set(subjectIds)],
    teacherIds: [...new Set(teacherIds)]
  };
};

const normalizeScheduleEntries = ({
  schedule,
  classDocsMap,
  subjectDocsMap,
  teacherDocsMap,
  examStartDate,
  examEndDate,
  allowedClassIds
}) =>
  schedule.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw createExamError(`schedule[${index}] must be a valid object`);
    }

    const classId = ensureObjectId(
      entry.class || entry.classId,
      `schedule[${index}].class`
    );

    if (allowedClassIds.length > 0 && !allowedClassIds.includes(classId)) {
      throw createExamError(
        `schedule[${index}].class must belong to the selected exam classes`
      );
    }

    const classDoc = classDocsMap.get(classId);
    if (!classDoc) {
      throw createExamError(`schedule[${index}].class was not found`, 404);
    }

    const subjectId = ensureObjectId(
      entry.subject || entry.subjectId,
      `schedule[${index}].subject`
    );
    const subjectDoc = subjectDocsMap.get(subjectId);

    if (!subjectDoc) {
      throw createExamError(`schedule[${index}].subject was not found`, 404);
    }

    const subjectClassConfig = findSubjectClassConfig(subjectDoc, classId);

    if (!subjectClassConfig) {
      throw createExamError(
        `schedule[${index}].subject is not assigned to the selected class`
      );
    }

    const sections = normalizeStringArray(
      entry.sections,
      `schedule[${index}].sections`
    );

    if (sections.length > 0) {
      ensureSectionsBelongToClass(
        sections,
        classDoc,
        `schedule[${index}].sections`
      );
    }

    const configuredSections = normalizeStringArray(
      subjectClassConfig.sections,
      `schedule[${index}].sections`
    );

    if (configuredSections.length > 0) {
      const invalidSections = sections.filter(
        (section) => !configuredSections.includes(section)
      );

      if (invalidSections.length > 0) {
        throw createExamError(
          `schedule[${index}].sections contain section(s) not assigned to the subject: ${invalidSections.join(', ')}`
        );
      }
    }

    const examDate = normalizeDateValue(entry.date, `schedule[${index}].date`, {
      required: true
    });

    if (examDate < examStartDate || examDate > examEndDate) {
      throw createExamError(
        `schedule[${index}].date must fall within the exam start and end dates`
      );
    }

    const maxMarks =
      entry.maxMarks !== undefined
        ? normalizeNumber(entry.maxMarks, `schedule[${index}].maxMarks`, {
            required: true,
            min: 1
          })
        : normalizeNumber(subjectClassConfig.maxMarks, `schedule[${index}].maxMarks`, {
            required: true,
            min: 1
          });

    const passingMarks =
      entry.passingMarks !== undefined
        ? normalizeNumber(entry.passingMarks, `schedule[${index}].passingMarks`, {
            required: true,
            min: 0
          })
        : normalizeNumber(
            subjectClassConfig.passingMarks,
            `schedule[${index}].passingMarks`,
            {
              required: true,
              min: 0
            }
          );

    if (passingMarks > maxMarks) {
      throw createExamError(
        `schedule[${index}].passingMarks cannot be greater than maxMarks`
      );
    }

    const invigilatorId = normalizeNullableObjectId(
      entry.invigilator,
      `schedule[${index}].invigilator`
    );

    if (invigilatorId && !teacherDocsMap.get(invigilatorId)) {
      throw createExamError(`schedule[${index}].invigilator was not found`, 404);
    }

    return {
      subject: subjectId,
      class: classId,
      sections,
      date: examDate,
      startTime: normalizeTrimmedString(
        entry.startTime,
        `schedule[${index}].startTime`
      ),
      endTime: normalizeTrimmedString(entry.endTime, `schedule[${index}].endTime`),
      maxMarks,
      passingMarks,
      room: normalizeTrimmedString(entry.room, `schedule[${index}].room`),
      invigilator: invigilatorId || undefined
    };
  });

const buildExamScheduleRules = (exam, classId, section) => {
  const rules = new Map();

  (exam.schedule || []).forEach((entry) => {
    if (toIdString(entry.class) !== classId) {
      return;
    }

    const assignedSections = normalizeStringArray(entry.sections, 'schedule.sections');

    if (assignedSections.length > 0 && !assignedSections.includes(section)) {
      return;
    }

    rules.set(toIdString(entry.subject), {
      maxMarks: entry.maxMarks,
      passingMarks: entry.passingMarks
    });
  });

  return rules;
};

const normalizeAttendancePayload = (attendanceInput) => {
  if (attendanceInput === undefined) {
    return undefined;
  }

  if (!isPlainObject(attendanceInput)) {
    throw createExamError('attendance must be a valid object');
  }

  const total = normalizeNumber(attendanceInput.total, 'attendance.total', {
    required: true,
    min: 0
  });
  const present = normalizeNumber(attendanceInput.present, 'attendance.present', {
    required: true,
    min: 0
  });

  if (present > total) {
    throw createExamError('attendance.present cannot be greater than attendance.total');
  }

  const percentage =
    attendanceInput.percentage !== undefined
      ? normalizeNumber(attendanceInput.percentage, 'attendance.percentage', {
          min: 0,
          max: 100
        })
      : total === 0
        ? 0
        : roundToTwo((present / total) * 100);

  return {
    total,
    present,
    percentage
  };
};

const normalizeResultSubjects = ({
  subjectsInput,
  subjectDocsMap,
  examSubjectRules,
  gradingSystem,
  classId,
  section
}) => {
  if (!Array.isArray(subjectsInput) || subjectsInput.length === 0) {
    throw createExamError('subjects must be a non-empty array');
  }

  const usedSubjects = new Set();

  return subjectsInput.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw createExamError(`subjects[${index}] must be a valid object`);
    }

    const subjectId = ensureObjectId(
      entry.subject || entry.subjectId,
      `subjects[${index}].subject`
    );

    if (usedSubjects.has(subjectId)) {
      throw createExamError('subjects cannot contain duplicate subject entries');
    }

    usedSubjects.add(subjectId);

    const subjectDoc = subjectDocsMap.get(subjectId);
    if (!subjectDoc) {
      throw createExamError(`subjects[${index}].subject was not found`, 404);
    }

    const subjectClassConfig = findSubjectClassConfig(subjectDoc, classId);
    if (!subjectClassConfig) {
      throw createExamError(
        `subjects[${index}].subject is not assigned to the selected class`
      );
    }

    const configuredSections = normalizeStringArray(
      subjectClassConfig.sections,
      `subjects[${index}].sections`
    );

    if (configuredSections.length > 0 && !configuredSections.includes(section)) {
      throw createExamError(
        `subjects[${index}].subject is not assigned to section '${section}'`
      );
    }

    const examRule = examSubjectRules.get(subjectId);
    const resolvedMaxMarks =
      examRule?.maxMarks !== undefined ? examRule.maxMarks : subjectClassConfig.maxMarks;
    const resolvedPassingMarks =
      examRule?.passingMarks !== undefined
        ? examRule.passingMarks
        : subjectClassConfig.passingMarks;

    const maxMarks =
      entry.maxMarks !== undefined
        ? normalizeNumber(entry.maxMarks, `subjects[${index}].maxMarks`, {
            required: true,
            min: 1
          })
        : normalizeNumber(resolvedMaxMarks, `subjects[${index}].maxMarks`, {
            required: true,
            min: 1
          });

    const marksObtained = normalizeNumber(
      entry.marksObtained,
      `subjects[${index}].marksObtained`,
      {
        required: true,
        min: 0
      }
    );

    if (marksObtained > maxMarks) {
      throw createExamError(
        `subjects[${index}].marksObtained cannot be greater than maxMarks`
      );
    }

    const percentage = maxMarks === 0 ? 0 : (marksObtained / maxMarks) * 100;
    const grade =
      gradingSystem
        ? getGradeName(gradingSystem, percentage)
        : normalizeTrimmedString(entry.grade, `subjects[${index}].grade`);

    const isPassed =
      resolvedPassingMarks !== undefined && resolvedPassingMarks !== null
        ? marksObtained >= Number(resolvedPassingMarks)
        : normalizeBoolean(entry.isPassed);

    return {
      subject: subjectId,
      marksObtained,
      maxMarks,
      grade,
      remarks: normalizeTrimmedString(entry.remarks, `subjects[${index}].remarks`),
      isPassed
    };
  });
};

const computeResultSummary = (subjects, gradingSystem) => {
  const totalMarks = subjects.reduce((sum, subject) => sum + subject.marksObtained, 0);
  const totalMaxMarks = subjects.reduce((sum, subject) => sum + subject.maxMarks, 0);
  const percentage = totalMaxMarks === 0 ? 0 : roundToTwo((totalMarks / totalMaxMarks) * 100);

  return {
    totalMarks,
    totalMaxMarks,
    percentage,
    overallGrade: getGradeName(gradingSystem, percentage)
  };
};

const buildResultQueryFilter = (req) => {
  const schoolId = resolveScopedSchoolId(req, req.query.school);
  const query = {};

  if (schoolId) {
    query.school = schoolId;
  }

  if (req.query.examId) {
    query.exam = ensureObjectId(req.query.examId, 'examId');
  }

  if (req.query.studentId) {
    query.student = ensureObjectId(req.query.studentId, 'studentId');
  }

  if (req.query.classId) {
    query.class = ensureObjectId(req.query.classId, 'classId');
  }

  if (req.query.session) {
    query.session = ensureObjectId(req.query.session, 'session');
  }

  if (req.query.section) {
    query.section = normalizeTrimmedString(req.query.section, 'section');
  }

  if (req.query.isPublished !== undefined) {
    query.isPublished = normalizeBoolean(req.query.isPublished);
  }

  return query;
};

const findScopedExamById = async (req, examId) => {
  const schoolId = resolveScopedSchoolId(req, undefined);
  const query = {
    _id: ensureObjectId(examId, 'exam')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const exam = await Exam.findOne(query);

  if (!exam) {
    throw createExamError('Exam not found', 404);
  }

  return exam;
};

const findScopedResultById = async (req, resultId) => {
  const schoolId = resolveScopedSchoolId(req, undefined);
  const query = {
    _id: ensureObjectId(resultId, 'result')
  };

  if (schoolId) {
    query.school = schoolId;
  }

  const result = await Result.findOne(query);

  if (!result) {
    throw createExamError('Result not found', 404);
  }

  return result;
};

// ========== Exams ==========

export const getExams = async (req, res) => {
  try {
    const query = buildExamQueryFilter(req);
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);

    const exams = await populateExamQuery(
      Exam.find(query)
        .sort({ startDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    );

    const count = await Exam.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: exams
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const getExam = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, undefined);
    const query = {
      _id: ensureObjectId(req.params.id, 'exam')
    };

    if (schoolId) {
      query.school = schoolId;
    }

    const exam = await populateExamQuery(Exam.findOne(query));

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    res.status(200).json({
      success: true,
      data: exam
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const createExam = async (req, res) => {
  try {
    const protectedFields = [
      'isPublished',
      'publishedAt',
      'publishedBy',
      'isStarted',
      'startedAt',
      'startedBy',
      'createdBy'
    ];

    const providedProtectedFields = protectedFields.filter((field) => hasOwn(req.body, field));
    if (providedProtectedFields.length > 0) {
      throw createExamError(
        `These fields are controlled automatically: ${providedProtectedFields.join(', ')}`
      );
    }

    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    const sessionId = ensureObjectId(req.body.session, 'session');
    await ensureSessionExists(sessionId, schoolId);

    const rawSchedule = ensureScheduleArray(
      parseStructuredField(req.body.schedule, 'schedule')
    );
    const rawClasses = parseStructuredField(req.body.classes, 'classes');
    const explicitClassIds = normalizeObjectIdArray(rawClasses, 'classes');
    const scheduleIds = extractScheduleIds(rawSchedule);
    const scheduleClassIds = scheduleIds.classIds;

    if (
      explicitClassIds.length > 0 &&
      scheduleClassIds.some((classId) => !explicitClassIds.includes(classId))
    ) {
      throw createExamError(
        'All scheduled classes must be included in the classes field'
      );
    }

    const classIds =
      explicitClassIds.length > 0 ? explicitClassIds : scheduleClassIds;

    if (classIds.length === 0) {
      throw createExamError('classes is required, or schedule must include class entries');
    }

    const classDocsMap = await ensureClassDocuments(classIds, schoolId, sessionId);
    const subjectDocsMap = await ensureSubjectDocuments(
      scheduleIds.subjectIds,
      schoolId,
      sessionId
    );
    const teacherDocsMap = await ensureTeacherDocuments(
      scheduleIds.teacherIds,
      schoolId
    );

    const startDate = normalizeDateValue(req.body.startDate, 'startDate', {
      required: true
    });
    const endDate = normalizeDateValue(req.body.endDate, 'endDate', {
      required: true
    });

    if (endDate < startDate) {
      throw createExamError('endDate must be greater than or equal to startDate');
    }

    const normalizedSchedule = normalizeScheduleEntries({
      schedule: rawSchedule,
      classDocsMap,
      subjectDocsMap,
      teacherDocsMap,
      examStartDate: startDate,
      examEndDate: endDate,
      allowedClassIds: classIds
    });

    let gradingSystemId;
    if (req.body.gradingSystem !== undefined && req.body.gradingSystem !== '') {
      gradingSystemId = ensureObjectId(req.body.gradingSystem, 'gradingSystem');
      await ensureGradingSystemExists(gradingSystemId, schoolId, sessionId);
    }

    const exam = await Exam.create({
      school: schoolId,
      name: normalizeTrimmedString(req.body.name, 'name', { required: true }),
      type: normalizeExamType(req.body.type),
      session: sessionId,
      classes: classIds,
      startDate,
      endDate,
      weightage: normalizeNumber(req.body.weightage, 'weightage', {
        min: 0,
        max: 100
      }) ?? 100,
      schedule: normalizedSchedule,
      gradingSystem: gradingSystemId,
      createdBy: req.user?._id
    });

    const populatedExam = await populateExamQuery(Exam.findById(exam._id));

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: populatedExam
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const updateExam = async (req, res) => {
  try {
    const exam = await findScopedExamById(req, req.params.id);

    if (exam.isStarted) {
      throw createExamError('Started exams cannot be updated');
    }

    const protectedFields = [
      'isPublished',
      'publishedAt',
      'publishedBy',
      'isStarted',
      'startedAt',
      'startedBy',
      'createdBy'
    ];

    const providedProtectedFields = protectedFields.filter((field) => hasOwn(req.body, field));
    if (providedProtectedFields.length > 0) {
      throw createExamError(
        `These fields are controlled automatically: ${providedProtectedFields.join(', ')}`
      );
    }

    const schoolId = resolveScopedSchoolId(req, exam.school);
    const sessionId =
      req.body.session !== undefined
        ? ensureObjectId(req.body.session, 'session')
        : toIdString(exam.session);
    await ensureSessionExists(sessionId, schoolId);

    const hasClassesUpdate = hasOwn(req.body, 'classes');
    const hasScheduleUpdate = hasOwn(req.body, 'schedule');

    const rawSchedule = hasScheduleUpdate
      ? ensureScheduleArray(parseStructuredField(req.body.schedule, 'schedule'))
      : (exam.schedule || []).map((entry) =>
          typeof entry.toObject === 'function' ? entry.toObject() : entry
        );

    const scheduleIds = extractScheduleIds(rawSchedule);
    let classIds = hasClassesUpdate
      ? normalizeObjectIdArray(parseStructuredField(req.body.classes, 'classes'), 'classes')
      : (exam.classes || []).map((classId) => toIdString(classId));

    if (hasScheduleUpdate) {
      if (hasClassesUpdate) {
        const invalidScheduleClasses = scheduleIds.classIds.filter(
          (classId) => !classIds.includes(classId)
        );

        if (invalidScheduleClasses.length > 0) {
          throw createExamError(
            'All scheduled classes must be included in the classes field'
          );
        }
      } else if (scheduleIds.classIds.length > 0) {
        classIds = scheduleIds.classIds;
      }
    }

    if (!hasScheduleUpdate && hasClassesUpdate && scheduleIds.classIds.length > 0) {
      const invalidExistingClasses = scheduleIds.classIds.filter(
        (classId) => !classIds.includes(classId)
      );

      if (invalidExistingClasses.length > 0) {
        throw createExamError(
          'classes cannot remove class mappings that are still used in the existing schedule'
        );
      }
    }

    if (classIds.length === 0) {
      throw createExamError('classes cannot be empty');
    }

    const classDocsMap = await ensureClassDocuments(classIds, schoolId, sessionId);
    const subjectDocsMap = await ensureSubjectDocuments(
      scheduleIds.subjectIds,
      schoolId,
      sessionId
    );
    const teacherDocsMap = await ensureTeacherDocuments(
      scheduleIds.teacherIds,
      schoolId
    );

    const startDate =
      req.body.startDate !== undefined
        ? normalizeDateValue(req.body.startDate, 'startDate', { required: true })
        : new Date(exam.startDate);
    const endDate =
      req.body.endDate !== undefined
        ? normalizeDateValue(req.body.endDate, 'endDate', { required: true })
        : new Date(exam.endDate);

    if (endDate < startDate) {
      throw createExamError('endDate must be greater than or equal to startDate');
    }

    const normalizedSchedule = normalizeScheduleEntries({
      schedule: rawSchedule,
      classDocsMap,
      subjectDocsMap,
      teacherDocsMap,
      examStartDate: startDate,
      examEndDate: endDate,
      allowedClassIds: classIds
    });

    let gradingSystemId = exam.gradingSystem ? toIdString(exam.gradingSystem) : undefined;
    if (hasOwn(req.body, 'gradingSystem')) {
      if (req.body.gradingSystem === '' || req.body.gradingSystem === null) {
        gradingSystemId = undefined;
      } else {
        gradingSystemId = ensureObjectId(req.body.gradingSystem, 'gradingSystem');
        await ensureGradingSystemExists(gradingSystemId, schoolId, sessionId);
      }
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      exam._id,
      {
        name:
          req.body.name !== undefined
            ? normalizeTrimmedString(req.body.name, 'name', { required: true })
            : exam.name,
        type:
          req.body.type !== undefined
            ? normalizeExamType(req.body.type)
            : exam.type,
        session: sessionId,
        classes: classIds,
        startDate,
        endDate,
        weightage:
          req.body.weightage !== undefined
            ? normalizeNumber(req.body.weightage, 'weightage', {
                min: 0,
                max: 100
              })
            : exam.weightage,
        schedule: normalizedSchedule,
        gradingSystem: gradingSystemId
      },
      { new: true, runValidators: true }
    );

    const populatedExam = await populateExamQuery(Exam.findById(updatedExam._id));

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: populatedExam
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const publishExam = async (req, res) => {
  try {
    const exam = await findScopedExamById(req, req.params.id);

    if (exam.isPublished) {
      throw createExamError('Exam is already published');
    }

    if (!exam.schedule || exam.schedule.length === 0) {
      throw createExamError('Exam schedule must be created before publishing the exam');
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      exam._id,
      {
        isPublished: true,
        publishedAt: new Date(),
        publishedBy: req.user?._id
      },
      { new: true }
    );

    const populatedExam = await populateExamQuery(Exam.findById(updatedExam._id));

    res.status(200).json({
      success: true,
      message: 'Exam published successfully',
      data: populatedExam
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const startExam = async (req, res) => {
  try {
    const exam = await findScopedExamById(req, req.params.id);

    if (!exam.isPublished) {
      throw createExamError('Exam must be published before it can be started');
    }

    if (!exam.schedule || exam.schedule.length === 0) {
      throw createExamError('Exam schedule must be created before starting the exam');
    }

    if (exam.isStarted) {
      throw createExamError('Exam has already been started');
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      exam._id,
      {
        isStarted: true,
        startedAt: new Date(),
        startedBy: req.user?._id
      },
      { new: true }
    );

    const populatedExam = await populateExamQuery(Exam.findById(updatedExam._id));

    res.status(200).json({
      success: true,
      message: 'Exam started successfully',
      data: populatedExam
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

// ========== Results ==========

export const getResults = async (req, res) => {
  try {
    const query = buildResultQueryFilter(req);
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);

    const results = await populateResultQuery(
      Result.find(query)
        .sort({ rank: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    );

    const count = await Result.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: results
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const createResult = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    const sessionId = ensureObjectId(req.body.session, 'session');
    const classId = ensureObjectId(req.body.class || req.body.classId, 'class');
    const examId = ensureObjectId(req.body.exam, 'exam');
    const studentId = ensureObjectId(req.body.student, 'student');
    const section = normalizeTrimmedString(req.body.section, 'section', {
      required: true
    });
    const subjectTeacherId = normalizeNullableObjectId(
      req.body.subjectTeacher,
      'subjectTeacher'
    );

    const subjectsInput = parseStructuredField(req.body.subjects, 'subjects');
    const attendanceInput = parseStructuredField(req.body.attendance, 'attendance');

    await ensureSessionExists(sessionId, schoolId);
    const classDocsMap = await ensureClassDocuments([classId], schoolId, sessionId);
    const classDoc = classDocsMap.get(classId);
    ensureSectionsBelongToClass([section], classDoc, 'section');

    const exam = await ensureExamDocument(examId, schoolId, sessionId);
    if (
      exam.classes &&
      exam.classes.length > 0 &&
      !exam.classes.some((examClassId) => toIdString(examClassId) === classId)
    ) {
      throw createExamError('Selected class is not assigned to the exam');
    }

    const student = await ensureStudentDocument(studentId, schoolId);
    if (toIdString(student.academic?.currentClass) !== classId) {
      throw createExamError('Student does not belong to the selected class');
    }

    if (
      student.academic?.session &&
      toIdString(student.academic.session) !== sessionId
    ) {
      throw createExamError('Student does not belong to the selected session');
    }

    if (
      student.academic?.currentSection &&
      student.academic.currentSection.trim() !== section
    ) {
      throw createExamError('Student does not belong to the selected section');
    }

    const subjectEntries = Array.isArray(subjectsInput) ? subjectsInput : [];
    const subjectIds = [
      ...new Set(
        subjectEntries.map((entry, index) => {
          if (!isPlainObject(entry)) {
            throw createExamError(`subjects[${index}] must be a valid object`);
          }

          return ensureObjectId(
            entry.subject || entry.subjectId,
            `subjects[${index}].subject`
          );
        })
      )
    ];

    const subjectDocsMap = await ensureSubjectDocuments(subjectIds, schoolId, sessionId);
    const gradingSystem = exam.gradingSystem
      ? await ensureGradingSystemExists(toIdString(exam.gradingSystem), schoolId, sessionId)
      : null;

    if (subjectTeacherId) {
      await ensureTeacherDocuments([subjectTeacherId], schoolId);
    }

    const normalizedSubjects = normalizeResultSubjects({
      subjectsInput,
      subjectDocsMap,
      examSubjectRules: buildExamScheduleRules(exam, classId, section),
      gradingSystem,
      classId,
      section
    });
    const attendance = normalizeAttendancePayload(attendanceInput);
    const resultSummary = computeResultSummary(normalizedSubjects, gradingSystem);

    const existingResult = await Result.findOne({
      school: schoolId,
      exam: examId,
      student: studentId,
      class: classId,
      section
    });

    if (existingResult) {
      throw createExamError(
        'Result already exists for this student in the selected exam, class, and section'
      );
    }

    const result = await Result.create({
      school: schoolId,
      student: studentId,
      exam: examId,
      subjectTeacher: subjectTeacherId || undefined,
      class: classId,
      section,
      session: sessionId,
      subjects: normalizedSubjects,
      ...resultSummary,
      rank:
        req.body.rank !== undefined
          ? normalizeNumber(req.body.rank, 'rank', { min: 1, integer: true })
          : undefined,
      attendance,
      remarks: normalizeTrimmedString(req.body.remarks, 'remarks'),
      enteredBy: req.user?._id
    });

    const populatedResult = await populateResultQuery(Result.findById(result._id));

    res.status(201).json({
      success: true,
      message: 'Result created successfully',
      data: populatedResult
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const updateResult = async (req, res) => {
  try {
    const result = await findScopedResultById(req, req.params.id);

    const schoolId = resolveScopedSchoolId(req, result.school);
    const sessionId =
      req.body.session !== undefined
        ? ensureObjectId(req.body.session, 'session')
        : toIdString(result.session);
    const classId =
      req.body.class !== undefined || req.body.classId !== undefined
        ? ensureObjectId(req.body.class || req.body.classId, 'class')
        : toIdString(result.class);
    const examId =
      req.body.exam !== undefined
        ? ensureObjectId(req.body.exam, 'exam')
        : toIdString(result.exam);
    const studentId =
      req.body.student !== undefined
        ? ensureObjectId(req.body.student, 'student')
        : toIdString(result.student);
    const section =
      req.body.section !== undefined
        ? normalizeTrimmedString(req.body.section, 'section', { required: true })
        : result.section;

    const hasSubjectsUpdate = hasOwn(req.body, 'subjects');
    const subjectsInput = hasSubjectsUpdate
      ? parseStructuredField(req.body.subjects, 'subjects')
      : (result.subjects || []).map((entry) =>
          typeof entry.toObject === 'function' ? entry.toObject() : entry
        );

    const hasAttendanceUpdate = hasOwn(req.body, 'attendance');
    const attendanceInput = hasAttendanceUpdate
      ? parseStructuredField(req.body.attendance, 'attendance')
      : result.attendance && typeof result.attendance.toObject === 'function'
        ? result.attendance.toObject()
        : result.attendance;

    const subjectTeacherId = hasOwn(req.body, 'subjectTeacher')
      ? normalizeNullableObjectId(req.body.subjectTeacher, 'subjectTeacher')
      : toIdString(result.subjectTeacher);

    await ensureSessionExists(sessionId, schoolId);
    const classDocsMap = await ensureClassDocuments([classId], schoolId, sessionId);
    const classDoc = classDocsMap.get(classId);
    ensureSectionsBelongToClass([section], classDoc, 'section');

    const exam = await ensureExamDocument(examId, schoolId, sessionId);
    if (
      exam.classes &&
      exam.classes.length > 0 &&
      !exam.classes.some((examClassId) => toIdString(examClassId) === classId)
    ) {
      throw createExamError('Selected class is not assigned to the exam');
    }

    const student = await ensureStudentDocument(studentId, schoolId);
    if (toIdString(student.academic?.currentClass) !== classId) {
      throw createExamError('Student does not belong to the selected class');
    }

    if (
      student.academic?.session &&
      toIdString(student.academic.session) !== sessionId
    ) {
      throw createExamError('Student does not belong to the selected session');
    }

    if (
      student.academic?.currentSection &&
      student.academic.currentSection.trim() !== section
    ) {
      throw createExamError('Student does not belong to the selected section');
    }

    const subjectEntries = Array.isArray(subjectsInput) ? subjectsInput : [];
    const subjectIds = [
      ...new Set(
        subjectEntries.map((entry, index) => {
          if (!isPlainObject(entry)) {
            throw createExamError(`subjects[${index}] must be a valid object`);
          }

          return ensureObjectId(
            entry.subject || entry.subjectId,
            `subjects[${index}].subject`
          );
        })
      )
    ];

    const subjectDocsMap = await ensureSubjectDocuments(subjectIds, schoolId, sessionId);
    const gradingSystem = exam.gradingSystem
      ? await ensureGradingSystemExists(toIdString(exam.gradingSystem), schoolId, sessionId)
      : null;

    if (subjectTeacherId) {
      await ensureTeacherDocuments([subjectTeacherId], schoolId);
    }

    const normalizedSubjects = normalizeResultSubjects({
      subjectsInput,
      subjectDocsMap,
      examSubjectRules: buildExamScheduleRules(exam, classId, section),
      gradingSystem,
      classId,
      section
    });
    const attendance = hasAttendanceUpdate
      ? normalizeAttendancePayload(attendanceInput)
      : attendanceInput;
    const resultSummary = computeResultSummary(normalizedSubjects, gradingSystem);

    const updatedResult = await Result.findByIdAndUpdate(
      result._id,
      {
        school: schoolId,
        student: studentId,
        exam: examId,
        subjectTeacher: subjectTeacherId || undefined,
        class: classId,
        section,
        session: sessionId,
        subjects: normalizedSubjects,
        ...resultSummary,
        rank:
          req.body.rank !== undefined
            ? normalizeNumber(req.body.rank, 'rank', { min: 1, integer: true })
            : result.rank,
        attendance,
        remarks:
          req.body.remarks !== undefined
            ? normalizeTrimmedString(req.body.remarks, 'remarks')
            : result.remarks
      },
      { new: true, runValidators: true }
    );

    const populatedResult = await populateResultQuery(Result.findById(updatedResult._id));

    res.status(200).json({
      success: true,
      message: 'Result updated successfully',
      data: populatedResult
    });
  } catch (error) {
    handleExamError(res, error);
  }
};

export const publishResults = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    const examId = ensureObjectId(req.body.examId, 'examId');
    const query = {
      school: schoolId,
      exam: examId
    };

    const exam = await ensureExamDocument(examId, schoolId);

    if (req.body.classId) {
      query.class = ensureObjectId(req.body.classId, 'classId');

      if (
        exam.classes &&
        exam.classes.length > 0 &&
        !exam.classes.some((examClassId) => toIdString(examClassId) === query.class)
      ) {
        throw createExamError('Selected class is not assigned to the exam');
      }
    }

    if (req.body.section) {
      query.section = normalizeTrimmedString(req.body.section, 'section', {
        required: true
      });
    }

    const result = await Result.updateMany(query, {
      $set: { isPublished: true }
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} results published successfully`
    });
  } catch (error) {
    handleExamError(res, error);
  }
};
