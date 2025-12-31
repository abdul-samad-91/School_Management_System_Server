import Attendance from '../models/Attendance.model.js';
import Student from '../models/Student.model.js';

export const markAttendance = async (req, res) => {
  try {
    const { attendanceRecords, classId, section, date, session } = req.body;

    const records = attendanceRecords.map(record => ({
      ...record,
      class: classId,
      section,
      date,
      session,
      markedBy: req.user._id
    }));

    const result = await Attendance.insertMany(records, { ordered: false });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: result
    });
  } catch (error) {
    // Handle duplicate key errors (if attendance already marked)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for some students on this date'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { classId, section, date, studentId, startDate, endDate } = req.query;

    const query = {};
    
    if (classId) query.class = classId;
    if (section) query.section = section;
    if (studentId) query.student = studentId;
    
    if (date) {
      query.date = new Date(date);
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'admissionNumber rollNumber profile')
      .populate('class', 'name level')
      .populate('markedBy', 'profile.firstName profile.lastName')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { status, remarks } = req.body;

    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Add to corrections history
    attendance.corrections.push({
      previousStatus: attendance.status,
      newStatus: status,
      reason: req.body.reason,
      correctedBy: req.user._id
    });

    attendance.status = status;
    if (remarks) attendance.remarks = remarks;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const { studentId, classId, section, startDate, endDate } = req.query;

    const matchStage = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (studentId) matchStage.student = studentId;
    if (classId) matchStage.class = classId;
    if (section) matchStage.section = section;

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
          }
        }
      },
      {
        $addFields: {
          percentage: {
            $multiply: [
              { $divide: ['$present', '$totalDays'] },
              100
            ]
          }
        }
      }
    ]);

    // Populate student details
    await Student.populate(report, {
      path: '_id',
      select: 'admissionNumber rollNumber profile'
    });

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

