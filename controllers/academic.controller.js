import mongoose from 'mongoose';
import School from '../models/School.model.js';
import AcademicSession from '../models/AcademicSession.model.js';
import Class from '../models/Class.model.js';
import Subject from '../models/Subject.model.js';
import Teacher from '../models/Teacher.model.js';
import Student from '../models/Student.model.js';
import GradingSystem from '../models/GradingSystem.model.js';
import Timetable from '../models/Timetable.model.js';

const createAcademicError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAcademicErrorStatus = (error) => {
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

const handleAcademicError = (res, error) => {
  res.status(getAcademicErrorStatus(error)).json({
    success: false,
    message: error.message
  });
};

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
    throw createAcademicError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createAcademicError(`${fieldName} must be a valid id`);
  }

  return toIdString(value);
};

const normalizeTrimmedString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createAcademicError(`${fieldName} is required`);
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
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  return Boolean(value);
};

const normalizeStringArray = (values = []) => {
  if (values === undefined || values === null) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw createAcademicError('Expected an array of strings');
  }

  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
};

const normalizeObjectIdArray = (values, fieldName) => {
  if (values === undefined || values === null) {
    return [];
  }

  const normalizedValues = Array.isArray(values) ? values : [values];

  return [...new Set(normalizedValues.map((value) => ensureObjectId(value, fieldName)))];
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
      throw createAcademicError(
        'You can only access academic records for your assigned branch',
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
    throw createAcademicError('school is required');
  }

  return schoolId;
};

const ensureSchoolExists = async (schoolId) => {
  const school = await School.findById(schoolId).select('_id name code');

  if (!school) {
    throw createAcademicError('Branch not found', 404);
  }

  return school;
};

const ensureSessionExists = async (sessionId, schoolId) => {
  const query = { _id: ensureObjectId(sessionId, 'session') };

  if (schoolId) {
    query.school = schoolId;
  }

  const session = await AcademicSession.findOne(query);

  if (!session) {
    throw createAcademicError('Academic session not found', 404);
  }

  return session;
};

const ensureClassExists = async (classId, schoolId) => {
  const query = { _id: ensureObjectId(classId, 'classId') };

  if (schoolId) {
    query.school = schoolId;
  }

  const classDoc = await Class.findOne(query);

  if (!classDoc) {
    throw createAcademicError('Class not found', 404);
  }

  return classDoc;
};

const getSectionNameSet = (classDoc) => {
  return new Set(
    (classDoc.sections || [])
      .map((section) => section?.name?.trim())
      .filter(Boolean)
  );
};

const ensureSectionsBelongToClass = (sections, classDoc, fieldLabel = 'sections') => {
  const validSections = getSectionNameSet(classDoc);
  const missingSections = sections.filter((section) => !validSections.has(section));

  if (missingSections.length > 0) {
    throw createAcademicError(
      `${fieldLabel} contain invalid section(s): ${missingSections.join(', ')}`
    );
  }
};

const ensureTeacherDocuments = async (teacherIds = []) => {
  if (teacherIds.length === 0) {
    return new Map();
  }

  const teachers = await Teacher.find({ _id: { $in: teacherIds } }).select('_id school subjects classes');

  if (teachers.length !== teacherIds.length) {
    throw createAcademicError('One or more teachers were not found', 404);
  }

  return new Map(teachers.map((teacher) => [toIdString(teacher._id), teacher]));
};

const ensureStudentDocuments = async (studentIds = []) => {
  if (studentIds.length === 0) {
    return new Map();
  }

  const students = await Student.find({ _id: { $in: studentIds } }).select('_id academic school');

  if (students.length !== studentIds.length) {
    throw createAcademicError('One or more students were not found', 404);
  }

  return new Map(students.map((student) => [toIdString(student._id), student]));
};

