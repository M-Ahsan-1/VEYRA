const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/applicationcontroller');

router.use(requireAuth, requireRole('candidate'));
router.get('/applications', c.listCandidateApplications);
router.get('/profile', c.getCandidateProfile);
router.put('/profile', c.saveCandidateProfile);
router.get('/recommendations', c.listCandidateRecommendations);

module.exports = router;