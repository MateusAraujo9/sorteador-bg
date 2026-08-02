try {
  process.loadEnvFile();
} catch {
  // sem .env local — ok, usa variáveis de ambiente já definidas (ex: produção)
}

const createApp = require('./src/app');
const runMigrations = require('./src/data/migrate');

const PORT = process.env.PORT || 3000;

runMigrations()
  .then(() => {
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Falha ao migrar o banco de dados:', err);
    process.exit(1);
  });
