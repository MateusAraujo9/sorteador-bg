function parseCookies(req, res, next) {
  req.cookies = {};
  const header = req.headers.cookie;

  if (header) {
    header.split(';').forEach(part => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      req.cookies[key] = decodeURIComponent(value);
    });
  }

  next();
}

module.exports = parseCookies;
