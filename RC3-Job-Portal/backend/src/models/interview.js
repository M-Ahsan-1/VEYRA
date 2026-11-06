const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    technical: { type: Number, min: 1, max: 5, required: true },
    communication: { type: Number, min: 1, max: 5, required: true },
    problem_solving: { type: Number, min: 1, max: 5, required: true },
    culture_fit: { type: Number, min: 1, max: 5, required: true },
    comments: { type: String, trim: true, maxlength: 3000, default: '' },
    recommendation: { type: String, enum: ['hire', 'hold', 'reject'], required: true },
    submittedBy: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    interviewer: { type: String, required: true, trim: true, maxlength: 120 },
    interview_type: { type: String, enum: ['technical', 'behavioral', 'system_design', 'culture'], default: 'technical' },
    scheduled_at: { type: Date, required: true, index: true },
    duration_minutes: { type: Number, min: 15, max: 240, default: 45 },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    feedback: { type: ratingSchema, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);