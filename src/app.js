const express = require('express');
const cors = require('cors');
const path = require('path');
const parseCookies = require('./middleware/cookies');
const authRouter = require('./routes/auth.routes');
const boardgamesRouter = require('./routes/boardgames.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(parseCookies);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/auth', authRouter);
  app.use('/api/boardgames', boardgamesRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  return app;
}

module.exports = createApp;
