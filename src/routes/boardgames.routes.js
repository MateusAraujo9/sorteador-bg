const express = require('express');
const controller = require('../controllers/boardgames.controller');
const linksController = require('../controllers/boardgameLinks.controller');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/random', controller.random);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

router.get('/:gameId/links', linksController.list);
router.post('/:gameId/links', linksController.create);
router.delete('/:gameId/links/:linkId', linksController.remove);

module.exports = router;
