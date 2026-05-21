import User from '../models/User.model.js';
import { generateToken } from '../utils/generateToken.js';


export const register = async (req, res) => {
  try {
    const { username, name, email, password, role, permissions, profile, school } = req.body;

    // Restrict role escalation: only authenticated super_admin/master_admin can assign elevated roles
    const elevatedRoles = ['super_admin', 'master_admin'];
    if (elevatedRoles.includes(role)) {
      if (!req.user || !elevatedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only super_admin or master_admin can create accounts with elevated roles'
        });
      }
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }] });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Derive username from provided username, name, or email
    let finalUsername = username;
    if (!finalUsername) {
      if (name) {
        finalUsername = name.trim().toLowerCase().replace(/\s+/g, '_');
      } else {
        finalUsername = email.split('@')[0].toLowerCase();
      }
    }

    // Check if username is already taken
    const usernameExists = await User.findOne({ username: finalUsername });
    if (usernameExists) {
      // Add a timestamp suffix to make it unique
      finalUsername = `${finalUsername}_${Date.now()}`;
    }

    // Create user
    const user = await User.create({
      username: finalUsername,
      email,
      password,
      role: role || 'admin',
      school,
      permissions: permissions || [],
      profile,
      createdBy: req.user?._id || null  // Allow registration without authenticated user
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        school: user.school,
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
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
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
        message: 'Invalid email or password'
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
        school: user.school,
        permissions: user.permissions,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed'
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
        school: user.school,
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

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether the email exists
      return res.status(200).json({ success: true, message: 'If an account with that email exists, a reset code has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // TODO: Send OTP via email using nodemailer
    // For now, log it in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset code has been sent.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
