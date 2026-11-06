const Application = require('../models/application');
const Job = require('../models/job');
const Interview = require('../models/interview');
const asyncHandler = require('../utils/AsyncHandler');

const stages = ['Submitted', 'Parsed', 'AI Assessment Available', 'Recruiter Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected'];

const getAnalytics = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ recruiter: req.user._id }).select('_id title status');
  const jobIds = jobs.map((job) => job._id);
  const applications = await Application.find({ job: { $in: jobIds } }).select('job status appliedAt updatedAt score_json');
  const upcomingInterviews = await Interview.countDocuments({
    recruiter: req.user._id,
    status: 'scheduled',
    scheduled_at: { $gte: new Date() },
  });
  const statusCounts = new Map(stages.map((stage) => [stage, 0]));
  const gaps = new Map();

  for (const application of applications) {
    statusCounts.set(application.status, (statusCounts.get(application.status) || 0) + 1);
    for (const gap of application.score_json?.gaps || []) {
      gaps.set(gap.skill, (gaps.get(gap.skill) || 0) + 1);
    }
  }

  const applicationsByJob = jobs.map((job) => ({
    job: job.title,
    count: applications.filter((application) => String(application.job) === String(job._id)).length,
  }));
  const reviewed = applications.filter((application) => application.status !== 'Submitted');
  const averageDays = reviewed.length
    ? Math.round(reviewed.reduce((sum, application) => sum + Math.max(0, application.updatedAt - application.appliedAt), 0) / reviewed.length / 86400000)
    : null;
  const shortlistCount = statusCounts.get('Shortlisted') + statusCounts.get('Interview') + statusCounts.get('Selected');

  res.json({
    success: true,
    analytics: {
      active_jobs: jobs.filter((job) => job.status === 'open').length,
      total_applications: applications.length,
      shortlisted_count: shortlistCount,
      pending_reviews: statusCounts.get('Submitted') + statusCounts.get('Parsed') + statusCounts.get('AI Assessment Available') + statusCounts.get('Recruiter Review'),
      upcoming_interviews: upcomingInterviews,
      applications_by_job: applicationsByJob,
      applications_by_stage: stages.map((status) => ({ status, count: statusCounts.get(status) })),
      shortlist_rate: applications.length ? Math.round(shortlistCount / applications.length * 100) : 0,
      ...(averageDays !== null ? { avg_processing_time: averageDays } : {}),
      common_skill_gaps: [...gaps].map(([skill, count]) => ({ skill, count })).sort((a, b) => b.count - a.count),
    },
  });
});

module.exports = { getAnalytics };