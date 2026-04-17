import mongoose from 'mongoose';
import Attendance from '../models/Attendance.model.js';
import Student from '../models/Student.model.js';
import Subject from '../models/Subject.model.js';
import Teacher from '../models/Teacher.model.js';
import Class from '../models/Class.model.js';

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'leave', 'half_day'];

const createAttendanceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAttendanceErrorStatus = (error) => {
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

const handleAttendanceError = (res, error) => {
  res.status(getAttendanceErrorStatus(error)).json({
    success: false,
    message: error.message
  });
};

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
    throw createAttendanceError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createAttendanceError(`${fieldName} must be a valid id`);
  }

  return toIdString(value);
};

const normalizeTrimmedString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createAttendanceError(`${fieldName} is required`);
    }

    return undefined;
  }

  return String(value).trim();
};

const normalizeAttendanceDate = (value, fieldName = 'date') => {
  if (!value) {
    throw createAttendanceError(`${fieldName} is required`);
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return new Date(`${trimmedValue}T00:00:00.000Z`);
    }

    const parsedDate = new Date(trimmedValue);

    if (Number.isNaN(parsedDate.getTime())) {
      throw createAttendanceError(`${fieldName} must be a valid date`);
    }

    parsedDate.setUTCHours(0, 0, 0, 0);
    return parsedDate;
  }

  const parsedDate = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw createAttendanceError(`${fieldName} must be a valid date`);
  }

  parsedDate.setUTCHours(0, 0, 0, 0);
  return parsedDate;
};

const buildDayRange = (value, fieldName = 'date') => {
  const start = normalizeAttendanceDate(value, fieldName);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
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
      throw createAttendanceError(
        'You can only access attendance records for your assigned branch',
        403
      );
    }

    return userSchoolId;
  }

  return requestedSchoolId || userSchoolId || null;
};

const ensureTeacherForUser = async (req, schoolId) => {
  if (req.user?.role !== 'teacher') {
    return null;
  }

  const teacher = await Teacher.findOne({
    userId: req.user._id,
    school: schoolId,
    status: 'active'
  }).select('_id school userId status');

  if (!teacher) {
    throw createAttendanceError('Teacher profile not found for the logged in user', 403);
  }

  return teacher;
};

const populateAttendanceQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate(
      'student',
      'admissionNumber rollNumber profile.firstName profile.lastName profile.photo'
    )
    .populate('class', 'name level')
    .populate('subject', 'name code type')
    .populate('teacher', 'employeeId profile.firstName profile.lastName')
    .populate('markedBy', 'username email role profile.firstName profile.lastName')
    .populate('session', 'name startDate endDate');

const ensureArrayPayload = (value, fieldName) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw createAttendanceError(`${fieldName} must be a non-empty array`);
  }

  return value;
};

const normalizeAttendanceRecords = (attendanceRecords) => {
  const records = ensureArrayPayload(attendanceRecords, 'attendanceRecords').map(
    (record, index) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw createAttendanceError(`attendanceRecords[${index}] must be a valid object`);
      }

      const studentId = ensureObjectId(
        record.student || record.studentId,
        `attendanceRecords[${index}].student`
      );
      const status = normalizeTrimmedString(record.status, `attendanceRecords[${index}].status`, {
        required: true
      }).toLowerCase();

      if (!ATTENDANCE_STATUSES.includes(status)) {
        throw createAttendanceError(
          `attendanceRecords[${index}].status must be one of ${ATTENDANCE_STATUSES.join(', ')}`
        );
      }

      return {
        student: studentId,
        status,
        remarks:
          record.remarks === undefined || record.remarks === null
            ? undefined
            : String(record.remarks).trim()
      };
    }
  );

  const uniqueStudentIds = new Set(records.map((record) => record.student));
  if (uniqueStudentIds.size !== records.length) {
    throw createAttendanceError('attendanceRecords cannot contain duplicate students');
  }

  return records;
};

const ensureSectionBelongsToClass = (classDoc, section) => {
  const validSections = new Set(
    (classDoc.sections || [])
      .map((sectionDoc) => sectionDoc?.name?.trim())
      .filter(Boolean)
  );

  if (!validSections.has(section)) {
    throw createAttendanceError(`Section '${section}' does not belong to the selected class`);
  }
};

const findSubjectAssignment = (subject, classId, section) =>
  (subject.classes || []).find((classConfig) => {
    const matchesClass = toIdString(classConfig.classId) === classId;
    const assignedSections = Array.isArray(classConfig.sections)
      ? classConfig.sections.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const matchesSection =
      assignedSections.length === 0 || assignedSections.includes(section);

    return matchesClass && matchesSection;
  });

