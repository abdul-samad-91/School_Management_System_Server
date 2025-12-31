import School from '../models/School.model.js';

// @desc    Get school profile
// @route   GET /api/school/profile
// @access  Private
export const getSchoolProfile = async (req, res) => {
  try {
    const school = await School.findOne({ isActive: true });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: school
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create school profile
// @route   POST /api/school/profile
// @access  Private (Super Admin)
export const createSchoolProfile = async (req, res) => {
  try {
    // Check if school profile already exists
    const existingSchool = await School.findOne();
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        message: 'School profile already exists. Please update instead.'
      });
    }

    const school = await School.create(req.body);

    res.status(201).json({
      success: true,
      message: 'School profile created successfully',
      data: school
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update school profile
// @route   PUT /api/school/profile/:id
// @access  Private (Super Admin)
export const updateSchoolProfile = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'School profile updated successfully',
      data: school
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

