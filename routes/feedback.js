const express = require('express');
const router = express.Router();
const { Feedback, validate } = require('../models/feedback');
const { Room } = require('../models/room');
const { Answer } = require('../models/answer');
const { Question } = require('../models/question');
const { User } = require('../models/user');
const { Building } = require('../models/building');
const _ = require('lodash');
const validateId = require('../middleware/validateIdParam');
const {auth} = require('../middleware/auth');
const mongoose = require("mongoose");

router.post('/', auth, async (req, res) => {
    const {error} = validate(req.body);

    if (error) return res.status(400).send(error.details[0].message);

    const {roomId, answerId, questionId} = req.body;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).send("Room with id " + roomId + " was not found");

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).send("User with id " + user._id + " was not found");

    const answer = await Answer.findById(answerId);
    if (!answer) return res.status(404).send("Answer with id " + answerId + " was not found");

    const question = await Question.findById(questionId);
    if (!question) return res.status(404).send("Question with id " + questionId + " was not found");

    if (question.room.toString() !== roomId)
        return res.status(400).send("Question was not from the same room as the feedback given");

    let feedback = new Feedback(
        {
            user: user._id,
            room: roomId,
            answer: answerId,
            question: questionId
        }
    );

    const building = await Building.findById(room.building);
    building.feedback.push(feedback);

    await feedback.save();
    await building.save();
    res.send(_.pick(feedback, ["_id", "user", "room", "answer", "question"]));

});

router.get('/', async (req, res) => {
    const feedback = await Feedback.find();
    res.send(feedback);
});

router.get('/buildingFeedback/:id', validateId, async (req, res) => {

    const building = await Building.findById(req.params.id);
    if (!building) return res.status(404).send(`Building with id ${req.params.id} was not found`);

    const feedback = await Feedback.find().populate('user', '-__v -_id');
    res.send(feedback);
});

router.get('/userFeedback/:userId', validateId, async (req, res) => {
    const userId = req.params.userId;
    if (await User.countDocuments({_id: userId}) <= 0)
        return res.status(404).send('User with id ' + userId + ' was not found.');

    const feedback = await Feedback.find({user: userId}).populate('user');
    res.send(feedback);
});


router.get('/roomFeedback/:roomId', auth, validateId, async (req, res) => {


    const roomId = req.params.roomId;
    const room = await Room.findById(roomId);
    if (!room)
        return res.status(404).send(`Room with id ${roomId} was not found`);

    let feedback;



    let query = feedbackQuery(req.query, req.user._id);
    query.room = roomId;

    feedback = await Feedback.find(query);
    res.send(feedback);

});

function feedbackQuery (query, userId) {
    let feedbackQuery = {};
    let today = new Date();

    switch (query.t) {
        case "day":
            feedbackQuery.createdAt = {
                $gt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours()-24, today.getMinutes(), today.getSeconds())
            };
            break;
        case "week":
            feedbackQuery.createdAt = {
                $gt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-7, today.getHours(), today.getMinutes(), today.getSeconds())
            };
            break;
        case "month":
            feedbackQuery.createdAt = {
                $gt: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds())
            };
            break;
        case "year":
            feedbackQuery.createdAt = {
                $gt: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds())
            };
            break;
    }

    switch (query.user) {
        case "me":
            feedbackQuery.user = userId;
            break;
    }

    return feedbackQuery;
}

module.exports = router;
