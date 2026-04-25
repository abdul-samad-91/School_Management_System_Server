import Teacher from '../models/Teacher.model.js';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isMissingRequiredValue = (value) => {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  return false;
};

const isValidDateInput = (value) => {
  if (isMissingRequiredValue(value)) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
};

const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(`Invalid ${fieldName} JSON`);
    error.statusCode = 400;
    throw error;
  }
};

const mergeDefined = (target = {}, source = {}) => {
  const merged = isPlainObject(target) ? { ...target } : {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (isPlainObject(value)) {
      merged[key] = mergeDefined(merged[key], value);
      return;
    }

    merged[key] = value;
  });

  return merged;
};

const toPlainObject = (value) => {
  if (value && typeof value.toObject === 'function') {
    return value.toObject();
  }
  return value;
};

const normalizeDateValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).trim();
  }

  return date.toISOString();
};

const normalizeExperienceEntry = (entry = {}) => ({
  institution: entry.institution ? String(entry.institution).trim() : '',
  designation: entry.designation ? String(entry.designation).trim() : '',
  from: normalizeDateValue(entry.from),
  to: normalizeDateValue(entry.to),
  responsibilities: entry.responsibilities ? String(entry.responsibilities).trim() : ''
});



//controller functions for teacher routes

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

    if (profile.email !== undefined) {
      profile.email = String(profile.email).trim().toLowerCase();
    }

    const emailExists = profile.email
      ? await Teacher.findOne({ 'profile.email': profile.email })
      : null;

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const employmentFields = ['designation', 'department', 'type', 'joiningDate', 'contractType', 'contractEndDate'];
    employmentFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employment[field] = req.body[field];
      } 
    });

    const requiredProfile = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'email', 'phone'];
    const missingProfileFields = requiredProfile.filter((key) => isMissingRequiredValue(profile[key]));
    if (missingProfileFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required profile fields: ${missingProfileFields.join(', ')}`
      });
    }

    const requiredEmployment = ['designation', 'joiningDate'];
    const missingEmployment = requiredEmployment.filter((key) => isMissingRequiredValue(employment[key]));
    if (missingEmployment.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required employment fields: ${missingEmployment.join(', ')}`
      });
    }

    if (!isValidDateInput(employment.joiningDate)) {
      return res.status(400).json({
        success: false,
        message: 'joiningDate must be a valid date'
      });
    }

    const photoFile = req.files.photo[0];
    profile.photo = photoFile.path || photoFile.secure_url || photoFile.url;

    const employeeId = req.teacherUploadEmployeeId || undefined;

    const documentEntries = req.files.documents.map((file) => ({
      name: file.originalname,
      type: file.mimetype,
      publicId: file.filename || file.public_id,
      url: file.path || file.secure_url || file.url,
      uploadDate: new Date()
    }));

    const statusValue = typeof req.body.status === 'string' ? req.body.status.trim() : req.body.status;

    // res.status(201).json(documentEntries)

    const teacherPayload = {
      employeeId,
      profile,
      employment,
      qualifications, 
      experience,
      subjects,
      classes,
      subjectName: req.body.subjectName || undefined,
      classLabel: req.body.classLabel || undefined,
      salary,
      documents: documentEntries,
      userId: req.body.userId || undefined,
      status: statusValue || 'active'
    };

    const teacher = new Teacher(teacherPayload);
    await teacher.save();

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
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({
        success: false, 
        message: 'Teacher not found'
      });
    }

    const profileInput = parseJsonField(req.body.profile, 'profile');
    const employmentInput = parseJsonField(req.body.employment, 'employment');
    const salaryInput = parseJsonField(req.body.salary, 'salary');
    const qualificationsInput = parseJsonField(req.body.qualifications, 'qualifications');
    const subjectsInput = parseJsonField(req.body.subjects, 'subjects');
    const classesInput = parseJsonField(req.body.classes, 'classes');
    const experienceInput = parseJsonField(req.body.experience, 'experience');
    const newExperienceInput = parseJsonField(req.body.newExperience, 'newExperience');

    if (profileInput !== undefined && !isPlainObject(profileInput)) {
      return res.status(400).json({
        success: false,
        message: 'profile must be a valid object' 
      });  
    }

    if (employmentInput !== undefined && !isPlainObject(employmentInput)) {
      return res.status(400).json({
        success: false, 
        message: 'employment must be a valid object' 
      });  
    }

    if (salaryInput !== undefined && !isPlainObject(salaryInput)) {
      return res.status(400).json({
        success: false,
        message: 'salary must be a valid object'
      });
    }

    if (qualificationsInput !== undefined && !Array.isArray(qualificationsInput)) {
      return res.status(400).json({
        success: false,
        message: 'qualifications must be an array'
      });
    }

    if (subjectsInput !== undefined && !Array.isArray(subjectsInput)) {
      return res.status(400).json({
        success: false,
        message: 'subjects must be an array'
      });
    }

    if (classesInput !== undefined && !Array.isArray(classesInput)) {
      return res.status(400).json({
        success: false,
        message: 'classes must be an array'
      }); 
    }

    if (experienceInput !== undefined && !Array.isArray(experienceInput)) {
      return res.status(400).json({ 
        success: false, 
        message: 'experience must be an array'
      }); 
    }

    if (newExperienceInput !== undefined && !Array.isArray(newExperienceInput)) {
      return res.status(400).json({
        success: false,
        message: 'newExperience must be an array'
      });
    }

    const hasJoiningDateUpdate =
      req.body.joiningDate !== undefined ||
      req.body['employment.joiningDate'] !== undefined ||
      req.body['employment[joiningDate]'] !== undefined ||
      (isPlainObject(req.body.employment) && req.body.employment.joiningDate !== undefined) ||
      (employmentInput && Object.prototype.hasOwnProperty.call(employmentInput, 'joiningDate'));

    if (hasJoiningDateUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Joining date cannot be updated once the teacher is created'
      });
    }

    const updateData = {};
    const pushData = {};

    const profileUpdates = profileInput ? { ...profileInput } : {};
    const profileFields = [
      'firstName',
      'lastName',
      'middleName',
      'dateOfBirth',
      'gender',
      'bloodGroup',
      'email',
      'phone',
      'alternatePhone'
    ];

    profileFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = req.body[field];
      }
    });

    if (req.files?.photo?.[0]?.path) {
      profileUpdates.photo = req.files.photo[0].path;
    }

    if (Object.keys(profileUpdates).length > 0) {
      updateData.profile = mergeDefined(toPlainObject(teacher.profile), profileUpdates);
    }

    const employmentUpdates = employmentInput ? { ...employmentInput } : {};
    const employmentFields = ['designation', 'department', 'type', 'contractType', 'contractEndDate'];

    employmentFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employmentUpdates[field] = req.body[field];
      }
    });

    if (Object.keys(employmentUpdates).length > 0) {
      updateData.employment = mergeDefined(toPlainObject(teacher.employment), employmentUpdates);
    }

    if (salaryInput !== undefined) {
      updateData.salary = mergeDefined(toPlainObject(teacher.salary), salaryInput);
    }

    if (qualificationsInput !== undefined) {
      updateData.qualifications = qualificationsInput;
    }

    if (subjectsInput !== undefined) {
      updateData.subjects = subjectsInput;
    }

    if (classesInput !== undefined) {
      updateData.classes = classesInput;
    }

    if (!teacher.employeeId && req.teacherUploadEmployeeId) {
      updateData.employeeId = req.teacherUploadEmployeeId;
    }

    if (req.body.userId !== undefined) {
      updateData.userId = req.body.userId;
    }

    if (req.body.status !== undefined) {
      updateData.status = typeof req.body.status === 'string' ? req.body.status.trim() : req.body.status;
    }

    const existingExperience = teacher.experience.map((entry) => normalizeExperienceEntry(toPlainObject(entry)));
    const experienceToAppend = [];

    if (experienceInput) {
      if (experienceInput.length < existingExperience.length) {
        return res.status(400).json({
          success: false,
          message: 'Existing experience entries cannot be removed or edited. Append new entries only.'
        });
      }

      for (let index = 0; index < existingExperience.length; index += 1) {
        const incomingEntry = normalizeExperienceEntry(experienceInput[index]);
        const currentEntry = existingExperience[index];

        if (JSON.stringify(incomingEntry) !== JSON.stringify(currentEntry)) {
          return res.status(400).json({
            success: false,
            message: 'Existing experience entries cannot be updated. Append new entries only.'
          });
        }
      }

      experienceToAppend.push(...experienceInput.slice(existingExperience.length));
    }

    if (newExperienceInput && newExperienceInput.length > 0) {
      experienceToAppend.push(...newExperienceInput);
    }

    if (experienceToAppend.length > 0) {
      pushData.experience = { $each: experienceToAppend };
    }

    if (req.files?.documents?.length) {
      pushData.documents = {
        $each: req.files.documents.map((file) => ({
          name: file.originalname,
          type: file.mimetype,
          publicId: file.filename,
          url: file.path,
          uploadDate: new Date()
        }))
      };
    }

    const updateOperation = {};

    if (Object.keys(updateData).length > 0) {
      updateOperation.$set = updateData;
    }

    if (Object.keys(pushData).length > 0) {
      updateOperation.$push = pushData;
    }

    if (Object.keys(updateOperation).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update fields provided'
      });
    }

    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      updateOperation,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      data: updatedTeacher
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
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





// will build after the class and subject apis

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
