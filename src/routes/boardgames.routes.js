const express = require('express');
const controller = require('../controllers/boardgames.controller');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/random', controller.random);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
