import Teacher from '../models/Teacher.model.js';
import { generateEmployeeId } from '../utils/generateNumber.js';

export const getTeachers = async (req, res) => {
  try {
    const { 
      status, 
      type, 
      search,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (type) query['employment.type'] = type;
    
    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'profile.email': { $regex: search, $options: 'i' } }
      ];
    }

    const teachers = await Teacher.find(query)
      .populate('subjects', 'name code')
      .populate('userId', 'username email role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Teacher.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: teachers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('subjects', 'name code type')
      .populate('classes.classId', 'name level sections')
      .populate('classes.subjects', 'name code')
      .populate('classes.session', 'name')
      .populate('userId', 'username email role');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createTeacher = async (req, res) => {
  try {
    // Generate employee ID if not provided
    if (!req.body.employeeId) {
      const year = new Date().getFullYear();
      req.body.employeeId = generateEmployeeId(year);
    }

    const teacher = await Teacher.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: teacher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      data: teacher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Teacher deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const assignSubjects = async (req, res) => {
  try {
    const { subjectIds } = req.body;
    
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: { subjects: subjectIds } },
      { new: true }
    ).populate('subjects', 'name code');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subjects assigned successfully',
      data: teacher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const assignClasses = async (req, res) => {
  try {
    const { classes } = req.body;
    
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { $set: { classes } },
      { new: true }
    ).populate('classes.classId classes.subjects');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Classes assigned successfully',
      data: teacher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