export const markAttendance = async (req, res) => {
  try {
    const sessionId = ensureObjectId(req.body.session, 'session');
    const classId = ensureObjectId(req.body.classId, 'classId');
    const subjectId = ensureObjectId(req.body.subject || req.body.subjectId, 'subject');
    const section = normalizeTrimmedString(req.body.section, 'section', { required: true });
    const attendanceDate = normalizeAttendanceDate(req.body.date);
    const normalizedRecords = normalizeAttendanceRecords(req.body.attendanceRecords);
    const scopedSchoolId = resolveScopedSchoolId(req, req.body.school);

    const subjectQuery = {
      _id: subjectId,
      session: sessionId
    };

    if (scopedSchoolId) {
      subjectQuery.school = scopedSchoolId;
    }

    const subject = await Subject.findOne(subjectQuery).select(
      '_id school session classes name code'
    );

    if (!subject) {
      throw createAttendanceError('Subject not found for the selected branch and session', 404);
    }

    const schoolId = toIdString(subject.school);

    if (scopedSchoolId && scopedSchoolId !== schoolId) {
      throw createAttendanceError('Subject does not belong to the selected branch', 403);
    }

    const classAssignment = findSubjectAssignment(subject, classId, section);

    if (!classAssignment) {
      throw createAttendanceError(
        'This subject is not assigned to the selected class and section'
      );
    }

    const assignedTeacherId = toIdString(classAssignment.teacher);

    if (!assignedTeacherId) {
      throw createAttendanceError(
        'No subject teacher is assigned to this class-section for the selected subject'
      );
    }

    const [classDoc, assignedTeacher, loggedInTeacher] = await Promise.all([
      Class.findOne({
        _id: classId,
        school: schoolId,
        session: sessionId
      }).select('_id school session sections name level'),
      Teacher.findOne({
        _id: assignedTeacherId,
        school: schoolId
      }).select('_id school userId status'),
      ensureTeacherForUser(req, schoolId)
    ]);

    if (!classDoc) {
      throw createAttendanceError('Class not found for the selected branch and session', 404);
    }

    ensureSectionBelongsToClass(classDoc, section);

    if (!assignedTeacher) {
      throw createAttendanceError('Assigned subject teacher was not found', 404);
    }

    if (assignedTeacher.status !== 'active') {
      throw createAttendanceError('Assigned subject teacher is inactive');
    }

    if (loggedInTeacher && toIdString(loggedInTeacher._id) !== assignedTeacherId) {
      throw createAttendanceError(
        'You can only mark attendance for subjects assigned to you',
        403
      );
    }

    const studentIds = normalizedRecords.map((record) => record.student);

    const students = await Student.find({
      _id: { $in: studentIds },
      school: schoolId,
      'academic.currentClass': classId,
      'academic.currentSection': section,
      'academic.session': sessionId
    }).select('_id admissionNumber rollNumber');

    if (students.length !== studentIds.length) {
      throw createAttendanceError(
        'One or more students do not belong to the selected branch, class, section, or session'
      );
    }

    const attendanceDayRange = buildDayRange(attendanceDate);

    const existingAttendance = await Attendance.find({
      school: schoolId,
      subject: subjectId,
      date: {
        $gte: attendanceDayRange.start,
        $lt: attendanceDayRange.end
      },
      student: { $in: studentIds }
    }).select('student');

    if (existingAttendance.length > 0) {
      throw createAttendanceError(
        'Attendance has already been marked for one or more selected students on this date'
      );
    }

    const recordsToInsert = normalizedRecords.map((record) => ({
      school: schoolId,
      student: record.student,
      class: classId,
      section,
      subject: subjectId,
      teacher: assignedTeacherId,
      date: attendanceDate,
      status: record.status,
      remarks: record.remarks,
      markedBy: req.user._id,
      session: sessionId
    }));

    const result = await Attendance.insertMany(recordsToInsert, { ordered: true });
    const createdAttendance = await populateAttendanceQuery(
      Attendance.find({ _id: { $in: result.map((attendance) => attendance._id) } }).sort({
        createdAt: 1
      })
    );

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: createdAttendance
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attendance has already been marked for one or more selected students'
      });
    }

    handleAttendanceError(res, error);
  }
};

