const express = require('express');
const controller = require('../controllers/matches.controller');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/active', controller.getActive);
router.post('/', controller.start);
router.post('/:id/participants', controller.addParticipant);
router.delete('/:id/participants/:participantId', controller.removeParticipant);
router.patch('/:id/participants/:participantId', controller.updateParticipantScore);
router.post('/:id/pause', controller.pause);
router.post('/:id/resume', controller.resume);
router.post('/:id/finish', controller.finish);
router.delete('/:id', controller.cancel);

module.exports = router;
