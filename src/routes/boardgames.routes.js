const express = require('express');
const controller = require('../controllers/boardgames.controller');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/random', controller.random);
router.delete('/:id', controller.remove);

module.exports = router;
