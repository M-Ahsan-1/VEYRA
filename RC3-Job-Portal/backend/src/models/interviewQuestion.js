const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    guideline: { type: String, trim: true, maxlength: 1500, default: '' },
    skill: { type: String, trim: true, default: null },
    askedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewQuestion', questionSchema);