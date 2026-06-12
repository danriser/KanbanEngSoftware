import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './middlewares/authMiddleware.js';


const router = Router();

// 1. Configura o pool de conexão nativo do Postgres apontando para o seu .env
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 2. Cria o adaptador do Prisma
const adapter = new PrismaPg(pool);

// 3. Injeta o adaptador no Prisma Client (A exigência da v7)
const prisma = new PrismaClient({ adapter });

// Validação estrita de entrada
const createUserSchema = z.object({
  name: z.string().min(2, 'O nome precisa ter pelo menos 2 caracteres'),
  email: z.string().email('Formato de e-mail inválido'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
});

router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = createUserSchema.parse(req.body);

    // Verifica colisão de e-mail
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      res.status(400).json({ error: 'Este e-mail já está em uso.' });
      return;
    }

    // Aplica o Salt e o Hash (Cost factor 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Persiste no banco de dados
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    // Retorna os dados com segurança (omitindo a senha criptografada)
    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });

} catch (error) {
    // Linha crucial para diagnóstico tático no terminal
    console.error('[Erro de Execução no Banco]:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  } 
}); 

// Schema estrito para o login
const loginSchema = z.object({
  email: z.string().email('Formato de e-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // 1. Busca o usuário pelo e-mail
    const user = await prisma.user.findUnique({ where: { email } });
    
    // 2. Se o usuário não existir, aborta com erro genérico
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // 3. Compara a senha enviada em plain text com o Hash do banco
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    // 4. Se a senha não bater, aborta com o MESMO erro genérico
    if (!isValidPassword) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // 5. Autenticação validada: Gera o Token de acesso
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET não está configurado no ambiente.");
    }

    const token = jwt.sign({ userId: user.id }, secret, {
      expiresIn: '7d', // O token expira em 7 dias
    });

    // 6. Retorna os dados do usuário com o token anexado
    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });

  } catch (error) {
    console.error('[Erro de Autenticação]:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Rota blindada para teste de perímetro
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'sucesso',
    message: 'Perímetro rompido com autorização. Catraca liberada.',
    userId: req.userId // Aqui comprovamos que o middleware extraiu o ID do token
  });
});

export default router; 
