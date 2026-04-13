import School from '../models/School.model.js';

const allowedSchoolFields = [
  'name',
  'code',
  'logo',
  'address',
  'contact',
  'registration',
  'settings',
  'branding',
  'isActive'
];

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pickAllowedFields = (payload = {}) => {
  return allowedSchoolFields.reduce((accumulator, field) => {
    if (payload[field] !== undefined) {
      accumulator[field] = payload[field];
    }

    return accumulator;
  }, {});
};

const buildSchoolQuery = (queryParams = {}) => {

    
  const { search, isActive, city, state, country, code} = queryParams;
  const query = {};

  if (isActive !== undefined) {
    query.isActive = typeof isActive === 'boolean' ? isActive : isActive === 'true';
  }

  if (code) {
    query.code = code.trim().toUpperCase();
  }

  if (city) {
    query['address.city'] = { $regex: escapeRegex(city.trim()), $options: 'i' };
  }

  if (state) {
    query['address.state'] = { $regex: escapeRegex(state.trim()), $options: 'i' };
  }

  if (country) {
    query['address.country'] = { $regex: escapeRegex(country.trim()), $options: 'i' };
  }

  if (search) {
    const searchRegex = { $regex: escapeRegex(search.trim()), $options: 'i' };

    query.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { 'address.city': searchRegex },
      { 'address.state': searchRegex },
      { 'address.country': searchRegex },
      { 'contact.email': searchRegex },
      { 'registration.number': searchRegex }
    ];
  }

  return query;
};

const enforceSingleActiveSchool = async (schoolId) => {
  await School.updateMany(
    { _id: { $ne: schoolId }, isActive: true },
    { isActive: false }
  );
};

const handleSchoolError = (res, error) => {
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid school id'
    });
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';

    return res.status(400).json({
      success: false,
      message: `${duplicateField} already exists`
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors).map((item) => item.message).join(', ')
    });
  }

  return res.status(500).json({
    success: false,
    message: error.message || 'Server Error'
  });
};

export const getSchools = async (req, res) => {
  try {

    
    const schools = await School.find(buildSchoolQuery(req.query)).sort({
      isActive: -1,
      createdAt: -1
    });

    res.status(200).json({
      success: true,
      count: schools.length,
      data: schools
    });
  } catch (error) {
    handleSchoolError(res, error);
  }
};

export const getSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);

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
    handleSchoolError(res, error);
  }
};

export const getSchoolProfile = async (req, res) => {
  try {
    const school = await School.findOne({ isActive: true }).sort({ updatedAt: -1 });

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
    handleSchoolError(res, error);
  }
};

export const createSchoolProfile = async (req, res) => {
  try {
    const schoolData = pickAllowedFields(req.body);
    const activeSchoolExists = await School.exists({ isActive: true });

    if (schoolData.isActive === false && !activeSchoolExists) {
      return res.status(400).json({
        success: false,
        message: 'The first school profile must be active'
      });
    }

    const school = await School.create(schoolData);

    if (school.isActive) {
      await enforceSingleActiveSchool(school._id);
    }

    const createdSchool = await School.findById(school._id);

    res.status(201).json({
      success: true,
      message: 'School profile created successfully',
      data: createdSchool
    });
  } catch (error) {
    handleSchoolError(res, error);
  }
};

export const updateSchoolProfile = async (req, res) => {
  try {
    const updates = pickAllowedFields(req.body);
    const school = await School.findById(req.params.id);

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School profile not found'
      });
    }

    if (updates.isActive === false && school.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Active school profile cannot be deactivated directly. Activate another profile instead.'
      });
    }

    school.set(updates);
    await school.save();

    if (school.isActive) {
      await enforceSingleActiveSchool(school._id);
    }

    const updatedSchool = await School.findById(school._id);

    res.status(200).json({
      success: true,
      message: 'School profile updated successfully',
      data: updatedSchool
    });
  } catch (error) {
    handleSchoolError(res, error);
  }
};

export const updateSchoolStatus = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School profile not found'
      });
    }

    if (req.body.isActive === false && school.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Active school profile cannot be deactivated directly. Activate another profile instead.'
      });
    }

    school.isActive = req.body.isActive;
    await school.save();

    if (school.isActive) {
      await enforceSingleActiveSchool(school._id);
    }

    res.status(200).json({
      success: true,
      message: `School profile ${school.isActive ? 'activated' : 'deactivated'} successfully`,
      data: school
    });
  } catch (error) {
    handleSchoolError(res, error);
  }
};

export const deleteSchoolProfile = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School profile not found'
      });
    }

    if (school.isActive) {
      const replacementSchool = await School.findOne({ _id: { $ne: school._id } }).sort({
        updatedAt: -1,
        createdAt: -1
      });

      if (!replacementSchool) {
        return res.status(400).json({
          success: false,
          message: 'The active school profile cannot be deleted because no replacement profile exists.'
        });
      }

      replacementSchool.isActive = true;
      await replacementSchool.save();
      await enforceSingleActiveSchool(replacementSchool._id);
    }

    await school.deleteOne();

    res.status(200).json({
      success: true,
      message: 'School profile deleted successfully'
    });
  } catch (error) {
    handleSchoolError(res, error);
  }
};
