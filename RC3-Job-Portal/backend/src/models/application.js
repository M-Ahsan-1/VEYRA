const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    changedBy: { type: String, required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  author: { type: String, required: true },
  at: { type: Date, default: Date.now },
});

const extractedSkillSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: false },
    evidence: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['Submitted', 'Parsed', 'AI Assessment Available', 'Recruiter Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected'],
      default: 'Submitted',
      index: true,
    },
    appliedAt: { type: Date, default: Date.now, index: true },
    score: { type: Number, min: 0, max: 100, default: null },
    overrideScore: { type: Number, min: 0, max: 100, default: null },
    overrideReason: { type: String, trim: true, maxlength: 1000, default: null },
    score_json: { type: mongoose.Schema.Types.Mixed, default: null },
    resumeFileName: { type: String, required: true, maxlength: 255 },
    resumeContentType: { type: String, default: 'application/pdf' },
    resumeSize: { type: Number, required: true, max: 5 * 1024 * 1024 },
    resumeData: { type: Buffer, required: true, select: false },
    resumeText: { type: String, maxlength: 100000, select: false },
    parsedResume: {
      phone: { type: String, default: '' },
      headline: { type: String, default: '' },
      skills: { type: [extractedSkillSchema], default: [] },
      education: { type: [String], default: [] },
      experience: { type: [String], default: [] },
      projects: { type: [String], default: [] },
      parsedAt: { type: Date, default: null },
    },
    history: { type: [historySchema], default: [] },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);