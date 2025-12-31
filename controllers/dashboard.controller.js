import Student from '../models/Student.model.js';
import Teacher from '../models/Teacher.model.js';
import Class from '../models/Class.model.js';
import Attendance from '../models/Attendance.model.js';
import FeePayment from '../models/FeePayment.model.js';
import Exam from '../models/Exam.model.js';
import AcademicSession from '../models/AcademicSession.model.js';

export const getDashboardStats = async (req, res) => {
  try {
    // Get active session
    const activeSession = await AcademicSession.findOne({ isActive: true });

    // Student stats
    const totalStudents = await Student.countDocuments({ status: 'active' });
    const newAdmissions = await Student.countDocuments({
      status: 'active',
      'academic.admissionDate': {
        $gte: new Date(new Date().setDate(new Date().getDate() - 30))
      }
    });
    
    // Teacher stats
    const totalTeachers = await Teacher.countDocuments({ status: 'active' });

    // Class stats
    const totalClasses = await Class.countDocuments({ 
      isActive: true,
      session: activeSession?._id
    });

    // Attendance stats (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAttendance = await Attendance.aggregate([
      {
        $match: {
          date: today,
          session: activeSession?._id
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0
    };

    todayAttendance.forEach(item => {
      attendanceStats[item._id] = item.count;
    });

    // Fee stats
    const feeStats = await FeePayment.aggregate([
      {
        $match: {
          session: activeSession?._id
        }
      },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const feeCollection = {
      paid: 0,
      pending: 0,
      partial: 0
    };

    feeStats.forEach(item => {
      if (item._id === 'paid') {
        feeCollection.paid = item.totalAmount;
      }
    });

    // Recent exams
    const upcomingExams = await Exam.find({
      session: activeSession?._id,
      startDate: { $gte: new Date() }
    })
    .limit(5)
    .sort({ startDate: 1 })
    .populate('classes', 'name level');

    res.status(200).json({
      success: true,
      data: {
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
        attendance: {
          today: attendanceStats,
          date: today
        },
        fees: {
          collection: feeCollection
        },
        upcomingExams,
        activeSession
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAttendanceChart = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const activeSession = await AcademicSession.findOne({ isActive: true });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const attendanceData = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate },
          session: activeSession?._id
        }
      },
      {
        $group: {
          _id: {
            date: '$date',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: attendanceData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getFeeChart = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const activeSession = await AcademicSession.findOne({ isActive: true });

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const feeData = await FeePayment.aggregate([
      {
        $match: {
          paidDate: { $gte: startDate },
          session: activeSession?._id,
          status: { $in: ['paid', 'partial'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          totalCollected: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: feeData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

