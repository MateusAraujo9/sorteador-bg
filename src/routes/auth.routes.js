const express = require('express');
const controller = require('../controllers/auth.controller');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, controller.updateProfile);

module.exports = router;
