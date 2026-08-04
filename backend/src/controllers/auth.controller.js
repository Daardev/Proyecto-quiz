import {
  createUser,
  findUserByUsername,
  findUserByEmail,
  verifyPassword,
  sanitizeUser,
} from '../services/auth.service.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister({ username, email, password }) {
  const errors = [];
  if (!username || !USERNAME_RE.test(username)) {
    errors.push('username debe tener 3-30 caracteres alfanuméricos o guion bajo');
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push('email inválido');
  }
  if (!password || password.length < 8) {
    errors.push('password debe tener mínimo 8 caracteres');
  }
  return errors;
}

function postLoginRedirect(user, req) {
  const explicit = typeof req.body?.redirect === 'string' && req.body.redirect.startsWith('/') ? req.body.redirect : null;
  if (explicit) return explicit;
  if (user.role === 'admin') return '/admin';
  return '/';
}

export async function register(req, res, next) {
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  const { username, email, name, password } = req.body || {};

  const errors = validateRegister({ username, email, password });
  if (errors.length) {
    if (wantsHtml) {
      return res.status(400).render('pages/register', { error: errors.join('; '), values: req.body || {} });
    }
    return res.status(400).json({ error: errors.join('; ') });
  }

  if (await findUserByUsername(username)) {
    if (wantsHtml) {
      return res.status(409).render('pages/register', { error: 'Username ya registrado', values: req.body || {} });
    }
    return res.status(409).json({ error: 'username ya registrado' });
  }
  if (await findUserByEmail(email)) {
    if (wantsHtml) {
      return res.status(409).render('pages/register', { error: 'Email ya registrado', values: req.body || {} });
    }
    return res.status(409).json({ error: 'email ya registrado' });
  }

  const user = await createUser({ username, email, name, password, role: 'user' });
  req.session.userId = user.id;
  req.session.save((err) => {
    if (err) return next(err);
    if (wantsHtml) {
      return res.redirect(postLoginRedirect(user, req));
    }
    res.status(201).json({ user });
  });
}

export async function login(req, res, next) {
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  const { username, password } = req.body || {};

  if (!username || !password) {
    if (wantsHtml) {
      return res.status(400).render('pages/login', { error: 'Usuario y contraseña requeridos', values: { username } });
    }
    return res.status(400).json({ error: 'username y password requeridos' });
  }

  const user = await findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (wantsHtml) {
      return res.status(401).render('pages/login', { error: 'Credenciales inválidas', values: { username } });
    }
    return res.status(401).json({ error: 'credenciales inválidas' });
  }

  req.session.userId = user.id;
  req.session.save((err) => {
    if (err) return next(err);
    if (wantsHtml) {
      return res.redirect(postLoginRedirect(user, req));
    }
    res.json({ user: sanitizeUser(user) });
  });
}

export function logout(req, res) {
  if (!req.session) {
    if (req.accepts('html')) return res.redirect('/');
    return res.json({ success: true });
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    if (req.accepts('html')) return res.redirect('/');
    res.json({ success: true });
  });
}

export function me(req, res) {
  if (!req.user) return res.status(401).json({ error: 'no autenticado' });
  res.json({ user: req.user });
}
