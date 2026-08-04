const express = require('express');
const cors = require('cors');
const path = require('path');
const parseCookies = require('./middleware/cookies');
const authRouter = require('./routes/auth.routes');
const boardgamesRouter = require('./routes/boardgames.routes');
const adminRouter = require('./routes/admin.routes');
const bggRouter = require('./routes/bgg.routes');

function createApp() {
  const app = express();

  // Necessário atrás de proxies TLS-terminating (Render, Fly, Railway, nginx...)
  // para que req.secure e req.ip reflitam a conexão real do cliente.
  app.set('trust proxy', 1);

  app.use(cors());
  app.use(express.json());
  app.use(parseCookies);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/auth', authRouter);
  app.use('/api/boardgames', boardgamesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/bgg', bggRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // eslint-disable-next-line no-unused-vars -- Express só reconhece isto como error handler com 4 parâmetros
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  return app;
}

module.exports = createApp;
