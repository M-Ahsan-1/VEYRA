const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getAnalytics } = require('../controllers/analyticscontroller');
const { searchTalent } = require('../controllers/talentcontroller');
const { regenerateQuestion } = require('../controllers/interviewcontroller');
const aiLimiter = require('../middleware/aiRateLimit');

router.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    time: new Date(),
  });
});
router.get('/analytics', requireAuth, requireRole('recruiter'), getAnalytics);
router.post('/talent/search', requireAuth, requireRole('recruiter'), searchTalent);

router.use('/auth', require('./authroutes'));
router.use('/jobs', require('./jobroutes'));
router.use('/applications', require('./applicationroutes'));
router.use('/candidate', require('./candidateroutes'));
router.use('/notifications', require('./notificationroutes'));
router.use('/interviews', require('./interviewroutes'));

const interviewController = require('../controllers/interviewcontroller');
router.put('/questions/:id', requireAuth, requireRole('recruiter'), interviewController.updateQuestion);
router.patch('/questions/:id/asked', requireAuth, requireRole('recruiter'), interviewController.markQuestionAsked);
router.delete('/questions/:id', requireAuth, requireRole('recruiter'), interviewController.deleteQuestion);
router.post('/questions/:id/regenerate', requireAuth, requireRole('recruiter'), aiLimiter, regenerateQuestion);

// Temporary route to verify role-based access. Delete later.
router.get('/recruiter/ping', requireAuth, requireRole('recruiter'), (req, res) =>
  res.json({ message: `Hello recruiter ${req.user.name}` })
);

module.exports = router;