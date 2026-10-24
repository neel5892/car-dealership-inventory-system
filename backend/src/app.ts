import 'dotenv/config';
import express from 'express';
import db from './database';
import authRoutes from './auth/authRoutes';
import {
  authenticateToken,
  requireAdmin
} from './auth/authMiddleware';

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use('/api/auth', authRoutes);

app.use('/api/vehicles', authenticateToken);

interface VehicleInput {
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

function isValidVehicle(vehicle: Partial<VehicleInput>): boolean {
  return (
    typeof vehicle.make === 'string' &&
    vehicle.make.trim().length > 0 &&
    typeof vehicle.model === 'string' &&
    vehicle.model.trim().length > 0 &&
    typeof vehicle.category === 'string' &&
    vehicle.category.trim().length > 0 &&
    typeof vehicle.price === 'number' &&
    Number.isFinite(vehicle.price) &&
    vehicle.price >= 0 &&
    typeof vehicle.quantity === 'number' &&
    Number.isInteger(vehicle.quantity) &&
    vehicle.quantity >= 0
  );
}

app.get('/api/vehicles', (_req, res) => {
  return res.status(200).json(
    db.prepare('SELECT * FROM vehicles').all()
  );
});

app.post('/api/vehicles', (req, res) => {
  const vehicle = req.body as Partial<VehicleInput>;

  if (!isValidVehicle(vehicle)) {
    return res.status(400).json({ error: 'Invalid vehicle data' });
  }

  const result = db.prepare(`
    INSERT INTO vehicles (make, model, category, price, quantity)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    vehicle.make!.trim(),
    vehicle.model!.trim(),
    vehicle.category!.trim(),
    vehicle.price,
    vehicle.quantity
  );

  return res.status(201).json(
    db.prepare('SELECT * FROM vehicles WHERE id = ?')
      .get(result.lastInsertRowid)
  );
});

app.get('/api/vehicles/search', (req, res) => {
  const { make, model, category, minPrice, maxPrice } = req.query;
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (typeof make === 'string') {
    conditions.push('make LIKE ?');
    values.push(`%${make}%`);
  }

  if (typeof model === 'string') {
    conditions.push('model LIKE ?');
    values.push(`%${model}%`);
  }

  if (typeof category === 'string') {
    conditions.push('category LIKE ?');
    values.push(`%${category}%`);
  }

  if (minPrice !== undefined) {
    const minimum = Number(minPrice);

    if (!Number.isFinite(minimum) || minimum < 0) {
      return res.status(400).json({ error: 'Invalid minimum price' });
    }

    conditions.push('price >= ?');
    values.push(minimum);
  }

  if (maxPrice !== undefined) {
    const maximum = Number(maxPrice);

    if (!Number.isFinite(maximum) || maximum < 0) {
      return res.status(400).json({ error: 'Invalid maximum price' });
    }

    conditions.push('price <= ?');
    values.push(maximum);
  }

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    Number(minPrice) > Number(maxPrice)
  ) {
    return res.status(400).json({ error: 'Invalid price range' });
  }

  const sql = 'SELECT * FROM vehicles' +
    (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '');

  return res.status(200).json(db.prepare(sql).all(...values));
});

app.put('/api/vehicles/:id', (req, res) => {
  const id = Number(req.params.id);
  const vehicle = req.body as Partial<VehicleInput>;

  if (!Number.isInteger(id) || id <= 0 || !isValidVehicle(vehicle)) {
    return res.status(400).json({ error: 'Invalid vehicle data' });
  }

  const result = db.prepare(`
    UPDATE vehicles
    SET make = ?, model = ?, category = ?, price = ?, quantity = ?
    WHERE id = ?
  `).run(
    vehicle.make!.trim(),
    vehicle.model!.trim(),
    vehicle.category!.trim(),
    vehicle.price,
    vehicle.quantity,
    id
  );

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  return res.status(200).json(
    db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
  );
});

app.delete('/api/vehicles/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid vehicle ID' });
  }

  const result = db.prepare(
    'DELETE FROM vehicles WHERE id = ?'
  ).run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  return res.status(204).send();
});

app.post('/api/vehicles/:id/purchase', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid vehicle ID' });
  }

  const result = db.prepare(`
    UPDATE vehicles
    SET quantity = quantity - 1
    WHERE id = ? AND quantity > 0
  `).run(id);

  if (result.changes === 0) {
    const vehicle = db.prepare(
      'SELECT id FROM vehicles WHERE id = ?'
    ).get(id);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.status(409).json({ error: 'Vehicle is out of stock' });
  }

  return res.status(200).json(
    db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
  );
});

app.post('/api/vehicles/:id/restock', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { quantity } = req.body;

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      error: 'A valid vehicle ID and positive integer quantity are required'
    });
  }

  const result = db.prepare(`
    UPDATE vehicles
    SET quantity = quantity + ?
    WHERE id = ?
  `).run(quantity, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  return res.status(200).json(
    db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
  );
});

export default app;
