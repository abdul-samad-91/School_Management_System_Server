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
    if (!req.files || !req.files.photo || req.files.photo.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo is required'
      });
    }

    if (!req.files.documents || req.files.documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one document (degree/CV/etc) is required'
      });
    }

    const parseJson = (value) => {
      if (!value) return undefined;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return undefined;
        }
      }
      return value;
    };

    const profile = parseJson(req.body.profile) || {};
    const employment = parseJson(req.body.employment) || {};
    const qualifications = parseJson(req.body.qualifications) || [];
    const experience = parseJson(req.body.experience) || [];
    const subjects = parseJson(req.body.subjects) || [];
    const classes = parseJson(req.body.classes) || [];
    const salary = parseJson(req.body.salary) || {};

    // Support flat fields too
    const fields = ['firstName', 'lastName', 'middleName', 'dateOfBirth', 'gender', 'bloodGroup', 'email', 'phone', 'alternatePhone'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field];
      }
    });

    const employmentFields = ['designation', 'department', 'type', 'joiningDate', 'contractType', 'contractEndDate'];
    employmentFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employment[field] = req.body[field];
      }
    });

    const requiredProfile = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'email', 'phone'];
    const missingProfileFields = requiredProfile.filter((key) => !profile[key]);
    if (missingProfileFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required profile fields: ${missingProfileFields.join(', ')}`
      });
    }

    const requiredEmployment = ['designation', 'joiningDate'];
    const missingEmployment = requiredEmployment.filter((key) => !employment[key]);
    if (missingEmployment.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required employment fields: ${missingEmployment.join(', ')}`
      });
    }

    profile.photo = req.files.photo[0].path;

    const documentEntries = req.files.documents.map((file) => ({
      name: file.originalname,
      type: file.mimetype,
      url: file.path,
      uploadDate: new Date()
    }));

    const teacherPayload = {
      employeeId: req.body.employeeId || generateEmployeeId(new Date().getFullYear()),
      profile,
      employment,
      qualifications,
      experience,
      subjects,
      classes,
      salary,
      documents: documentEntries,
      userId: req.body.userId || undefined,
      status: req.body.status || 'active'
    };

    const teacher = await Teacher.create(teacherPayload);

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: teacher
    });
  } catch (error) {
    console.error('createTeacher error', error);
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

