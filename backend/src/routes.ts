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
  wipLimit: z.number().int().nullable().optional(), // Limite de trabalho em progresso, opcional e pode ser nulo
});

router.post('/columns', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    
    // Extraindo o order do corpo da requisição
    const { name, boardId, order, wipLimit } = createColumnSchema.parse(req.body);

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
      data: { name, boardId, order, wipLimit: wipLimit ?? null } // Converte undefined para null, se necessário
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


// Validação do parâmetro de URL
const boardParamSchema = z.object({
  id: z.string().uuid('ID do quadro inválido'),
});


router.put('/projects/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // 🚨 A CORREÇÃO ESTÁ AQUI: Forçamos o TypeScript a assumir que é uma string
    const id = req.params.id as string;
    
    const { name, description } = req.body; 

    const project = await prisma.project.update({
      where: { id: id }, // Passamos a variável limpa para o Prisma
      data: { 
        name, 
        description 
      }
    });

    res.status(200).json({ status: 'sucesso', project });
  } catch (error) {
    console.error('[Erro na Atualização do Projeto]:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar o projeto.' });
  }
});

router.delete('/boards/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: boardId } = boardParamSchema.parse(req.params);

    // 1. Opcional, mas recomendado: verificar se o quadro existe e se o usuário tem acesso
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        project: { members: { some: { userId: userId } } }
      }
    });

    if (!board) {
      res.status(403).json({ error: 'Acesso negado ou quadro não encontrado.' });
      return;
    }

// 2. Operação destrutiva em Cascata (Transação segura)
    await prisma.$transaction([
      // Passo A: Limpa os cartões
      prisma.card.deleteMany({
        where: { column: { boardId: boardId } }
      }),
      
      // Passo B: Limpa as colunas
      prisma.column.deleteMany({
        where: { boardId: boardId }
      }),

      // Passo C: Limpa as raias
      prisma.swimlane.deleteMany({
        where: { boardId: boardId }
      }),

      // Passo D: Deleta o quadro vazio
      prisma.board.delete({
        where: { id: boardId }
      })
    ]);

    // 3. Resposta JSON limpa, que vai evitar o erro de DOCTYPE no frontend
    res.status(200).json({ status: 'sucesso', message: 'Quadro deletado com sucesso.' });

  } catch (error) {
    console.error('[Erro na Deleção do Quadro]:', error);
    res.status(500).json({ error: 'Erro interno ao excluir o quadro.' });
  }
});


