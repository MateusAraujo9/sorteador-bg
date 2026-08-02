# 🎲 Sorteador de Boardgames

Cadastre sua coleção de jogos de tabuleiro e deixe a sorte escolher o próximo jogo da mesa.

## Funcionalidades

- **Conta** — crie uma conta ou entre com e-mail e senha; cada usuário só vê e sorteia os próprios jogos.
- **Cadastrar** — registre jogos com nome, número de jogadores, duração, categoria, idade mínima e imagem.
- **Coleção** — veja todos os jogos cadastrados, com estatísticas (total, categorias, duração média), edição e remoção individual.
- **Sortear** — role os dados e receba um bilhete de sorteio com o jogo escolhido aleatoriamente.
- **Perfil** — edite nome, e-mail e senha da conta logada.

## Stack

- **Backend**: Node.js + Express, em estrutura de camadas (`routes` → `controllers` → `repository`)
- **Persistência**: SQLite via `node:sqlite` (nativo do Node, sem dependência externa)
- **Autenticação**: sessão por cookie `httpOnly` (sem `express-session`), senhas com hash `scrypt` nativo do Node (sem `bcrypt`)
- **Frontend**: HTML/CSS/JS puro, sem framework ou bundler — ES modules nativos no navegador

Sem build step, sem testes automatizados.

## Como rodar

Requer **Node.js 22.5+**.

```bash
npm install
npm start
```

O servidor sobe em [http://localhost:3000](http://localhost:3000).

## Estrutura do projeto

```
server.js                    # entry point
src/
  app.js                     # setup do Express (middlewares, rotas)
  routes/                    # mapeamento de rotas HTTP
  controllers/               # validação de entrada e resposta
  data/                      # acesso ao banco (única camada que toca o SQLite)
data/
  boardgames.db              # banco SQLite
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
| PATCH  | `/api/auth/me`           | Atualiza nome/e-mail/senha do usuário logado    |
| GET    | `/api/boardgames`        | Lista os jogos do usuário logado                |
| POST   | `/api/boardgames`        | Cadastra um jogo (`name` obrigatório)           |
| PUT    | `/api/boardgames/:id`    | Atualiza um jogo do usuário logado              |
| GET    | `/api/boardgames/random` | Sorteia um jogo do usuário logado               |
| DELETE | `/api/boardgames/:id`    | Remove um jogo do usuário logado                |
