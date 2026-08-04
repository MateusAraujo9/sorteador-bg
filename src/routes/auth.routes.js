const express = require('express');
const controller = require('../controllers/auth.controller');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de recuperação de senha. Tente novamente mais tarde.'
});

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de verificação. Tente novamente em alguns minutos.'
});

const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitos pedidos de reenvio. Tente novamente mais tarde.'
});

router.post('/register', registerLimiter, controller.register);
router.post('/login', loginLimiter, controller.login);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, controller.updateProfile);
router.post('/verify-email', verifyEmailLimiter, controller.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, controller.resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

module.exports = router;
