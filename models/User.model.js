import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const normalizePermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    return permissions;
  }

  const permissionMap = new Map();

  permissions.forEach((permission) => {
    if (!permission?.module) {
      return;
    }

    const moduleName = String(permission.module).trim();
    const actions = Array.isArray(permission.actions)
      ? [...new Set(permission.actions.map((action) => String(action).trim()).filter(Boolean))]
      : [];

    if (!permissionMap.has(moduleName)) {
      permissionMap.set(moduleName, new Set());
    }

    actions.forEach((action) => permissionMap.get(moduleName).add(action));
  });

  return [...permissionMap.entries()].map(([module, actions]) => ({
    module,
    actions: [...actions]
  }));
};

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: [
      'super_admin',
      'admin',
      'teacher'
    ],
    default: 'admin'
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School'
  },
  permissions: [{
    module: {
      type: String,
      enum: [
        'school_setup',
        'students',
        'teachers',
        'academics',
        'attendance',
        'fees',
        'exams',
        'certificates',
        'communication',
        'reports',
        'users'
      ]
    },
    actions: [{
      type: String,
      enum: ['view', 'create', 'update', 'delete', 'export']
    }]
  }],
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: String,
    address: String,
    photo: String,
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  resetPasswordOtp: String,
  resetPasswordExpires: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

userSchema.index({ school: 1, role: 1, isActive: 1 });

userSchema.pre('validate', function(next) {
  try {
    if (Array.isArray(this.permissions)) {
      this.permissions = normalizePermissions(this.permissions);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check permission
userSchema.methods.hasPermission = function(module, action) {
  if (this.role === 'super_admin') return true;
  
  const modulePermission = this.permissions.find(p => p.module === module);
  return modulePermission && modulePermission.actions.includes(action);
};

const User = mongoose.model('User', userSchema);

export default User;
