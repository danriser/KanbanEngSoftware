import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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

export default router; 
