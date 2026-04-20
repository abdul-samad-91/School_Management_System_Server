import mongoose from 'mongoose';

const createAnnouncementValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validateAnnouncementTargeting = (doc) => {
  const targetClasses = Array.isArray(doc.targetClasses) ? doc.targetClasses : [];
  const targetSections = Array.isArray(doc.targetSections) ? doc.targetSections : [];

  if (targetSections.length > 0 && targetClasses.length === 0) {
    throw createAnnouncementValidationError(
      'targetClasses are required when targetSections are provided'
    );
  }

  if (doc.targetAudience === 'specific' && targetClasses.length === 0 && targetSections.length === 0) {
    throw createAnnouncementValidationError(
      'Specific announcements must target at least one class or section'
    );
  }
};

const announcementSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Message is required']
  },
  type: {
    type: String,
    enum: ['general', 'urgent', 'holiday', 'exam', 'event', 'fee'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'students', 'teachers', 'parents', 'staff', 'specific'],
    required: true
  },
  targetClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  targetSections: [String],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  publishDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  isPublished: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

announcementSchema.index({ school: 1, publishDate: -1 });
announcementSchema.index({ school: 1, type: 1, isPublished: 1 });

announcementSchema.pre('validate', function(next) {
  try {
    if (
      this.publishDate &&
      this.expiryDate &&
      new Date(this.expiryDate) < new Date(this.publishDate)
    ) {
      throw createAnnouncementValidationError(
        'expiryDate must be greater than or equal to publishDate'
      );
    }

    validateAnnouncementTargeting(this);
    next();
  } catch (error) {
    next(error);
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;
