import { Router } from 'express';
import * as subCtrl from '../controllers/submissions.controller.js';

const router = Router();

router.post('/quizzes/:quizId/preview', subCtrl.previewCode);
router.post('/quizzes/:quizId/finish', subCtrl.finishQuiz);
router.get('/quizzes/:quizId/results', subCtrl.getQuizResults);

export default router;
