import User from '../models/User.model.js';
import { generateToken } from '../utils/generateToken.js';


export const register = async (req, res) => {
  try {
    const { username, email, password, role, permissions, profile } = req.body;
    console.log(req.body);

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'admin',
      permissions: permissions || [],
      profile,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // Check for user
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {  
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const update = async (req, res) => {
  try {
    const {
      username,
      currentPassword,
      newPassword,
      profile
    } = req.body;

    let parsedProfile = null;
    if (profile) {
      try {
        parsedProfile = typeof profile === 'string' ? JSON.parse(profile) : profile;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid profile JSON'
        });
      }
    }

    const profileUpdates = {};
    const profileFields = ['firstName', 'lastName', 'phone', 'address', 'gender', 'dateOfBirth'];
    profileFields.forEach((field) => {
      const value = req.body[field] !== undefined ? req.body[field] : parsedProfile?.[field];
      if (value !== undefined) {
        profileUpdates[field] = value;
      }
    });

    if (req.file && req.file.path) {
      profileUpdates.photo = req.file.path;
    }

    const hasProfileUpdates = Object.keys(profileUpdates).length > 0;
    const hasUsernameUpdate = username !== undefined;
    const hasPasswordUpdate = newPassword !== undefined;

    if (!hasProfileUpdates && !hasUsernameUpdate && !hasPasswordUpdate) {
      return res.status(400).json({
        success: false,
        message: 'No update fields provided'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (hasUsernameUpdate && username && username !== user.username) {
      const existingUser = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: user._id }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      user.username = username;
    }

    if (hasPasswordUpdate) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to update password'
        });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      user.password = newPassword;
    }

    if (profileUpdates.dateOfBirth) {
      const dob = new Date(profileUpdates.dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dateOfBirth'
        });
      }
      profileUpdates.dateOfBirth = dob;
    }

    if (hasProfileUpdates) {
      if (!user.profile) user.profile = {};
      Object.entries(profileUpdates).forEach(([key, value]) => {
        user.profile[key] = value;
      });
    }

    await user.save();

    const token = hasPasswordUpdate ? generateToken(user._id) : undefined;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      ...(token ? { token } : {}),
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
  