const buckets = new Map();

// varredura periódica para não deixar o Map crescer indefinidamente
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

function rateLimit({ windowMs, max, message }) {
  return function rateLimitMiddleware(req, res, next) {
    // testes de integração fazem muito mais cadastros/logins por IP do que qualquer usuário real faria
    // na janela de tempo do teste; a lógica de limite em si é coberta à parte por rateLimit.test.js
    if (process.env.NODE_ENV === 'test') return next();

    const key = `${req.baseUrl}${req.path}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    bucket.count += 1;
    next();
  };
}

module.exports = rateLimit;
