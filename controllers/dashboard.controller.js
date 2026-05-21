import mongoose from 'mongoose';
import Student from '../models/Student.model.js';
import Teacher from '../models/Teacher.model.js';
import Class from '../models/Class.model.js';
import Attendance from '../models/Attendance.model.js';
import FeePayment from '../models/FeePayment.model.js';
import Exam from '../models/Exam.model.js';
import AcademicSession from '../models/AcademicSession.model.js';
import Announcement from '../models/Announcement.model.js';
import User from '../models/User.model.js';

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'leave', 'half_day'];

const createDashboardError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getDashboardErrorStatus = (error) => {
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

const handleDashboardError = (res, error) => {
  res.status(getDashboardErrorStatus(error)).json({
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
    throw createDashboardError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createDashboardError(`${fieldName} must be a valid id`);
  }

  return toIdString(value);
};

const normalizePositiveInteger = (value, fieldName, { min = 1, max = 365 } = {}) => {
  const normalizedValue = Number.parseInt(value, 10);

  if (Number.isNaN(normalizedValue)) {
    throw createDashboardError(`${fieldName} must be a valid integer`);
  }

  if (normalizedValue < min || normalizedValue > max) {
    throw createDashboardError(`${fieldName} must be between ${min} and ${max}`);
  }

  return normalizedValue;
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
      throw createDashboardError(
        'You can only access dashboard data for your assigned branch',
        403
      );
    }

    return userSchoolId;
  }

  return requestedSchoolId || userSchoolId || null;
};

const buildDayRange = (value = new Date()) => {
  const start = value instanceof Date ? new Date(value) : new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const formatDayKey = (date) => new Date(date).toISOString().slice(0, 10);

const formatMonthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

const resolveDashboardSession = async (req, schoolId) => {
  if (req.query.session) {
    const sessionQuery = {
      _id: ensureObjectId(req.query.session, 'session')
    };

    if (schoolId) {
      sessionQuery.school = schoolId;
    }

    const explicitSession = await AcademicSession.findOne(sessionQuery).select(
      '_id school name startDate endDate isActive'
    );

    if (!explicitSession) {
      throw createDashboardError('Academic session not found', 404);
    }

    return explicitSession;
  }

  const activeSessionQuery = { isActive: true };

  if (schoolId) {
    activeSessionQuery.school = schoolId;
  }

  return AcademicSession.findOne(activeSessionQuery)
    .sort({ createdAt: -1 })
    .select('_id school name startDate endDate isActive');
};

const buildScopedQuery = (schoolId, extra = {}) => ({
  ...(schoolId ? { school: schoolId } : {}),
  ...extra
});

export const getDashboardStats = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.query.school);
    const activeSession = await resolveDashboardSession(req, schoolId);
    const sessionId = toIdString(activeSession?._id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const studentBaseQuery = buildScopedQuery(schoolId);
    const teacherBaseQuery = buildScopedQuery(schoolId);
    const classBaseQuery = buildScopedQuery(schoolId, {
      ...(sessionId ? { session: sessionId } : {})
    });
    const userBaseQuery = buildScopedQuery(schoolId);

    const totalStudents = await Student.countDocuments({
      ...studentBaseQuery,
      status: 'active'
    });
    const newAdmissions = await Student.countDocuments({
      ...studentBaseQuery,
      'academic.admissionDate': { $gte: thirtyDaysAgo }
    });
    const totalTeachers = await Teacher.countDocuments({
      ...teacherBaseQuery,
      status: 'active'
    });
    const totalClasses = await Class.countDocuments({
      ...classBaseQuery,
      isActive: true
    });
    const activeUsers = await User.countDocuments({
      ...userBaseQuery,
      isActive: true
    });

    const todayRange = buildDayRange(new Date());
    const attendanceMatch = {
      ...buildScopedQuery(schoolId),
      ...(sessionId ? { session: activeSession._id } : {}),
      date: {
        $gte: todayRange.start,
        $lt: todayRange.end
      }
    };

    const attendanceAggregate = await Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const attendanceStats = ATTENDANCE_STATUSES.reduce(
      (stats, status) => ({ ...stats, [status]: 0 }),
      {}
    );

    attendanceAggregate.forEach((item) => {
      attendanceStats[item._id] = item.count;
    });

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const feeCollectionAggregate = await FeePayment.aggregate([
      {
        $match: {
          ...buildScopedQuery(schoolId),
          ...(sessionId ? { session: activeSession._id } : {}),
          status: { $in: ['Paid', 'Partial'] }
        }
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$paidAmount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const monthlyCollectionAggregate = await FeePayment.aggregate([
      {
        $match: {
          ...buildScopedQuery(schoolId),
          paidDate: { $gte: currentMonthStart },
          status: { $in: ['Paid', 'Partial'] }
        }
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$paidAmount' }
        }
      }
    ]);

    const upcomingExams = await Exam.find({
      ...buildScopedQuery(schoolId),
      ...(sessionId ? { session: activeSession._id } : {}),
      date: { $gte: new Date() }
    })
      .sort({ date: 1 })
      .limit(5)
      .populate('class', 'name level')
      .populate('session', 'name');

    const recentPayments = await FeePayment.find({
      ...buildScopedQuery(schoolId),
      status: { $in: ['Paid', 'Partial'] }
    })
      .sort({ paidDate: -1, createdAt: -1 })
      .limit(5)
      .populate('student', 'admissionNumber rollNumber profile.firstName profile.lastName')
      .populate('feeStructure', 'feeType amount className')
      .populate('collectedBy', 'username profile.firstName profile.lastName');

    const recentAnnouncements = await Announcement.find({
      ...buildScopedQuery(schoolId),
      isPublished: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: new Date() } }
      ]
    })
      .sort({ publishDate: -1, createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'username profile.firstName profile.lastName');

    const activeAnnouncementCount = await Announcement.countDocuments({
      ...buildScopedQuery(schoolId),
      isPublished: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: new Date() } }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        activeSession,
        students: {
          total: totalStudents,
          newAdmissions
        },
        teachers: {
          total: totalTeachers
        },
        classes: {
          total: totalClasses
        },
        users: {
          active: activeUsers
        },
        attendance: {
          today: attendanceStats,
          totalRecords: Object.values(attendanceStats).reduce((sum, value) => sum + value, 0),
          date: todayRange.start
        },
        fees: {
          totalCollected: feeCollectionAggregate[0]?.totalCollected || 0,
          transactionCount: feeCollectionAggregate[0]?.transactionCount || 0,
          currentMonthCollected: monthlyCollectionAggregate[0]?.totalCollected || 0
        },
        communication: {
          activeAnnouncements: activeAnnouncementCount,
          recentAnnouncements
        },
        upcomingExams,
        recentPayments
      }
    });
  } catch (error) {
    handleDashboardError(res, error);
  }
};

