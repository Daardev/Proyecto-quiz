import { Router } from 'express';
import * as questionsCtrl from '../controllers/questions.controller.js';

const router = Router();

router.get('/languages', questionsCtrl.getLanguages);

router.post('/quizzes/generate', questionsCtrl.generateQuiz);
router.get('/quizzes/:quizId/current', questionsCtrl.getCurrentQuestion);

export default router;