const normalizeSectionPayload = (section = {}, index = 0) => {
  if (!isPlainObject(section)) {
    throw createAcademicError(`sections[${index}] must be a valid object`);
  }

  const normalizedClassTeacher =
    section.classTeacher !== undefined && section.classTeacher !== null && section.classTeacher !== ''
      ? ensureObjectId(section.classTeacher, `sections[${index}].classTeacher`)
      : undefined;

  const normalizedSection = {
    name: normalizeTrimmedString(section.name, `sections[${index}].name`, { required: true }),
    capacity:
      section.capacity !== undefined ? Number(section.capacity) : 40,
    students: normalizeObjectIdArray(
      section.students,
      `sections[${index}].students`
    ),
    classTeacher: normalizedClassTeacher,
    room: normalizeTrimmedString(section.room, `sections[${index}].room`),
    isActive:
      normalizeBoolean(section.isActive) !== undefined
        ? normalizeBoolean(section.isActive)
        : true
  };

  if (Number.isNaN(normalizedSection.capacity) || normalizedSection.capacity <= 0) {
    throw createAcademicError(`sections[${index}].capacity must be greater than 0`);
  }

  if (section.Timetable || section.timetable) {
    normalizedSection.Timetable = ensureObjectId(
      section.Timetable || section.timetable,
      `sections[${index}].Timetable`
    );
  }

  return normalizedSection;
};

const normalizeSectionsPayload = (sections) => {
  if (sections === undefined) {
    return undefined;
  }

  if (!Array.isArray(sections)) {
    throw createAcademicError('sections must be an array');
  }

  return sections.map((section, index) => normalizeSectionPayload(section, index));
};

const collectTeacherIdsFromSections = (sections = []) => {
  return [
    ...new Set(
      sections.map((section) => section.classTeacher).filter(Boolean)
    )
  ];
};

const collectStudentIdsFromSections = (sections = []) => {
  return [...new Set(sections.flatMap((section) => section.students || []))];
};

const ensureStudentsAreNotInOtherClasses = async ({
  studentIds,
  classId,
  schoolId,
  sessionId
}) => {
  if (!studentIds.length) {
    return;
  }

  const conflictingClass = await Class.findOne({
    _id: { $ne: classId },
    school: schoolId,
    session: sessionId,
    'sections.students': { $in: studentIds }
  }).select('name sections');

  if (!conflictingClass) {
    return;
  }

  throw createAcademicError(
    `One or more students are already assigned to class ${conflictingClass.name} in this session`
  );
};

const getSectionAssignmentsByTeacher = (sections = []) => {
  const assignments = new Map();

  sections.forEach((section) => {
    if (!section.classTeacher) {
      return;
    }

    const normalizedTeacherId = toIdString(section.classTeacher);

    if (!assignments.has(normalizedTeacherId)) {
      assignments.set(normalizedTeacherId, new Set());
    }

    assignments.get(normalizedTeacherId).add(section.name);
  });

  return assignments;
};

const syncClassTeachers = async ({ classDoc, previousSections = [] }) => {
  const previousAssignments = getSectionAssignmentsByTeacher(previousSections);
  const nextAssignments = getSectionAssignmentsByTeacher(classDoc.sections);
  const teacherIds = [
    ...new Set([...previousAssignments.keys(), ...nextAssignments.keys()])
  ];

  if (teacherIds.length === 0) {
    return;
  }

  const teachers = await Teacher.find({ _id: { $in: teacherIds } });
  const teachersById = new Map(teachers.map((teacher) => [toIdString(teacher._id), teacher]));

  for (const teacherId of teacherIds) {
    const teacher = teachersById.get(teacherId);

    if (!teacher) {
      continue;
    }

    const nextSections = nextAssignments.get(teacherId) || new Set();
    let classAssignment = teacher.classes.find(
      (assignment) =>
        toIdString(assignment.classId) === toIdString(classDoc._id) &&
        toIdString(assignment.session) === toIdString(classDoc.session)
    );

    if (nextSections.size === 0) {
      if (!classAssignment) {
        continue;
      }

      if (Array.isArray(classAssignment.subjects) && classAssignment.subjects.length > 0) {
        classAssignment.sections = [];
      } else {
        teacher.classes = teacher.classes.filter(
          (assignment) =>
            !(
              toIdString(assignment.classId) === toIdString(classDoc._id) &&
              toIdString(assignment.session) === toIdString(classDoc.session)
            )
        );
      }
    } else if (!classAssignment) {
      teacher.classes.push({
        classId: classDoc._id,
        session: classDoc.session,
        sections: [...nextSections],
        subjects: []
      });
    } else {
      classAssignment.sections = [...nextSections];
    }

    if (!teacher.school) {
      teacher.school = classDoc.school;
    }

    await teacher.save();
  }
};

