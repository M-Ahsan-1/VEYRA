const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createJobSchema, updateJobSchema, extractSchema } = require('../validators/jobscheme');
const normalizeJobPayload = require('../middleware/normalizeJobPayload');
const c = require('../controllers/jobcontroller');
const applications = require('../controllers/applicationcontroller');

// AI calls cost money, so limit them
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'AI request limit reached, try again later' },
});

router.use(requireAuth);

router.get('/open', c.listOpenJobs);
router.get('/', requireRole('recruiter'), c.listMyJobs);
router.get('/:jobId/applicants', requireRole('recruiter'), applications.listJobApplicants);
router.post(
  '/extract-requirements',
  requireRole('recruiter'),
  aiLimiter,
  validate(extractSchema),
  c.extractJobRequirements
);
router.post('/', requireRole('recruiter'), normalizeJobPayload, validate(createJobSchema), c.createJob);

router.get('/:id', c.getJob);
router.put('/:id', requireRole('recruiter'), normalizeJobPayload, validate(updateJobSchema), c.updateJob);
router.patch('/:id/close', requireRole('recruiter'), c.closeJob);
router.patch('/:id/reopen', requireRole('recruiter'), c.reopenJob);

module.exports = router;