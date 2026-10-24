
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        error: 'Name and email are required; password must be at least 8 characters'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'user')
    `).run(name.trim(), normalizedEmail, passwordHash);

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: Number(result.lastInsertRowid),
        name: name.trim(),
        email: normalizedEmail,
        role: 'user'
      }
    });
  } catch {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const user = db.prepare(`
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE email = ?
    `).get(email.trim().toLowerCase()) as
      | {
          id: number;
          name: string;
          email: string;
          password_hash: string;
          role: 'user' | 'admin';
        }
      | undefined;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch {
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