const syncStudentsForClass = async ({ classDoc, previousSections = [] }) => {
  const previousAssignments = new Map();
  const nextAssignments = new Map();

  previousSections.forEach((section) => {
    (section.students || []).forEach((studentId) => {
      previousAssignments.set(toIdString(studentId), section.name);
    });
  });

  (classDoc.sections || []).forEach((section) => {
    (section.students || []).forEach((studentId) => {
      nextAssignments.set(toIdString(studentId), section.name);
    });
  });

  const operations = [];

  previousAssignments.forEach((sectionName, studentId) => {
    if (nextAssignments.has(studentId)) {
      return;
    }

    operations.push({
      updateOne: {
        filter: {
          _id: studentId,
          'academic.currentClass': classDoc._id
        },
        update: {
          $set: {
            'academic.currentClass': null,
            'academic.currentSection': null
          }
        }
      }
    });
  });

  nextAssignments.forEach((sectionName, studentId) => {
    operations.push({
      updateOne: {
        filter: { _id: studentId },
        update: {
          $set: {
            school: classDoc.school,
            'academic.currentClass': classDoc._id,
            'academic.currentSection': sectionName,
            'academic.session': classDoc.session
          }
        }
      }
    });
  });

  if (operations.length > 0) {
    await Student.bulkWrite(operations);
  }
};

const getRemovedSectionNames = (previousSections = [], nextSections = []) => {
  const nextSectionNames = new Set(nextSections.map((section) => section.name));

  return previousSections
    .map((section) => section.name)
    .filter((sectionName) => !nextSectionNames.has(sectionName));
};

const ensureRemovedSectionsAreUnused = async ({ classId, removedSections }) => {
  if (!removedSections.length) {
    return;
  }

  const subjectUsingSection = await Subject.findOne({
    'classes.classId': classId,
    'classes.sections': { $in: removedSections }
  }).select('name code');

  if (subjectUsingSection) {
    throw createAcademicError(
      `Cannot remove sections that are still assigned in subject ${subjectUsingSection.name}`
    );
  }

  const timetableUsingSection = await Timetable.findOne({
    class: classId,
    section: { $in: removedSections },
    isActive: true
  }).select('section version');

  if (timetableUsingSection) {
    throw createAcademicError(
      `Cannot remove section ${timetableUsingSection.section} while an active timetable exists`
    );
  }
};

const normalizeSubjectClassConfig = (classConfig = {}, index = 0) => {
  if (!isPlainObject(classConfig)) {
    throw createAcademicError(`classes[${index}] must be a valid object`);
  }

  const maxMarks =
    classConfig.maxMarks !== undefined ? Number(classConfig.maxMarks) : 100;
  const passingMarks =
    classConfig.passingMarks !== undefined ? Number(classConfig.passingMarks) : 40;

  if (
    Number.isNaN(maxMarks) ||
    Number.isNaN(passingMarks) ||
    maxMarks <= 0 ||
    passingMarks < 0
  ) {
    throw createAcademicError(`classes[${index}] has invalid marks configuration`);
  }

  return {
    classId: ensureObjectId(classConfig.classId, `classes[${index}].classId`),
    sections: normalizeStringArray(classConfig.sections),
    teacher: classConfig.teacher
      ? ensureObjectId(classConfig.teacher, `classes[${index}].teacher`)
      : undefined,
    maxMarks,
    passingMarks
  };
};

const normalizeSubjectClassesPayload = (classes) => {
  if (classes === undefined) {
    return undefined;
  }

  if (!Array.isArray(classes)) {
    throw createAcademicError('classes must be an array');
  }

  return classes.map((classConfig, index) => normalizeSubjectClassConfig(classConfig, index));
};

