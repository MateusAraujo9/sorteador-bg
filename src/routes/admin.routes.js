const express = require('express');
const controller = require('../controllers/admin.controller');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', controller.listUsers);
router.patch('/users/:id/role', controller.updateUserRole);

module.exports = router;
