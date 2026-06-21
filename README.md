# Kanban EngSoftware

Este projeto é uma aplicação full-stack para gestão de tarefas em formato Kanban, com backend em Node.js/Express e frontend em React + Vite.

## Tecnologias

- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis
- Frontend: React, Vite
- Infra: Docker Compose

## Estrutura do projeto

- `backend/` — API REST e regras de negócio
- `frontend/` — interface do usuário
- `docker-compose.yml` — serviços de banco, cache, backend e frontend

## Pré-requisitos

- Node.js 22+
- npm ou pnpm
- Docker e Docker Compose

## Como rodar localmente

### 1. Clone o projeto e entre na pasta raiz

```bash
git clone <url-do-repositorio>
cd KanbanEngSoftware
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (ou use o exemplo disponível em `.env.example`) com as variáveis necessárias para o backend.

Exemplo:

```env
DATABASE_URL=postgresql://admin:adminpassword@localhost:5432/kanbancore
JWT_SECRET=chave_super_secreta
```

### 3. Suba os serviços com Docker

```bash
docker compose up --build
```

Isso irá iniciar:

- backend em `http://localhost:3333`
- frontend em `http://localhost:5173`
- PostgreSQL em `http://localhost:5432`
- Redis em `http://localhost:6379`

## Como rodar sem Docker

### Backend

```bash
cd backend
npm install
npx tsx watch src/index.ts
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Script auxiliar para rodar tudo

Na raiz do projeto, você pode usar:

```bash
npm run dev
```

Esse script inicia o backend com `npx tsx watch src/index.ts` e o frontend com `npm run dev`.

## Endpoints principais

- `GET /health` — verifica se a API está online
- `POST /users` — cadastro de usuário
- `POST /login` — autenticação
- `GET /projects` — lista projetos do usuário

## Observações

- O backend usa Prisma para acesso ao banco.
- O frontend consome a API através da variável `VITE_API_URL`.
- Para desenvolvimento, a API pode ser testada diretamente via Swagger, caso esteja configurada.
