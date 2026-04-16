import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  masterAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  superAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  branchType: {
    type: String,
    enum: ['primary', 'model', 'high' , 'higher_secondary'],
    default: 'campus'
  },
  parentBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    default: null
  },
  name: {
    type: String,
    required: [true, 'School name is required'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'School code is required'],
    unique: true,
    uppercase: true
  },
  logo: String,
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  contact: {
    phone: [String],
    email: String,
    website: String
  },
  registration: {
    number: String,
    date: Date,
    authority: String
  },
  settings: {
    timeZone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    schoolHours: {
      start: String,
      end: String
    },
    dateFormat: { type: String, default: 'MM/DD/YYYY' }
  },
  branding: {
    primaryColor: String,
    secondaryColor: String,
    letterhead: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  operationalStatus: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'suspended', 'closed'],
    default: 'active'
  }
}, {
  timestamps: true
});

const School = mongoose.model('School', schoolSchema);

export default School;
