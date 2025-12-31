import Student from '../models/Student.model.js';
import { generateAdmissionNumber } from '../utils/generateNumber.js';

// @desc    Get all students
// @route   GET /api/students
// @access  Private
export const getStudents = async (req, res) => {
  try {
    const { 
      status, 
      class: classId, 
      section, 
      session,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (classId) query['academic.currentClass'] = classId;
    if (section) query['academic.currentSection'] = section;
    if (session) query['academic.session'] = session;
    
    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .populate('academic.currentClass', 'name level')
      .populate('academic.session', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Student.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
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

// @desc    Create new student
// @route   POST /api/students
// @access  Private
export const createStudent = async (req, res) => {
  try {
    // Generate admission number if not provided
    if (!req.body.admissionNumber) {
      const year = new Date().getFullYear();
      req.body.admissionNumber = generateAdmissionNumber(year);
    }

    const student = await Student.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
export const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private
export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

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

// @desc    Update student status
// @route   PUT /api/students/:id/status
// @access  Private
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

// @desc    Approve student admission
// @route   PUT /api/students/:id/approve
// @access  Private
export const approveAdmission = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
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

// @desc    Promote students
// @route   POST /api/students/promote
// @access  Private
export const promoteStudents = async (req, res) => {
  try {
    const { studentIds, toClass, toSection, toSession } = req.body;

    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
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

