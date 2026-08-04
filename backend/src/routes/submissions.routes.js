import { Router } from 'express';
import * as subCtrl from '../controllers/submissions.controller.js';

const router = Router();

router.post('/quizzes/:quizId/submit', subCtrl.submitAnswer);
router.post('/quizzes/:quizId/skip', subCtrl.skipQuestion);
router.get('/quizzes/:quizId/results', subCtrl.getQuizResults);

export default router;
