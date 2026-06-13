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


// ==========================================
// 1. QUADROS (BOARDS)
// ==========================================
const createBoardSchema = z.object({
  name: z.string().min(1, 'O nome do quadro é obrigatório'),
  projectId: z.string().uuid('ID do projeto é obrigatório'),
});

router.post('/boards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { name, projectId } = createBoardSchema.parse(req.body);

    // Defesa de Perímetro
    const isMember = await prisma.projectMember.findFirst({ where: { projectId, userId } });
    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Você não pertence a este projeto.' });
      return;
    }

    const newBoard = await prisma.board.create({
      data: { name, projectId },
    });

    res.status(201).json({ message: 'Quadro operacional criado.', board: newBoard });
  } catch (error) {
    console.error('[Erro na Criação do Quadro]:', error);
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues }); return; }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// ==========================================
// 2. COLUNAS (COLUMNS)
// ==========================================
const createColumnSchema = z.object({
  name: z.string().min(1, 'O nome da coluna é obrigatório'),
  boardId: z.string().uuid('ID do quadro é obrigatório'),
  order: z.number().int('A posição (ordem) da coluna é obrigatória'), // Exigência de ordenação
});

router.post('/columns', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    
    // Extraindo o order do corpo da requisição
    const { name, boardId, order } = createColumnSchema.parse(req.body);

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      res.status(404).json({ error: 'Quadro não encontrado.' });
      return;
    }

    const isMember = await prisma.projectMember.findFirst({ where: { projectId: board.projectId, userId } });
    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Você não pertence a este projeto.' });
      return;
    }

    // Injetando o order na gravação do banco
    const newColumn = await prisma.column.create({
      data: { name, boardId, order },
    });

    res.status(201).json({ message: 'Coluna criada com sucesso.', column: newColumn });
  } catch (error) {
    console.error('[Erro na Criação da Coluna]:', error);
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues }); return; }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
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

const createCardSchema = z.object({
  name: z.string().min(1, 'O nome do cartão é obrigatório'),
  description: z.string().optional(),
  projectId: z.string().uuid('ID do projeto é obrigatório para validação de segurança'),
  columnId: z.string().uuid('ID da coluna é obrigatório para posicionar o cartão'),
});

// Criação de Cartão (Rota Protegida com Verificação de Perímetro)
router.post('/cards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    
    // Extraímos o 'name' em vez de 'title', e adicionamos o 'columnId'
    const { name, description, projectId, columnId } = createCardSchema.parse(req.body);

    // 1. Defesa Preventiva: Verifica se o usuário tem autorização no projeto como um todo
    const isMember = await prisma.projectMember.findFirst({
      where: {
        projectId: projectId,
        userId: userId,
      },
    });

    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Você não tem permissão para alterar este projeto.' });
      return;
    }

    // 2. Persistência: Grava o cartão usando as chaves exatas do seu schema.prisma
    const newCard = await prisma.card.create({
      data: {
        name, 
        description: description ?? null,
        columnId, // A chave estrangeira real que a sua tabela exige
      },
    });

    res.status(201).json({
      message: 'Cartão operacional criado com sucesso.',
      card: newCard,
    });

  } catch (error) {
    console.error('[Erro na Criação do Cartão]:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
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