export const getAttendance = async (req, res) => {
  try {
    const query = {};
    const schoolId = resolveScopedSchoolId(req, req.query.school);

    if (schoolId) {
      query.school = schoolId;
    }

    if (req.query.classId) query.class = ensureObjectId(req.query.classId, 'classId');
    if (req.query.section) {
      query.section = normalizeTrimmedString(req.query.section, 'section', { required: true });
    }
    if (req.query.studentId) query.student = ensureObjectId(req.query.studentId, 'studentId');
    if (req.query.subjectId) query.subject = ensureObjectId(req.query.subjectId, 'subjectId');
    if (req.query.teacherId) query.teacher = ensureObjectId(req.query.teacherId, 'teacherId');
    if (req.query.session) query.session = ensureObjectId(req.query.session, 'session');

    if (req.query.date) {
      const { start, end } = buildDayRange(req.query.date);
      query.date = {
        $gte: start,
        $lt: end
      };
    } else if (req.query.startDate || req.query.endDate) {
      if (!req.query.startDate || !req.query.endDate) {
        throw createAttendanceError('Both startDate and endDate are required for range filters');
      }

      const { start } = buildDayRange(req.query.startDate, 'startDate');
      const { end } = buildDayRange(req.query.endDate, 'endDate');
      query.date = {
        $gte: start,
        $lt: end
      };
    }

    const attendance = await populateAttendanceQuery(
      Attendance.find(query).sort({ date: -1, createdAt: -1 })
    );

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    handleAttendanceError(res, error);
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const updateData = {};
    const schoolId = resolveScopedSchoolId(req, req.body.school || req.query.school);

    if (req.body.status !== undefined) {
      const status = normalizeTrimmedString(req.body.status, 'status', {
        required: true
      }).toLowerCase();

      if (!ATTENDANCE_STATUSES.includes(status)) {
        throw createAttendanceError(
          `status must be one of ${ATTENDANCE_STATUSES.join(', ')}`
        );
      }

      updateData.status = status;
    }

    if (req.body.remarks !== undefined) {
      updateData.remarks =
        req.body.remarks === null ? null : String(req.body.remarks).trim();
    }

    if (Object.keys(updateData).length === 0) {
      throw createAttendanceError('Provide at least one field to update');
    }

    const attendance = await Attendance.findOne({
      _id: req.params.id,
      ...(schoolId ? { school: schoolId } : {})
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    if (
      updateData.status &&
      updateData.status !== attendance.status
    ) {
      attendance.corrections.push({
        previousStatus: attendance.status,
        newStatus: updateData.status,
        reason: req.body.reason ? String(req.body.reason).trim() : undefined,
        correctedBy: req.user._id
      });
      attendance.status = updateData.status;
    }

    if (req.body.remarks !== undefined) {
      attendance.remarks = updateData.remarks;
    }

    await attendance.save();

    const populatedAttendance = await populateAttendanceQuery(
      Attendance.findById(attendance._id)
    );

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: populatedAttendance
    });
  } catch (error) {
    handleAttendanceError(res, error);
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    if (!req.query.startDate || !req.query.endDate) {
      throw createAttendanceError('startDate and endDate are required');
    }

    const schoolId = resolveScopedSchoolId(req, req.query.school);
    const { start } = buildDayRange(req.query.startDate, 'startDate');
    const { end } = buildDayRange(req.query.endDate, 'endDate');

    const matchStage = {
      date: {
        $gte: start,
        $lt: end
      }
    };

    if (schoolId) matchStage.school = new mongoose.Types.ObjectId(schoolId);
    if (req.query.studentId) {
      matchStage.student = new mongoose.Types.ObjectId(
        ensureObjectId(req.query.studentId, 'studentId')
      );
    }
    if (req.query.classId) {
      matchStage.class = new mongoose.Types.ObjectId(
        ensureObjectId(req.query.classId, 'classId')
      );
    }
    if (req.query.subjectId) {
      matchStage.subject = new mongoose.Types.ObjectId(
        ensureObjectId(req.query.subjectId, 'subjectId')
      );
    }
    if (req.query.teacherId) {
      matchStage.teacher = new mongoose.Types.ObjectId(
        ensureObjectId(req.query.teacherId, 'teacherId')
      );
    }
    if (req.query.session) {
      matchStage.session = new mongoose.Types.ObjectId(
        ensureObjectId(req.query.session, 'session')
      );
    }
    if (req.query.section) {
      matchStage.section = normalizeTrimmedString(req.query.section, 'section', { required: true });
    }

    const report = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$student',
          totalDays: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          leave: {
            $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] }
          },
          halfDay: {
            $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          percentage: {
            $cond: [
              { $gt: ['$totalDays', 0] },
              {
                $multiply: [{ $divide: ['$present', '$totalDays'] }, 100]
              },
              0
            ]
          }
        }
      },
      {
        $sort: {
          percentage: -1
        }
      }
    ]);

    await Student.populate(report, {
      path: '_id',
      select: 'admissionNumber rollNumber profile.firstName profile.lastName profile.photo'
    });

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    handleAttendanceError(res, error);
  }
};