// Super Rota de Leitura: Retorna o Quadro com Colunas e Cartões aninhados
router.get('/boards/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: boardId } = boardParamSchema.parse(req.params);

    // Consulta Avançada: Une segurança e agregação de dados em um único movimento
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        project: {
          members: {
            some: {
              userId: userId
            }
          }
        }
      },
      include: {

swimlanes: {
          orderBy: {
            order: 'asc'
          }
        },

        columns: {
          orderBy: {
            order: 'asc' // Garante o posicionamento correto na tela (Backlog -> Em Andamento -> Concluído)
          },
          include: {
            cards: {
              orderBy: {
                createdAt: 'asc' // Organiza os cartões dos mais antigos aos mais recentes dentro da coluna
              }
            }
          }
        }
      }
    });

    // Se a consulta retornar null, significa que o quadro não existe OU o utilizador não tem acesso
    if (!board) {
      res.status(403).json({ error: 'Acesso negado ou recurso não encontrado.' });
      return;
    }

    res.status(200).json({
      status: 'sucesso',
      board
    });

  } catch (error) {
    console.error('[Erro na Super Rota de Leitura]:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});


// ==========================================
// 3. MOVIMENTAÇÃO DE CARTÕES (PATCH)
// ==========================================
const moveCardParamSchema = z.object({
  id: z.string().uuid('ID do cartão inválido'),
});

const moveCardBodySchema = z.object({
  columnId: z.string().uuid('ID da nova coluna é obrigatório'),
  swimlaneId: z.string().uuid('ID da raia inválido').nullable().optional(),
});


// Schemas de Validação para Atualização e Remoção
const updateCardBodySchema = z.object({
  name: z.string().min(1, 'O nome não pode ser vazio').optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),

  dueDate: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
});

const cardParamSchema = z.object({
  id: z.string().uuid('ID do cartão inválido'),
});

// 1. EDIÇÃO DE CONTEÚDO DO CARTÃO (PUT)
router.put('/cards/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: cardId } = cardParamSchema.parse(req.params);
    const updateData = updateCardBodySchema.parse(req.body);

    // Mapeamento para validação de perímetro
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { column: { include: { board: true } } }
    });

    if (!card) {
      res.status(404).json({ error: 'Cartão não localizado.' });
      return;
    }

    // Defesa Preventiva
    const isMember = await prisma.projectMember.findFirst({
      where: { projectId: card.column.board.projectId, userId }
    });

    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Utilizador não autorizado.' });
      return;
    }

    // Tratamento específico para o campo description (evitar conflito undefined vs null)
    // Constrói o payload de atualização cirurgicamente, ignorando o que for undefined
    const dataToUpdate: Record<string, any> = {};

    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.priority !== undefined) dataToUpdate.priority = updateData.priority;
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description;

    if (updateData.dueDate !== undefined) {
      dataToUpdate.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }
    
    if (updateData.responsible !== undefined) dataToUpdate.responsible = updateData.responsible;
    // ...



    const updatedCard = await prisma.card.update({
      where: { id: cardId },
      data: dataToUpdate,
    });

    res.status(200).json({ message: 'Cartão atualizado com sucesso.', card: updatedCard });
  } catch (error) {
    console.error('[Erro na Atualização do Cartão]:', error);
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues }); return; }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// 2. REMOÇÃO DEFINITIVA DO CARTÃO (DELETE)
router.delete('/cards/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: cardId } = cardParamSchema.parse(req.params);

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { column: { include: { board: true } } }
    });

    if (!card) {
      res.status(404).json({ error: 'Cartão não localizado.' });
      return;
    }

    // Defesa Preventiva
    const isMember = await prisma.projectMember.findFirst({
      where: { projectId: card.column.board.projectId, userId }
    });

    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Utilizador não autorizado.' });
      return;
    }

    // Execução da exclusão no banco
    await prisma.card.delete({
      where: { id: cardId }
    });

    res.status(200).json({ message: 'Cartão removido com sucesso do painel.' });
  } catch (error) {
    console.error('[Erro na Remoção do Cartão]:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});


router.patch('/cards/:id/move', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: cardId } = moveCardParamSchema.parse(req.params);
    const { columnId: newColumnId, swimlaneId: newSwimlaneId } = moveCardBodySchema.parse(req.body);

    // 1. Mapeamento de Terreno
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { column: { include: { board: true } } }
    });

    if (!card) {
      res.status(404).json({ error: 'Cartão não localizado no perímetro.' }); return;
    }

    const projectId = card.column.board.projectId;
    const oldColumnId = card.columnId;

    // 2. Defesa Preventiva: Pertencimento ao projeto
    const isMember = await prisma.projectMember.findFirst({ where: { projectId, userId } });
    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Perfil não autorizado neste projeto.' }); return;
    }

    // 3. Defesa Estrutural: Validação de Coluna e WIP Limit
    const targetColumn = await prisma.column.findUnique({ 
      where: { id: newColumnId }, include: { cards: true } 
    });

    if (!targetColumn || targetColumn.boardId !== card.column.boardId) {
      res.status(400).json({ error: 'Operação inválida: A coluna de destino pertence a outro quadro.' }); return;
    }

    if (oldColumnId !== newColumnId && targetColumn.wipLimit !== null && targetColumn.cards.length >= targetColumn.wipLimit) {
      res.status(400).json({ 
        error: `Movimentação bloqueada: A coluna atingiu o limite de trabalho em progresso (WIP Limit: ${targetColumn.wipLimit}).` 
      });
      return;
    }

    // 4. Defesa Estrutural Adicional: Validação da Raia (Swimlane)
    if (newSwimlaneId) {
      const targetSwimlane = await prisma.swimlane.findUnique({ where: { id: newSwimlaneId } });
      if (!targetSwimlane || targetSwimlane.boardId !== card.column.boardId) {
        res.status(400).json({ error: 'Operação inválida: A raia de destino pertence a outro quadro.' }); return;
      }
    }

    // 5. Execução Relacional: Transação ACID
    const [updatedCard, movementLog] = await prisma.$transaction([
      prisma.card.update({
        where: { id: cardId },
        data: { 
          columnId: newColumnId,
          ...(newSwimlaneId !== undefined && { swimlaneId: newSwimlaneId }) // Injeta a raia se ela foi enviada
        }
      }),
      prisma.cardMovement.create({
        data: {
          cardId: cardId,
          fromColumnId: oldColumnId, 
          toColumnId: newColumnId    
        }
      })
    ]);

    res.status(200).json({ message: 'Cartão reposicionado e auditoria registrada com sucesso.', card: updatedCard, log: movementLog });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues }); return; }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});


// ==========================================
// 4. GESTÃO DE RAIAS (SWIMLANES)
// ==========================================

