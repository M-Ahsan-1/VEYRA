const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/interviewcontroller');

router.use(requireAuth, requireRole('recruiter'));
router.get('/', c.listInterviews);
router.post('/', c.createInterview);
router.put('/:id', c.updateInterview);
router.post('/:id/feedback', c.saveFeedback);

module.exports = router;