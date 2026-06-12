// Carrega as variáveis de ambiente antes de qualquer outro import ser avaliado
import 'dotenv/config'; 

import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Rota de verificação de saúde restaurada
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Kanban API operacional e aguardando comandos.' });
});

// Pluga as rotas do arquivo separado
app.use(routes);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Servidor] Executando de forma estável em http://127.0.0.1:${PORT}`);
});