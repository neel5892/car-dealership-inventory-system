
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'user' | 'admin';
  };
}

interface TokenPayload extends JwtPayload {
  id: number;
  email: string;
  role: 'user' | 'admin';
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === 'string') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    const payload = decoded as unknown as TokenPayload;

    if (
      typeof payload.id !== 'number' ||
      !Number.isInteger(payload.id) ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'user' && payload.role !== 'admin')
    ) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }

  next();
}
