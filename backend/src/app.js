import express from 'express';
import session from 'express-session';
import PgStore from 'connect-pg-simple';
import { engine } from 'express-handlebars';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { join } from 'node:path';
import authRoutes from './routes/auth.routes.js';
import questionsRoutes from './routes/questions.routes.js';
import submissionsRoutes from './routes/submissions.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { pool } from './config/database.js';
import { findUserById, sanitizeUser, bootstrapAdmin } from './services/auth.service.js';
import { getLanguagesData, getLanguagesDataWithCounts, getCurrentQuestionData } from './controllers/questions.controller.js';
import { isAuthenticated, isAdmin } from './middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

bootstrapAdmin();

const PgSessionStore = PgStore(session);

const app = express();

Handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
});
Handlebars.registerHelper('json', (value) => new Handlebars.SafeString(JSON.stringify(value)));
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return arg1 == arg2 ? options.fn(this) : options.inverse(this);
});
Handlebars.registerHelper('or', function() {
  for (let i = 0; i < arguments.length - 1; i++) {
    if (arguments[i]) return arguments[i];
  }
  return '';
});
Handlebars.registerHelper('array', function() { return []; });

app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: join(__dirname, './views/layouts'),
  partialsDir: join(__dirname, './views/partials'),
}));
app.set('view engine', 'hbs');
app.set('views', join(__dirname, './views'));

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSessionStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || 'dev-only-secret-replace-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.use(async (req, res, next) => {
  try {
    if (req.session?.userId) {
      const user = await findUserById(req.session.userId);
      req.user = user ? sanitizeUser(user) : null;
      if (!user) req.session.userId = null;
    } else {
      req.user = null;
    }
    res.locals.user = req.user;
    res.locals.isAdmin = req.user?.role === 'admin';
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.static(join(__dirname, '../public')));
app.use('/src', express.static(join(__dirname, '../public/src')));

app.get('/', async (req, res, next) => {
  try {
    const langData = await getLanguagesDataWithCounts();
    const languages = langData.map(l => l.language);
    const counts = langData;
    res.render('pages/index', { languages, counts });
  } catch (err) {
    next(err);
  }
});

app.get('/login', (req, res) => {
  res.render('pages/login', { error: null, values: {}, redirect: req.query.redirect || '' });
});

app.get('/register', (req, res) => {
  res.render('pages/register', { error: null, values: {}, redirect: req.query.redirect || '' });
});

app.get('/quiz', async (req, res, next) => {
  try {
    const quizId = parseInt(req.query.quizId, 10);
    let firstQuestion = null;
    if (Number.isInteger(quizId)) {
      const data = await getCurrentQuestionData(quizId);
      if (!data.__error) firstQuestion = data;
    }
    res.render('pages/quiz', { firstQuestion });
  } catch (err) {
    next(err);
  }
});

app.get('/results', (req, res) => {
  res.render('pages/results');
});

app.get('/profile', isAuthenticated, async (req, res, next) => {
  try {
    const { getUserQuizzes, getUserStats } = await import('./controllers/profile.controller.js');
    const quizzes = await getUserQuizzes(req.user.id);
    const stats = await getUserStats(req.user.id);
    res.render('pages/profile', { quizzes, stats });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', questionsRoutes);
app.use('/api', submissionsRoutes);
app.use('/admin', isAuthenticated, isAdmin, adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ message: 'API QUIZ - OK', user: req.user });
});

export default app;
