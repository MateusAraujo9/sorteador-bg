const express = require('express');
const controller = require('../controllers/bgg.controller');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

router.use(requireAuth);

const bggLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Muitas buscas no BoardGameGeek. Tente novamente em alguns minutos.'
});

router.use(bggLimiter);

router.get('/search', controller.search);
router.get('/:id', controller.getDetails);

module.exports = router;
