import { Router } from 'express';
import {
  getDashboard,
  getNewQuestionForm,
  getEditQuestionForm,
  postCreateQuestion,
  postUpdateQuestion,
  postDeleteQuestion,
  postPreviewQuestion,
} from '../controllers/admin.controller.js';

const router = Router();

router.get('/', getDashboard);
router.get('/new', getNewQuestionForm);
router.get('/:id/edit', getEditQuestionForm);
router.post('/preview', postPreviewQuestion);
router.post('/', postCreateQuestion);
router.post('/:id', postUpdateQuestion);
router.post('/:id/delete', postDeleteQuestion);

export default router;
