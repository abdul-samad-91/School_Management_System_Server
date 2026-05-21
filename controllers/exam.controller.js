import mongoose from 'mongoose';
import Exam from '../models/Exam.model.js';
import Result from '../models/Result.model.js';

const handleError = (res, error) => {
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  res.status(statusCode).json({ success: false, message: error.message });
};

const resolveSchoolId = (req, explicit) => {
  if (explicit && mongoose.Types.ObjectId.isValid(explicit)) return explicit;
  return req.user?.school ? req.user.school.toString() : null;
};

export const getExams = async (req, res) => {
  try {
    const { school, session, classId, type, search, page = 1, limit = 20 } = req.query;
    const query = {};
    const schoolId = resolveSchoolId(req, school);
    if (schoolId) query.school = schoolId;
    if (session) query.session = session;
    if (classId) query.class = classId;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const currentPage = Number(page) || 1;
    const perPage = Number(limit) || 20;

    const exams = await Exam.find(query)
      .populate('class', 'name level')
      .populate('session', 'name')
      .populate('createdBy', 'username')
      .limit(perPage)
      .skip((currentPage - 1) * perPage)
      .sort({ date: -1 });

    const count = await Exam.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / perPage),
      currentPage,
      data: exams
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('class', 'name level')
      .populate('session', 'name')
      .populate('createdBy', 'username');

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    res.status(200).json({ success: true, data: exam });
  } catch (error) {
    handleError(res, error);
  }
};

export const createExam = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, req.body.school);
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School context is required' });
    }

    const examData = {
      school: schoolId,
      subject: req.body.subject,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      duration: req.body.duration,
      room: req.body.room,
      maxMarks: req.body.maxMarks || 100,
      passingMarks: req.body.passingMarks || 35,
      class: req.body.class || undefined,
      session: req.body.session || undefined,
      type: req.body.type || 'class_test',
      name: req.body.name || req.body.subject,
      gradingSystem: req.body.gradingSystem || undefined,
      createdBy: req.user._id
    };

    const exam = await Exam.create(examData);
    const populated = await Exam.findById(exam._id)
      .populate('class', 'name level')
      .populate('session', 'name');

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: populated
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const allowed = ['subject', 'date', 'startTime', 'endTime', 'duration', 'room', 'maxMarks', 'passingMarks', 'class', 'type', 'name', 'session'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        exam[field] = req.body[field];
      }
    });

    await exam.save();

    const populated = await Exam.findById(exam._id)
      .populate('class', 'name level')
      .populate('session', 'name');

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: populated
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const publishExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    exam.isPublished = true;
    exam.publishedAt = new Date();
    exam.publishedBy = req.user._id;
    await exam.save();

    res.status(200).json({ success: true, message: 'Exam published', data: exam });
  } catch (error) {
    handleError(res, error);
  }
};

export const startExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    exam.isStarted = true;
    exam.startedAt = new Date();
    exam.startedBy = req.user._id;
    await exam.save();

    res.status(200).json({ success: true, message: 'Exam started', data: exam });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    res.status(200).json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// Results
export const getResults = async (req, res) => {
  try {
    const { school, examId, studentId, classId, session, page = 1, limit = 20 } = req.query;
    const query = {};
    const schoolId = resolveSchoolId(req, school);
    if (schoolId) query.school = schoolId;
    if (examId) query.exam = examId;
    if (studentId) query.student = studentId;
    if (classId) query.class = classId;
    if (session) query.session = session;

    const currentPage = Number(page) || 1;
    const perPage = Number(limit) || 20;

    const results = await Result.find(query)
      .populate('student', 'admissionNumber rollNumber profile.firstName profile.lastName')
      .populate('exam', 'subject date maxMarks passingMarks name type')
      .populate('class', 'name level')
      .populate('session', 'name')
      .limit(perPage)
      .skip((currentPage - 1) * perPage)
      .sort({ createdAt: -1 });

    const count = await Result.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / perPage),
      currentPage,
      data: results
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const createResult = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, req.body.school);
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'School context is required' });
    }

    const resultData = {
      school: schoolId,
      student: req.body.student,
      exam: req.body.exam,
      class: req.body.class,
      section: req.body.section,
      session: req.body.session,
      subjects: req.body.subjects || [],
      attendance: req.body.attendance,
      remarks: req.body.remarks,
      enteredBy: req.user._id
    };

    const result = await Result.create(resultData);

    res.status(201).json({
      success: true,
      message: 'Result created successfully',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateResult = async (req, res) => {
  try {
    // Only allow safe fields to be updated
    const allowedFields = ['subjects', 'totalMarks', 'marksObtained', 'percentage', 'grade', 'rank', 'remarks'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const result = await Result.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Result updated successfully',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const publishResults = async (req, res) => {
  try {
    const { resultIds } = req.body;
    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return res.status(400).json({ success: false, message: 'resultIds array is required' });
    }

    await Result.updateMany(
      { _id: { $in: resultIds } },
      { $set: { isPublished: true } }
    );

    res.status(200).json({ success: true, message: 'Results published successfully' });
  } catch (error) {
    handleError(res, error);
  }
};
