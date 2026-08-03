# 🎲 Sorteador de Boardgames

Cadastre sua coleção de jogos de tabuleiro e deixe a sorte escolher o próximo jogo da mesa.

## Funcionalidades

- **Conta** — crie uma conta ou entre com e-mail e senha; cada usuário só vê e sorteia os próprios jogos. Esqueceu a senha? Tem recuperação por e-mail.
- **Cadastrar** — registre jogos com nome, número de jogadores, duração, categoria, idade mínima, imagem e documentos (manual, expansões...).
- **Coleção** — veja todos os jogos cadastrados, com estatísticas (total, categorias, duração média), edição e remoção individual.
- **Sortear** — role os dados e receba um bilhete de sorteio com o jogo escolhido aleatoriamente. Dá pra filtrar por jogadores, idade e categoria (opcional).
- **Perfil** — edite nome, e-mail e senha da conta logada.

## Stack

- **Backend**: Node.js + Express, em estrutura de camadas (`routes` → `controllers` → `repository`)
- **Persistência**: SQLite/libSQL via `@libsql/client` — arquivo local por padrão (zero configuração), ou [Turso](https://turso.tech) (libSQL hospedado) em produção, via variáveis de ambiente
- **Autenticação**: sessão por cookie `httpOnly` (sem `express-session`), senhas com hash `scrypt` nativo do Node (sem `bcrypt`)
- **Frontend**: HTML/CSS/JS puro, sem framework ou bundler — ES modules nativos no navegador

Sem build step, sem testes automatizados.

## Como rodar

Requer **Node.js 22.5+**.

```bash
npm install
npm start
```

O servidor sobe em [http://localhost:3000](http://localhost:3000). Por padrão usa um arquivo SQLite local em `data/boardgames.db` (criado automaticamente) — não precisa de nenhuma conta ou configuração para desenvolver.

Para usar um banco Turso em vez do arquivo local (necessário em hosts sem disco persistente), copie `.env.example` para `.env` e preencha `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`. Para o e-mail de recuperação de senha funcionar, preencha também `BREVO_API_KEY`/`BREVO_SENDER_EMAIL` (conta grátis em [brevo.com](https://www.brevo.com), com um remetente verificado).

## Estrutura do projeto

```
server.js                    # entry point (roda as migrações e sobe o servidor)
src/
  app.js                     # setup do Express (middlewares, rotas)
  routes/                    # mapeamento de rotas HTTP
  controllers/               # validação de entrada e resposta
  data/                      # acesso ao banco (única camada que toca o @libsql/client)
data/
  boardgames.db              # banco local (só existe quando não há TURSO_DATABASE_URL)
public/
  index.html                 # markup
  css/                       # tokens de design + estilos
  js/                        # módulos ES (api, render, dice, main...)
```

Mais detalhes de arquitetura, convenções e o sistema de design em [`CLAUDE.md`](./CLAUDE.md).

## API

Todas as rotas de `/api/boardgames` exigem estar autenticado (cookie de sessão `sid`).

| Método | Rota                     | Descrição                                    |
|--------|--------------------------|------------------------------------------------|
| POST   | `/api/auth/register`     | Cria uma conta e inicia a sessão                |
| POST   | `/api/auth/login`        | Autentica e inicia a sessão                     |
| POST   | `/api/auth/logout`       | Encerra a sessão                                |
| GET    | `/api/auth/me`           | Dados do usuário logado                         |
| PATCH  | `/api/auth/me`           | Atualiza nome/senha do usuário logado (e-mail não é editável) |
| POST   | `/api/auth/forgot-password` | Envia e-mail com link de redefinição de senha |
| POST   | `/api/auth/reset-password`  | Define uma nova senha a partir do token do e-mail |
| GET    | `/api/boardgames`        | Lista os jogos do usuário logado                |
| POST   | `/api/boardgames`        | Cadastra um jogo (`name` obrigatório)           |
| PUT    | `/api/boardgames/:id`    | Atualiza um jogo do usuário logado              |
| GET    | `/api/boardgames/random` | Sorteia um jogo do usuário logado (aceita `?players=`, `?minAge=`, `?category=`, todos opcionais) |
| DELETE | `/api/boardgames/:id`    | Remove um jogo do usuário logado                |
| GET    | `/api/boardgames/:id/links`        | Lista os documentos de um jogo        |
| POST   | `/api/boardgames/:id/links`        | Adiciona um documento (`label`, `url`) |
| DELETE | `/api/boardgames/:id/links/:linkId` | Remove um documento                   |
