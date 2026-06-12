import { type Request, type Response, type NextFunction } from 'express';import jwt from 'jsonwebtoken';


declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface TokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Acesso negado: Token não fornecido.' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Acesso negado: Formato de token inválido.' });
    return;
  }

const token = parts[1] as string;

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("Falha Crítica: JWT_SECRET ausente no ambiente.");
    }

 
    // Se o token foi adulterado ou expirou, a função .verify() lança um erro automaticamente
const decoded = jwt.verify(token, secret as string) as unknown as TokenPayload;
    req.userId = decoded.userId;

    // Repassa o controle para a rota de destino (o Kanban, os Projetos, etc.)
    return next();

  } catch (error) {
    // Intercepta adulterações ou expiração sem vazar detalhes da infraestrutura
    res.status(401).json({ error: 'Acesso negado: Token inválido ou expirado.' });
    return;
  }
};