const validateSubjectClasses = async ({ classes, schoolId, sessionId }) => {
  const classIds = [...new Set(classes.map((classConfig) => classConfig.classId))];
  const teacherIds = [
    ...new Set(classes.map((classConfig) => classConfig.teacher).filter(Boolean))
  ];

  const [classDocs, teacherMap] = await Promise.all([
    Class.find({ _id: { $in: classIds }, school: schoolId, session: sessionId }).select(
      '_id session school sections'
    ),
    ensureTeacherDocuments(teacherIds)
  ]);

  if (classDocs.length !== classIds.length) {
    throw createAcademicError(
      'Each subject class mapping must belong to the same branch and academic session'
    );
  }

  const classMap = new Map(classDocs.map((classDoc) => [toIdString(classDoc._id), classDoc]));

  classes.forEach((classConfig) => {
    const classDoc = classMap.get(classConfig.classId);

    if (!classDoc) {
      throw createAcademicError('One or more classes assigned to the subject were not found');
    }

    if (classConfig.sections.length > 0) {
      ensureSectionsBelongToClass(classConfig.sections, classDoc, 'classes.sections');
    }

    if (classConfig.teacher && !teacherMap.has(classConfig.teacher)) {
      throw createAcademicError('Assigned subject teacher was not found', 404);
    }
  });
};

const buildTeacherSubjectAssignments = (classes = [], sessionId, subjectId) => {
  const assignments = new Map();

  classes.forEach((classConfig) => {
    if (!classConfig.teacher) {
      return;
    }

    const teacherId = toIdString(classConfig.teacher);
    if (!assignments.has(teacherId)) {
      assignments.set(teacherId, []);
    }

    assignments.get(teacherId).push({
      classId: toIdString(classConfig.classId),
      session: toIdString(sessionId),
      sections: normalizeStringArray(classConfig.sections),
      subjectId: toIdString(subjectId)
    });
  });

  return assignments;
};

const syncTeachersForSubject = async ({ subject, previousClasses = [] }) => {
  const previousAssignments = buildTeacherSubjectAssignments(
    previousClasses,
    subject.session,
    subject._id
  );
  const nextAssignments = buildTeacherSubjectAssignments(
    subject.classes,
    subject.session,
    subject._id
  );

  const teacherIds = [
    ...new Set([...previousAssignments.keys(), ...nextAssignments.keys()])
  ];

  if (teacherIds.length === 0) {
    return;
  }

  const teachers = await Teacher.find({ _id: { $in: teacherIds } });

  for (const teacher of teachers) {
    const teacherId = toIdString(teacher._id);
    const subjectId = toIdString(subject._id);

    teacher.subjects = (teacher.subjects || []).filter(
      (assignedSubjectId) => toIdString(assignedSubjectId) !== subjectId
    );

    teacher.classes = (teacher.classes || [])
      .map((classAssignment) => {
        classAssignment.subjects = (classAssignment.subjects || []).filter(
          (assignedSubjectId) => toIdString(assignedSubjectId) !== subjectId
        );
        return classAssignment;
      })
      .filter(
        (classAssignment) =>
          (classAssignment.subjects && classAssignment.subjects.length > 0) ||
          (classAssignment.sections && classAssignment.sections.length > 0)
      );

    const newAssignments = nextAssignments.get(teacherId) || [];

    if (newAssignments.length > 0) {
      teacher.subjects = [...new Set([...(teacher.subjects || []), subject._id])];

      newAssignments.forEach((assignment) => {
        let classAssignment = teacher.classes.find(
          (item) =>
            toIdString(item.classId) === assignment.classId &&
            toIdString(item.session) === assignment.session
        );

        if (!classAssignment) {
          teacher.classes.push({
            classId: assignment.classId,
            session: assignment.session,
            sections: assignment.sections,
            subjects: [subject._id]
          });
          return;
        }

        classAssignment.sections = [
          ...new Set([...(classAssignment.sections || []), ...assignment.sections])
        ];
        classAssignment.subjects = [
          ...new Set([...(classAssignment.subjects || []), subject._id])
        ];
      });
    }

    if (!teacher.school) {
      teacher.school = subject.school;
    }

    await teacher.save();
  }
};

const populateSessionById = (sessionId) =>
  AcademicSession.findById(sessionId).populate('school', 'name code');

const populateClassById = (classId) =>
  Class.findById(classId)
    .populate('school', 'name code')
    .populate('session', 'name startDate endDate')
    .populate('sections.classTeacher', 'employeeId profile.firstName profile.lastName')
    .populate('sections.students', 'admissionNumber rollNumber profile.firstName profile.lastName')
    .populate('sections.Timetable', 'section version effectiveFrom effectiveTo isActive');