export const getAttendanceChart = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.query.school);
    const activeSession = await resolveDashboardSession(req, schoolId);
    const days = req.query.days !== undefined
      ? normalizePositiveInteger(req.query.days, 'days', { min: 1, max: 90 })
      : 7;

    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date();
    rangeEnd.setHours(23, 59, 59, 999);

    const attendanceData = await Attendance.aggregate([
      {
        $match: {
          ...buildScopedQuery(schoolId),
          ...(activeSession?._id ? { session: activeSession._id } : {}),
          date: {
            $gte: rangeStart,
            $lte: rangeEnd
          }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date'
              }
            },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const attendanceMap = new Map();
    attendanceData.forEach((item) => {
      const key = item._id.date;
      if (!attendanceMap.has(key)) {
        attendanceMap.set(
          key,
          ATTENDANCE_STATUSES.reduce(
            (stats, status) => ({ ...stats, [status]: 0 }),
            {}
          )
        );
      }

      attendanceMap.get(key)[item._id.status] = item.count;
    });

    const chart = [];
    for (let index = 0; index < days; index += 1) {
      const currentDate = new Date(rangeStart);
      currentDate.setDate(rangeStart.getDate() + index);
      const key = formatDayKey(currentDate);
      chart.push({
        date: key,
        ...(attendanceMap.get(key) ||
          ATTENDANCE_STATUSES.reduce(
            (stats, status) => ({ ...stats, [status]: 0 }),
            {}
          ))
      });
    }

    res.status(200).json({
      success: true,
      data: chart
    });
  } catch (error) {
    handleDashboardError(res, error);
  }
};

export const getFeeChart = async (req, res) => {
  try {
    const schoolId = resolveScopedSchoolId(req, req.query.school);
    const activeSession = await resolveDashboardSession(req, schoolId);
    const months = req.query.months !== undefined
      ? normalizePositiveInteger(req.query.months, 'months', { min: 1, max: 24 })
      : 6;

    const rangeStart = new Date();
    rangeStart.setDate(1);
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setMonth(rangeStart.getMonth() - (months - 1));

    const feeData = await FeePayment.aggregate([
      {
        $match: {
          ...buildScopedQuery(schoolId),
          ...(activeSession?._id ? { session: activeSession._id } : {}),
          paidDate: { $gte: rangeStart },
          status: { $in: ['Paid', 'Partial'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          totalCollected: { $sum: '$paidAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const feeMap = new Map();
    feeData.forEach((item) => {
      feeMap.set(
        formatMonthKey(item._id.year, item._id.month),
        {
          totalCollected: item.totalCollected,
          count: item.count
        }
      );
    });

    const chart = [];
    for (let index = 0; index < months; index += 1) {
      const currentMonth = new Date(rangeStart);
      currentMonth.setMonth(rangeStart.getMonth() + index);
      const key = formatMonthKey(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1
      );
      const currentValue = feeMap.get(key) || { totalCollected: 0, count: 0 };

      chart.push({
        month: key,
        totalCollected: currentValue.totalCollected,
        count: currentValue.count
      });
    }

    res.status(200).json({
      success: true,
      data: chart
    });
  } catch (error) {
    handleDashboardError(res, error);
  }
};
