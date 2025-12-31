import AcademicSession from '../models/AcademicSession.model.js';
import Class from '../models/Class.model.js';
import Subject from '../models/Subject.model.js';
import GradingSystem from '../models/GradingSystem.model.js';
import Timetable from '../models/Timetable.model.js';

// ========== Academic Sessions ==========

export const getSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.find().sort({ startDate: -1 });
    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSession = async (req, res) => {
  try {
    const session = await AcademicSession.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Academic session created successfully',
      data: session 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSession = async (req, res) => {
  try {
    const session = await AcademicSession.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Session updated successfully',
      data: session 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setActiveSession = async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    session.isActive = true;
    await session.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Active session set successfully',
      data: session 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== Classes ==========

export const getClasses = async (req, res) => {
  try {
    const { session } = req.query;
    const query = session ? { session } : {};
    
    const classes = await Class.find(query)
      .populate('session', 'name')
      .populate('sections.classTeacher', 'profile.firstName profile.lastName')
      .sort({ level: 1 });
      
    res.status(200).json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getClass = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('session', 'name')
      .populate('sections.classTeacher', 'profile employeeId');
      
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    
    res.status(200).json({ success: true, data: classData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createClass = async (req, res) => {
  try {
    const classData = await Class.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Class created successfully',
      data: classData 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateClass = async (req, res) => {
  try {
    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Class updated successfully',
      data: classData 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== Subjects ==========

export const getSubjects = async (req, res) => {
  try {
    const { session, classId } = req.query;
    const query = {};
    
    if (session) query.session = session;
    if (classId) query['classes.classId'] = classId;
    
    const subjects = await Subject.find(query)
      .populate('session', 'name')
      .populate('classes.classId', 'name level')
      .populate('classes.teacher', 'profile.firstName profile.lastName');
      
    res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Subject created successfully',
      data: subject 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Subject updated successfully',
      data: subject 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== Grading Systems ==========

export const getGradingSystems = async (req, res) => {
  try {
    const systems = await GradingSystem.find().populate('session', 'name');
    res.status(200).json({ success: true, data: systems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createGradingSystem = async (req, res) => {
  try {
    const system = await GradingSystem.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Grading system created successfully',
      data: system 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== Timetables ==========

export const getTimetables = async (req, res) => {
  try {
    const { classId, section, session } = req.query;
    const query = {};
    
    if (classId) query.class = classId;
    if (section) query.section = section;
    if (session) query.session = session;
    
    const timetables = await Timetable.find(query)
      .populate('class', 'name level')
      .populate('session', 'name')
      .populate('schedule.periods.subject', 'name code')
      .populate('schedule.periods.teacher', 'profile.firstName profile.lastName');
      
    res.status(200).json({ success: true, data: timetables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.create(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Timetable created successfully',
      data: timetable 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Timetable updated successfully',
      data: timetable 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