const populateSubjectById = (subjectId) =>
  Subject.findById(subjectId)
    .populate('school', 'name code')
    .populate('session', 'name startDate endDate')
    .populate('classes.classId', 'name level')
    .populate('classes.teacher', 'employeeId profile.firstName profile.lastName');

const populateGradingSystemById = (gradingSystemId) =>
  GradingSystem.findById(gradingSystemId)
    .populate('school', 'name code')
    .populate('session', 'name startDate endDate');

// ========== Academic Sessions ==========

export const getSessions = async (req, res) => {
  try {
    const query = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      query.school = schoolId;
    }

    const sessions = await AcademicSession.find(query)
      .populate('school', 'name code')
      .sort({ startDate: -1 });

    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const createSession = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    await ensureSchoolExists(schoolId);

    const session = await AcademicSession.create({
      ...req.body,
      school: schoolId
    });

    const populatedSession = await populateSessionById(session._id);

    res.status(201).json({
      success: true,
      message: 'Academic session created successfully',
      data: populatedSession
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const updateSession = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const session = await AcademicSession.findOne({
      _id: req.params.id,
      ...scope
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.isLocked) {
      return res.status(400).json({ success: false, message: 'Cannot update a locked session' });
    }

    if (req.body.school && toIdString(req.body.school) !== toIdString(session.school)) {
      throw createAcademicError('Session branch cannot be changed');
    }

    session.set({
      ...req.body,
      school: session.school
    });
    await session.save();

    const populatedSession = await populateSessionById(session._id);

    res.status(200).json({
      success: true,
      message: 'Session updated successfully',
      data: populatedSession
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const setActiveSession = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const session = await AcademicSession.findOne({
      _id: req.params.id,
      ...scope
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.isLocked) {
      return res.status(400).json({ success: false, message: 'Cannot activate a locked session' });
    }

    session.isActive = true;
    await session.save();

    const populatedSession = await populateSessionById(session._id);

    res.status(200).json({
      success: true,
      message: 'Active session set successfully',
      data: populatedSession
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

// ========== Classes ==========

export const getClasses = async (req, res) => {
  try {
    const query = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      query.school = schoolId;
    }

    if (req.query.session) {
      query.session = ensureObjectId(req.query.session, 'session');
    }

    const classes = await Class.find(query)
      .populate('school', 'name code')
      .populate('session', 'name')
      .populate('sections.classTeacher', 'employeeId profile.firstName profile.lastName')
      .sort({ level: 1, name: 1 });

    res.status(200).json({ success: true, data: classes });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const getClass = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const classData = await Class.findOne({
      _id: req.params.id,
      ...scope
    })
      .populate('school', 'name code')
      .populate('session', 'name')
      .populate('sections.classTeacher', 'employeeId profile')
      .populate('sections.students', 'admissionNumber rollNumber profile.firstName profile.lastName')
      .populate('sections.Timetable', 'section version isActive effectiveFrom effectiveTo');

    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    res.status(200).json({ success: true, data: classData });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const createClass = async (req, res) => {
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    // Auto-resolve active session if not provided
    let sessionId = req.body.session;
    if (!sessionId) {
      const activeSession = await AcademicSession.findOne({ school: schoolId, isActive: true });
      if (!activeSession) {
        return res.status(400).json({
          success: false,
          message: 'No active academic session found. Please create one first.'
        });
      }
      sessionId = activeSession._id;
    }
    
    const session = await ensureSessionExists(sessionId, schoolId);
    const sections = normalizeSectionsPayload(req.body.sections) || [];
    
    // Check for duplicate class+section combinations in the same session
    if (sections.length > 0) {
      const sectionNames = sections.map(s => s.name?.trim().toLowerCase());
      const existingClasses = await Class.findOne({
        school: schoolId,
        session: session._id,
        name: req.body.name?.trim(),
        'sections.name': { $in: sectionNames }
      });
      
      if (existingClasses) {
        const duplicateSections = existingClasses.sections
          .filter(s => sectionNames.includes(s.name?.trim().toLowerCase()))
          .map(s => s.name);
        return res.status(400).json({
          success: false,
          message: `Class "${req.body.name}" already exists with section(s): ${duplicateSections.join(', ')}`
        });
      }
    }
    
    const teacherIds = collectTeacherIdsFromSections(sections);
    const studentIds = collectStudentIdsFromSections(sections);

    await Promise.all([
      ensureSchoolExists(schoolId),
      ensureTeacherDocuments(teacherIds),
      ensureStudentDocuments(studentIds),
      ensureStudentsAreNotInOtherClasses({
        studentIds,
        classId: null,
        schoolId,
        sessionId: toIdString(session._id)
      })
    ]);

    const classData = await Class.create({
      ...req.body,
      school: schoolId,
      session: session._id,
      sections
    });

    await Promise.all([
      syncStudentsForClass({ classDoc: classData, previousSections: [] }),
      syncClassTeachers({ classDoc: classData, previousSections: [] })
    ]);

    const populatedClass = await populateClassById(classData._id);

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: populatedClass
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const updateClass = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const classData = await Class.findOne({
      _id: req.params.id,
      ...scope
    });

    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const previousSections = JSON.parse(JSON.stringify(classData.sections || []));
    const session = req.body.session
      ? await ensureSessionExists(req.body.session, toIdString(classData.school))
      : await ensureSessionExists(classData.session, toIdString(classData.school));

    const sections =
      normalizeSectionsPayload(req.body.sections) || JSON.parse(JSON.stringify(classData.sections || []));
    const removedSections = getRemovedSectionNames(previousSections, sections);

    await ensureRemovedSectionsAreUnused({
      classId: classData._id,
      removedSections
    });

    const teacherIds = collectTeacherIdsFromSections(sections);
    const studentIds = collectStudentIdsFromSections(sections);

    await Promise.all([
      ensureTeacherDocuments(teacherIds),
      ensureStudentDocuments(studentIds),
      ensureStudentsAreNotInOtherClasses({
        studentIds,
        classId: classData._id,
        schoolId: toIdString(classData.school),
        sessionId: toIdString(session._id)
      })
    ]);

    classData.set({
      ...req.body,
      school: classData.school,
      session: session._id,
      sections
    });
    await classData.save();

    await Promise.all([
      syncStudentsForClass({ classDoc: classData, previousSections }),
      syncClassTeachers({ classDoc: classData, previousSections })
    ]);

    const populatedClass = await populateClassById(classData._id);

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: populatedClass
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

// ========== Subjects ==========

export const getSubjects = async (req, res) => {
  try {
    const query = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      query.school = schoolId;
    }

    if (req.query.session) query.session = ensureObjectId(req.query.session, 'session');
    if (req.query.classId) query['classes.classId'] = ensureObjectId(req.query.classId, 'classId');

    const subjects = await Subject.find(query)
      .populate('school', 'name code')
      .populate('session', 'name')
      .populate('classes.classId', 'name level')
      .populate('classes.teacher', 'employeeId profile.firstName profile.lastName')
      .sort({ name: 1 });

    res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const createSubject = async (req, res) => {  
  try {
    const schoolId = resolveRequiredSchoolId(req, req.body.school);
    // Auto-resolve active session if not provided
    let session = req.body.session;
    if (!session) {
      const activeSession = await AcademicSession.findOne({ school: schoolId, isActive: true });
      if (!activeSession) {
        return res.status(400).json({
          success: false,
          message: 'No active academic session found. Please create one first.'
        });
      }
      session = activeSession._id;
    }
    
    const sessionDoc = await ensureSessionExists(session, schoolId);
    const classes = normalizeSubjectClassesPayload(req.body.classes) || [];

    await Promise.all([
      ensureSchoolExists(schoolId),
      validateSubjectClasses({
        classes,
        schoolId,
        sessionId: toIdString(sessionDoc._id)
      })
    ]);

    const subject = await Subject.create({
      ...req.body,
      school: schoolId,
      session: sessionDoc._id,
      classes
    });

    await syncTeachersForSubject({ subject, previousClasses: [] });

    const populatedSubject = await populateSubjectById(subject._id);

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: populatedSubject
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const updateSubject = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const subject = await Subject.findOne({
      _id: req.params.id,
      ...scope
    });

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const previousClasses = JSON.parse(JSON.stringify(subject.classes || []));
    const session = req.body.session
      ? await ensureSessionExists(req.body.session, toIdString(subject.school))
      : await ensureSessionExists(subject.session, toIdString(subject.school));
    const classes =
      normalizeSubjectClassesPayload(req.body.classes) ||
      JSON.parse(JSON.stringify(subject.classes || []));

    await validateSubjectClasses({
      classes,
      schoolId: toIdString(subject.school),
      sessionId: toIdString(session._id)
    });

    subject.set({
      ...req.body,
      school: subject.school,
      session: session._id,
      classes
    });
    await subject.save();

    await syncTeachersForSubject({ subject, previousClasses });

    const populatedSubject = await populateSubjectById(subject._id);

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: populatedSubject
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const subject = await Subject.findOne({
      _id: req.params.id,
      ...scope
    });

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const previousClasses = subject.classes || [];

    await Subject.findByIdAndDelete(subject._id);

    await syncTeachersForSubject({ 
      subject: { ...subject.toObject(), classes: [] }, 
      previousClasses 
    });

    res.status(200).json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

// ========== Grading Systems ==========

export const getGradingSystems = async (req, res) => {
  try {
    const query = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      query.school = schoolId;
    }

    if (req.query.session) {
      query.session = ensureObjectId(req.query.session, 'session');
    }

    const systems = await GradingSystem.find(query)
      .populate('school', 'name code')
      .populate('session', 'name')
      .sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({ success: true, data: systems });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const createGradingSystem = async (req, res) => {
  try {
    const session = await ensureSessionExists(
      req.body.session,
      resolveScopedSchoolId(req, req.body.school)
    );
    const schoolId = resolveRequiredSchoolId(req, req.body.school || session.school);
    await ensureSchoolExists(schoolId);

    const system = await GradingSystem.create({
      ...req.body,
      school: schoolId,
      session: session._id
    });

    const populatedSystem = await populateGradingSystemById(system._id);

    res.status(201).json({
      success: true,
      message: 'Grading system created successfully',
      data: populatedSystem
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const updateGradingSystem = async (req, res) => {
  try {
    const scope = {};
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);

    if (schoolId) {
      scope.school = schoolId;
    }

    const system = await GradingSystem.findOne({
      _id: req.params.id,
      ...scope
    });

    if (!system) {
      return res.status(404).json({ success: false, message: 'Grading system not found' });
    }

    const session = req.body.session
      ? await ensureSessionExists(req.body.session, toIdString(system.school))
      : await ensureSessionExists(system.session, toIdString(system.school));

    system.set({
      ...req.body,
      school: system.school,
      session: session._id
    });
    await system.save();

    const populatedSystem = await populateGradingSystemById(system._id);

    res.status(200).json({
      success: true,
      message: 'Grading system updated successfully',
      data: populatedSystem
    });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

// ========== Timetables ==========

export const getTimetables = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.query.school);
    const query = {};
    if (schoolId) query.school = schoolId;
    if (req.query.session) query.session = ensureObjectId(req.query.session, 'session');
    if (req.query.classId) query.class = ensureObjectId(req.query.classId, 'classId');

    const timetables = await Timetable.find(query).sort({ label: 1 });
    res.status(200).json({ success: true, data: timetables });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const getTimetable = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.query.school);
    const query = { _id: ensureObjectId(req.params.id, 'id') };
    if (schoolId) query.school = schoolId;

    const timetable = await Timetable.findOne(query);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }
    res.status(200).json({ success: true, data: timetable });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const createTimetable = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.body.school);
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School is required' });
    }
    if (!req.body.label) {
      return res.status(400).json({ success: false, message: 'Label is required' });
    }

    const timetable = await Timetable.create({
      school: schoolId,
      session: req.body.session || null,
      class: req.body.class || null,
      label: req.body.label,
      days: req.body.days || [],
      isActive: true,
    });

    res.status(201).json({ success: true, message: 'Timetable created successfully', data: timetable });
  } catch (error) {
    handleAcademicError(res, error);
  }
};

export const updateTimetable = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);
    const query = { _id: ensureObjectId(req.params.id, 'id') };
    if (schoolId) query.school = schoolId;

    const timetable = await Timetable.findOne(query);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    if (req.body.label !== undefined) timetable.label = req.body.label;
    if (req.body.days !== undefined) timetable.days = req.body.days;
    if (req.body.isActive !== undefined) timetable.isActive = req.body.isActive;

    await timetable.save();
    res.status(200).json({ success: true, message: 'Timetable updated successfully', data: timetable });
  } catch (error) {
    handleAcademicError(res, error);
  }
};
