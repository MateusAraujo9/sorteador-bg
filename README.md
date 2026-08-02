# 🎲 Sorteador de Boardgames

Cadastre sua coleção de jogos de tabuleiro e deixe a sorte escolher o próximo jogo da mesa.

## Funcionalidades

- **Cadastrar** — registre jogos com nome, número de jogadores, duração, categoria, idade mínima e imagem.
- **Coleção** — veja todos os jogos cadastrados, com estatísticas (total, categorias, duração média) e remoção individual.
- **Sortear** — role os dados e receba um bilhete de sorteio com o jogo escolhido aleatoriamente.

## Stack

- **Backend**: Node.js + Express, em estrutura de camadas (`routes` → `controllers` → `repository`)
- **Persistência**: SQLite via `node:sqlite` (nativo do Node, sem dependência externa)
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

| Método | Rota                     | Descrição                              |
|--------|--------------------------|-----------------------------------------|
| GET    | `/api/boardgames`        | Lista todos os jogos                    |
| POST   | `/api/boardgames`        | Cadastra um jogo (`name` obrigatório)   |
| GET    | `/api/boardgames/random` | Sorteia um jogo aleatório               |
| DELETE | `/api/boardgames/:id`    | Remove um jogo                          |
