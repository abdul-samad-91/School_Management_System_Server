import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
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

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;