// --- SCHEMAS DE VALIDAÇÃO ---
const createSwimlaneSchema = z.object({
  name: z.string().min(1, 'O nome da raia é obrigatório'),
  boardId: z.string().uuid('ID do quadro é obrigatório'),
  order: z.number().int('A posição (ordem) da raia é obrigatória'), // Exigência de ordenação
});

const swimlaneParamSchema = z.object({
  id: z.string().uuid('ID da raia inválido'),
});

const updateSwimlaneSchema = z.object({
  name: z.string().min(1, 'O nome da raia não pode ser vazio'),
});

// --- US-07: CRIAR RAIA (POST) ---
router.post('/swimlanes', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { name, boardId, order } = createSwimlaneSchema.parse(req.body);

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      res.status(404).json({ error: 'Quadro não localizado.' }); return;
    }

    const isMember = await prisma.projectMember.findFirst({ where: { projectId: board.projectId, userId } });
    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Perfil não autorizado.' }); return;
    }

    const newSwimlane = await prisma.swimlane.create({
      data: { name, boardId, order }
    });

    res.status(201).json({ message: 'Raia estrutural criada com sucesso.', swimlane: newSwimlane });
  } catch (error) {
    console.error('[Erro na Criação da Raia]:', error);
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues }); return; }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// --- US-09: ATUALIZAR RAIA (PUT) ---
router.put('/swimlanes/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: swimlaneId } = swimlaneParamSchema.parse(req.params);
    const { name } = updateSwimlaneSchema.parse(req.body);

    const swimlane = await prisma.swimlane.findUnique({
      where: { id: swimlaneId }, include: { board: true }
    });

    if (!swimlane) {
      res.status(404).json({ error: 'Raia não localizada no perímetro.' }); return;
    }

    const isMember = await prisma.projectMember.findFirst({
      where: { projectId: swimlane.board.projectId, userId }
    });

    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Perfil não autorizado.' }); return;
    }

    const updatedSwimlane = await prisma.swimlane.update({
      where: { id: swimlaneId }, data: { name }
    });

    res.status(200).json({ message: 'Raia atualizada com sucesso.', swimlane: updatedSwimlane });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues }); return; }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// --- US-10: EXCLUIR RAIA (DELETE) ---
router.delete('/swimlanes/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: swimlaneId } = swimlaneParamSchema.parse(req.params);

    const swimlane = await prisma.swimlane.findUnique({
      where: { id: swimlaneId }, include: { board: true }
    });

    if (!swimlane) {
      res.status(404).json({ error: 'Raia não localizada no perímetro.' }); return;
    }

    const isMember = await prisma.projectMember.findFirst({
      where: { projectId: swimlane.board.projectId, userId }
    });

    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Perfil não autorizado.' }); return;
    }

    await prisma.swimlane.delete({ where: { id: swimlaneId } });

    res.status(200).json({ message: 'Raia removida com sucesso da estrutura do quadro.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});


// ==========================================
// 5. MOTOR ANALÍTICO E MÉTRICAS (GET)
// ==========================================
const metricsParamSchema = z.object({
  id: z.string().uuid('ID do quadro inválido'),
});

router.get('/boards/:id/metrics', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id: boardId } = metricsParamSchema.parse(req.params);

    // 1. Defesa Preventiva e Mapeamento
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: { orderBy: { order: 'asc' } }
      }
    });

    if (!board) {
      res.status(404).json({ error: 'Quadro não localizado.' }); return;
    }

    const isMember = await prisma.projectMember.findFirst({
      where: { projectId: board.projectId, userId }
    });

    if (!isMember) {
      res.status(403).json({ error: 'Acesso negado: Perfil não autorizado.' }); return;
    }

