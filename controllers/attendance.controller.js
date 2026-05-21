import mongoose from 'mongoose';
import Attendance from '../models/Attendance.model.js';
import Student from '../models/Student.model.js';
import Teacher from '../models/Teacher.model.js';
import Class from '../models/Class.model.js';
import AcademicSession from '../models/AcademicSession.model.js';

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'leave', 'half_day', 'holiday'];

const createAttendanceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const handleAttendanceError = (res, error) => {
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  res.status(statusCode).json({
    success: false,
    message: error.message
  });
};

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
};

const getUserSchoolId = (req) => (req.user?.school ? toIdString(req.user.school) : null);

const resolveSchoolId = (req, explicitSchoolId) => {
  const userSchoolId = getUserSchoolId(req);
  if (explicitSchoolId && mongoose.Types.ObjectId.isValid(explicitSchoolId)) {
    return explicitSchoolId;
  }
  return userSchoolId;
};

const resolveActiveSession = async (schoolId) => {
  const session = await AcademicSession.findOne({
    school: schoolId,
    isActive: true
  }).select('_id');
  return session ? toIdString(session._id) : null;
};

const normalizeAttendanceDate = (value) => {
  if (!value) throw createAttendanceError('date is required');
  const trimmed = typeof value === 'string' ? value.trim() : value;
  let parsed;
  if (typeof trimmed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    parsed = new Date(`${trimmed}T00:00:00.000Z`);
  } else {
    parsed = new Date(trimmed);
  }
  if (Number.isNaN(parsed.getTime())) {
    throw createAttendanceError('date must be a valid date');
  }
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

const buildDayRange = (value) => {
  const start = normalizeAttendanceDate(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const populateAttendanceQuery = (query) =>
  query
    .populate('school', 'name code')
    .populate('student', 'admissionNumber rollNumber profile.firstName profile.lastName profile.photo academic.currentClass academic.currentSection')
    .populate('teacher', 'employeeId profile.firstName profile.lastName profile.photo')
    .populate('class', 'name level')
    .populate('subject', 'name code')
    .populate('markedBy', 'username email role profile.firstName profile.lastName')
    .populate('session', 'name startDate endDate');

export const markAttendance = async (req, res) => {
  try {
    const { classId, date, type = 'student', records, attendanceRecords, school, session } = req.body;

    const attendanceDate = normalizeAttendanceDate(date);
    const schoolId = resolveSchoolId(req, school);

    if (!schoolId) {
      throw createAttendanceError('School context is required');
    }

    const sessionId = session || await resolveActiveSession(schoolId);

    const rawRecords = records || attendanceRecords;
    if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
      throw createAttendanceError('records must be a non-empty array');
    }

    const dayRange = buildDayRange(date);

    if (type === 'teacher') {
      const recordsToInsert = rawRecords.map(record => {
        const teacherId = record.teacherId || record.teacher;
        if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
          throw createAttendanceError('Each record must have a valid teacherId');
        }
        const status = (record.status || 'present').toLowerCase();
        if (!ATTENDANCE_STATUSES.includes(status)) {
          throw createAttendanceError(`Invalid status: ${status}`);
        }
        return {
          school: schoolId,
          type: 'teacher',
          teacher: teacherId,
          date: attendanceDate,
          status,
          remarks: record.note || record.remarks || undefined,
          markedBy: req.user._id,
          session: sessionId || undefined
        };
      });

      for (const record of recordsToInsert) {
        await Attendance.findOneAndUpdate(
          {
            school: schoolId,
            type: 'teacher',
            teacher: record.teacher,
            date: record.date
          },
          { $set: record },
          { upsert: true, new: true }
        );
      }

      return res.status(201).json({
        success: true,
        message: 'Teacher attendance marked successfully'
      });
    }

    // Student attendance
    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      throw createAttendanceError('classId is required for student attendance');
    }

    const classDoc = await Class.findById(classId).select('_id name school');
    if (!classDoc) {
      throw createAttendanceError('Class not found', 404);
    }

    const recordsToInsert = rawRecords.map(record => {
      const studentId = record.studentId || record.student;
      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        throw createAttendanceError('Each record must have a valid studentId');
      }
      const status = (record.status || 'present').toLowerCase();
      if (!ATTENDANCE_STATUSES.includes(status)) {
        throw createAttendanceError(`Invalid status: ${status}`);
      }
      return {
        school: schoolId,
        type: 'student',
        student: studentId,
        class: classId,
        date: attendanceDate,
        status,
        remarks: record.note || record.remarks || undefined,
        markedBy: req.user._id,
        session: sessionId || undefined
      };
    });

    for (const record of recordsToInsert) {
      await Attendance.findOneAndUpdate(
        {
          school: schoolId,
          type: 'student',
          student: record.student,
          date: record.date
        },
        { $set: record },
        { upsert: true, new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key on upsert — treat as a successful update (idempotent)
      return res.status(200).json({
        success: true,
        message: 'Attendance records saved'
      });
    }
    handleAttendanceError(res, error);
  }
};

export const getAttendance = async (req, res) => {
  try {
    const query = {};
    const schoolId = resolveSchoolId(req, req.query.school);

    if (schoolId) query.school = schoolId;
    if (req.query.type) query.type = req.query.type;
    if (req.query.classId) query.class = req.query.classId;
    if (req.query.section) query.section = req.query.section;
    if (req.query.studentId) query.student = req.query.studentId;
    if (req.query.teacherId) query.teacher = req.query.teacherId;
    if (req.query.subjectId) query.subject = req.query.subjectId;
    if (req.query.session) query.session = req.query.session;

    if (req.query.date) {
      const { start, end } = buildDayRange(req.query.date);
      query.date = { $gte: start, $lt: end };
    } else if (req.query.startDate && req.query.endDate) {
      const { start } = buildDayRange(req.query.startDate);
      const { end } = buildDayRange(req.query.endDate);
      query.date = { $gte: start, $lt: end };
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
    const schoolId = resolveSchoolId(req, req.body.school || req.query.school);

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

    if (req.body.status !== undefined) {
      const status = req.body.status.toLowerCase();
      if (!ATTENDANCE_STATUSES.includes(status)) {
        throw createAttendanceError(`status must be one of ${ATTENDANCE_STATUSES.join(', ')}`);
      }
      if (status !== attendance.status) {
        attendance.corrections.push({
          previousStatus: attendance.status,
          newStatus: status,
          reason: req.body.reason || undefined,
          correctedBy: req.user._id
        });
        attendance.status = status;
      }
    }

    if (req.body.remarks !== undefined) {
      attendance.remarks = req.body.remarks;
    }

    await attendance.save();

    const populated = await populateAttendanceQuery(Attendance.findById(attendance._id));

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: populated
    });
  } catch (error) {
    handleAttendanceError(res, error);
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, req.query.school);
    const { classId, date, startDate, endDate, type = 'student' } = req.query;

    let dateFilter;
    if (date) {
      const refDate = new Date(date);
      const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
      dateFilter = { $gte: start, $lt: end };
    } else if (startDate && endDate) {
      const { start } = buildDayRange(startDate);
      const { end } = buildDayRange(endDate);
      dateFilter = { $gte: start, $lt: end };
    } else {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      dateFilter = { $gte: start, $lt: end };
    }

    const matchStage = { date: dateFilter, type };
    if (schoolId) matchStage.school = new mongoose.Types.ObjectId(schoolId);
    if (classId) matchStage.class = new mongoose.Types.ObjectId(classId);

    if (type === 'student') {
      const report = await Attendance.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$student',
            class: { $first: '$class' },
            section: { $first: '$section' },
            totalDays: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            lateCount: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
            leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
            holidayCount: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
            dailyRecords: { $push: { date: '$date', status: '$status' } }
          }
        },
        {
          $addFields: {
            presentPercent: {
              $cond: [{ $gt: ['$totalDays', 0] }, { $multiply: [{ $divide: ['$presentCount', '$totalDays'] }, 100] }, 0]
            },
            absentPercent: {
              $cond: [{ $gt: ['$totalDays', 0] }, { $multiply: [{ $divide: ['$absentCount', '$totalDays'] }, 100] }, 0]
            }
          }
        },
        { $sort: { presentPercent: -1 } }
      ]);

      await Student.populate(report, {
        path: '_id',
        select: 'admissionNumber rollNumber profile.firstName profile.lastName profile.photo'
      });

      await Class.populate(report, {
        path: 'class',
        select: 'name level'
      });

      const data = report.map(r => ({
        student: r._id,
        class: r.class,
        section: r.section,
        totalDays: r.totalDays,
        presentCount: r.presentCount,
        absentCount: r.absentCount,
        lateCount: r.lateCount,
        leaveCount: r.leaveCount,
        holidayCount: r.holidayCount,
        presentPercent: Math.round(r.presentPercent * 100) / 100,
        absentPercent: Math.round(r.absentPercent * 100) / 100,
        dailyRecords: r.dailyRecords.sort((a, b) => new Date(a.date) - new Date(b.date))
      }));

      return res.status(200).json({ success: true, data });
    }

    // Teacher report
    const report = await Attendance.aggregate([
      { $match: { ...matchStage, type: 'teacher' } },
      {
        $group: {
          _id: '$teacher',
          totalDays: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          lateCount: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
        }
      }
    ]);

    await Teacher.populate(report, {
      path: '_id',
      select: 'employeeId profile.firstName profile.lastName profile.photo'
    });

    const data = report.map(r => ({
      teacher: r._id,
      totalDays: r.totalDays,
      presentCount: r.presentCount,
      absentCount: r.absentCount,
      lateCount: r.lateCount,
      leaveCount: r.leaveCount
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    handleAttendanceError(res, error);
  }
};
