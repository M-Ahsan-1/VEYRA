const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/applicationcontroller');

router.use(requireAuth);
router.get('/', c.listNotifications);
router.patch('/read', c.markNotificationsRead);

module.exports = router;