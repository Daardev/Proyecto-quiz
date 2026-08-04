export function isAuthenticated(req, res, next) {
  if (req.user) return next();
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) {
    const redirect = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`/login?redirect=${redirect}`);
  }
  res.status(401).json({ error: 'no autenticado' });
}

export function isAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) {
    return res.status(403).render('pages/index', {
      technologies: [],
      error: 'Acceso restringido a administradores',
    });
  }
  res.status(403).json({ error: 'acceso restringido a administradores' });
}

export function optionalAuth(req, res, next) {
  next();
}
