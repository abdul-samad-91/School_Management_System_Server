import Exam from '../models/Exam.model.js';
import Result from '../models/Result.model.js';

// ========== Exams ==========

export const getExams = async (req, res) => {
  try {
    const { session, classId } = req.query;
    const query = {};
    
    if (session) query.session = session;
    if (classId) query.classes = classId;

    const exams = await Exam.find(query)
      .populate('session', 'name')
      .populate('classes', 'name level')
      .populate('gradingSystem', 'name type')
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      data: exams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('session', 'name startDate endDate')
      .populate('classes', 'name level sections')
      .populate('schedule.subject', 'name code')
      .populate('schedule.class', 'name level')
      .populate('schedule.invigilator', 'profile.firstName profile.lastName')
      .populate('gradingSystem');

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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createExam = async (req, res) => {
  try {
    const exam = await Exam.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const publishExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { isPublished: true },
      { new: true }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Exam published successfully',
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========== Results ==========

export const getResults = async (req, res) => {
  try {
    const { examId, studentId, classId, section } = req.query;
    const query = {};

    if (examId) query.exam = examId;
    if (studentId) query.student = studentId;
    if (classId) query.class = classId;
    if (section) query.section = section;

    const results = await Result.find(query)
      .populate('student', 'admissionNumber rollNumber profile')
      .populate('exam', 'name type')
      .populate('class', 'name level')
      .populate('subjects.subject', 'name code')
      .sort({ rank: 1 });

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createResult = async (req, res) => {
  try {
    const result = await Result.create({
      ...req.body,
      enteredBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Result created successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateResult = async (req, res) => {
  try {
    const result = await Result.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Result updated successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const publishResults = async (req, res) => {
  try {
    const { examId, classId, section } = req.body;

    const query = { exam: examId };
    if (classId) query.class = classId;
    if (section) query.section = section;

    const result = await Result.updateMany(
      query,
      { isPublished: true }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} results published successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

