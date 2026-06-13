import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './middlewares/authMiddleware.js';


const router = Router();

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

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

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET não está configurado no ambiente.");
    }

    const token = jwt.sign({ userId: user.id }, secret, {
      expiresIn: '7d', // O token expira em 7 dias
    });

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





// Validação estrita para o escopo do Projeto
const createProjectSchema = z.object({
  name: z.string().min(2, 'O nome do projeto precisa ter pelo menos 2 caracteres'),
  description: z.string().optional(), // A descrição não é obrigatória
});

// Criação de Projeto (Rota Protegida)
router.post('/projects', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // O TypeScript exige a afirmação de que o userId existe, embora o middleware já garanta isso
    const userId = req.userId as string;

    const { name, description } = createProjectSchema.parse(req.body);

    const newProject = await prisma.project.create({
      data: {
        name,
        description: description ?? null, // <-- Faz a conversão automática de undefined para null
        members: {
          create: {
            user: { connect: { id: userId } }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Projeto operacional iniciado com sucesso.',
      project: newProject
    });

  } catch (error) {
    console.error('[Erro na Criação do Projeto]:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});


router.get('/projects', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    // Consulta relacional: busca projetos que contenham o usuário na tabela de membros
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // Entrega os projetos mais recentes primeiro
      }
    });

    res.status(200).json({
      status: 'sucesso',
      count: projects.length,
      projects
    });

  } catch (error) {
    console.error('[Erro na Listagem de Projetos]:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'sucesso',
    message: 'Perímetro rompido com autorização. Catraca liberada.',
    userId: req.userId // Aqui comprovamos que o middleware extraiu o ID do token
  });
});

export default router; 