// 2. Identificação das Colunas-Chave
    // Assumimos que a primeira coluna é o Backlog, a segunda é o Início do Trabalho e a última é o Concluído
    const columns = board.columns;
    if (columns.length < 3) {
      res.status(400).json({ error: 'O quadro precisa de pelo menos 3 colunas para gerar métricas precisas.' }); return;
    }

    // Asserção estrita (!) para garantir ao compilador que os índices existem
    const doingColumnId = columns[1]!.id; 
    const doneColumnId = columns[columns.length - 1]!.id;

    // 3. Extração Otimizada (Evitando N+1 queries)
    const boardCards = await prisma.card.findMany({
      where: { column: { boardId: boardId } },
      select: { id: true, createdAt: true }
    });
    
    const cardIds = boardCards.map(c => c.id);

    const allMovements = await prisma.cardMovement.findMany({
      where: { cardId: { in: cardIds } },
      orderBy: { timestamp: 'asc' } // Do mais antigo para o mais novo
    });

    // 4. O Motor Matemático
    let totalCycleTimeMs = 0;
    let totalLeadTimeMs = 0;
    let completedCardsCount = 0;

    for (const card of boardCards) {
      const cardLogs = allMovements.filter(m => m.cardId === card.id);
      
      // Encontra a última vez que o cartão entrou na coluna final
      const doneLog = cardLogs.filter(m => m.toColumnId === doneColumnId).pop(); 

      if (doneLog) {
        completedCardsCount++;
        const doneTime = doneLog.timestamp.getTime();

        // Lead Time: Desde a criação física do cartão até a conclusão
        totalLeadTimeMs += (doneTime - card.createdAt.getTime());

        // Cycle Time: Desde a entrada em "Fazendo" até a conclusão
        const doingLog = cardLogs.find(m => m.toColumnId === doingColumnId);
        const doingTime = doingLog ? doingLog.timestamp.getTime() : card.createdAt.getTime();

        totalCycleTimeMs += (doneTime - doingTime);
      }
    }

    // 5. Consolidação e Formatação (Convertendo milissegundos para dias)
    const msInDay = 1000 * 60 * 60 * 24;
    const avgLeadTime = completedCardsCount > 0 ? (totalLeadTimeMs / completedCardsCount) / msInDay : 0;
    const avgCycleTime = completedCardsCount > 0 ? (totalCycleTimeMs / completedCardsCount) / msInDay : 0;

    res.status(200).json({
      message: 'Dashboard analítico gerado com sucesso.',
      metrics: {
        throughput: completedCardsCount,
        leadTimeDays: parseFloat(avgLeadTime.toFixed(2)),
        cycleTimeDays: parseFloat(avgCycleTime.toFixed(2))
      }
    });

  } catch (error) {
    console.error('[Erro no Motor Analítico]:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// 1. Rota para Atualizar o Projeto (Editar Nome)
router.put('/projects/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Adicionamos o "as string" para acalmar o TypeScript
    const idDoProjeto = req.params.id as string;
    const { name: novoNome } = req.body;

    const projetoAtualizado = await prisma.project.update({
      where: { id: idDoProjeto },
      data: { name: novoNome }
    });

    res.status(200).json(projetoAtualizado);
  } catch (error) {
    console.error('[Erro ao atualizar projeto]:', error);
    res.status(500).json({ error: 'Erro ao atualizar o projeto.' });
  }
});

// 2. Rota para Deletar o Projeto
router.delete('/projects/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const idDoProjeto = req.params.id as string;

    await prisma.project.delete({
      where: { id: idDoProjeto }
    });

    res.status(200).json({ message: 'Projeto deletado com sucesso.' });
  } catch (error) {
    console.error('[Erro ao deletar projeto]:', error);
    res.status(500).json({ error: 'Erro ao deletar o projeto.' });
  }
});

// 3. Rota para Buscar os Quadros e Cartões de um Projeto Específico
router.get('/projects/:id/boards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const idDoProjeto = req.params.id as string;

    const quadrosDoProjeto = await prisma.board.findMany({
      where: { projectId: idDoProjeto },
      include: { 
        columns: { 
          include: { cards: true } 
        } 
      }
    });

    res.status(200).json(quadrosDoProjeto);
  } catch (error) {
    console.error('[Erro ao buscar quadros do projeto]:', error);
    res.status(500).json({ error: 'Erro ao buscar os quadros do projeto.' });
  }
});


router.put('/projects/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Adicionamos o "as string" para acalmar o TypeScript
    const idDoProjeto = req.params.id as string;
    const { name: novoNome } = req.body;

    const projetoAtualizado = await prisma.project.update({
      where: { id: idDoProjeto },
      data: { name: novoNome }
    });

    res.status(200).json(projetoAtualizado);
  } catch (error) {
    console.error('[Erro ao atualizar projeto]:', error);
    res.status(500).json({ error: 'Erro ao atualizar o projeto.' });
  }
});

router.delete('/projects/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const idDoProjeto = req.params.id as string;

    await prisma.project.delete({
      where: { id: idDoProjeto }
    });

    res.status(200).json({ message: 'Projeto deletado com sucesso.' });
  } catch (error) {
    console.error('[Erro ao deletar projeto]:', error);
    res.status(500).json({ error: 'Erro ao deletar o projeto.' });
  }
});

router.get('/projects/:id/boards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const idDoProjeto = req.params.id as string;

    const quadrosDoProjeto = await prisma.board.findMany({
      where: { projectId: idDoProjeto },
      include: { 
        columns: { 
          include: { cards: true } 
        } 
      }
    });

    res.status(200).json(quadrosDoProjeto);
  } catch (error) {
    console.error('[Erro ao buscar quadros do projeto]:', error);
    res.status(500).json({ error: 'Erro ao buscar os quadros do projeto.' });
  }
});


export default router; 