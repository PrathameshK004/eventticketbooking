let express = require("express");
let router = express.Router();
let eventController = require('../controllers/event.controller');
let eventInterceptor = require('../interceptor/event.interceptor')

router.get('/searchEvents', eventController.searchEventsByKeyword);
router.get('/allEvents', eventController.getAllEvents);
router.get('/:eventId', eventInterceptor.validateEventId, eventController.getEventById);
router.post('/addEvent', eventInterceptor.validateNewEvent, eventController.createEvent);
router.put('/:eventId', eventInterceptor.validateUpdateEvent, eventController.updateEvent);
router.delete('/:eventId', eventInterceptor.validateEventId, eventController.deleteEvent);


module.exports = router;