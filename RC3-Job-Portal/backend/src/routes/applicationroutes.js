const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const resumeUpload = require('../middleware/resumeUpload');
const aiLimiter = require('../middleware/aiRateLimit');
const c = require('../controllers/applicationcontroller');
const interviews = require('../controllers/interviewcontroller');

router.use(requireAuth);
router.post('/', requireRole('candidate'), resumeUpload, c.createApplication);
router.get('/:id/resume', c.downloadResume);
router.get('/:id', requireRole('recruiter'), c.getApplicationDetail);
router.post('/:id/assess', requireRole('recruiter'), aiLimiter, c.assessApplication);
router.patch('/:id/status', requireRole('recruiter'), c.changeApplicationStatus);
router.patch('/:id/override', requireRole('recruiter'), c.overrideApplicationScore);
router.get('/:id/notes', requireRole('recruiter'), c.listApplicationNotes);
router.post('/:id/notes', requireRole('recruiter'), c.addApplicationNote);
router.get('/:applicationId/questions', requireRole('recruiter'), interviews.listQuestions);
router.post('/:applicationId/questions/generate', requireRole('recruiter'), aiLimiter, interviews.generateQuestions);

module.exports = router;