
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import db from '../src/database';

const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Password123!'
};

const adminUser = {
  name: 'Admin User',
  email: 'admin@example.com',
  password: 'AdminPassword123!'
};

let userToken = '';
let adminToken = '';

async function registerAndLogin(
  name: string,
  email: string,
  password: string
): Promise<string> {
  await request(app)
    .post('/api/auth/register')
    .send({ name, email, password })
    .expect(201);

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return response.body.token;
}

async function createVehicle(
  token: string,
  quantity = 5
) {
  return request(app)
    .post('/api/vehicles')
    .set('Authorization', `Bearer ${token}`)
    .send({
      make: 'Toyota',
      model: 'Camry',
      category: 'Sedan',
      price: 25000,
      quantity
    });
}

describe('Car Dealership API', () => {
  beforeEach(async () => {
    db.prepare('DELETE FROM vehicles').run();
    db.prepare('DELETE FROM users').run();

    userToken = await registerAndLogin(
      testUser.name,
      testUser.email,
      testUser.password
    );

    // Registration never grants admin privileges. For this test only,
    // promote the account directly in the database.
    await registerAndLogin(
      adminUser.name,
      adminUser.email,
      adminUser.password
    );

    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?")
      .run(adminUser.email);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      })
      .expect(200);

    adminToken = loginResponse.body.token;
  });

  it('should return an empty vehicle list', async () => {
    const response = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('should add a vehicle', async () => {
    const response = await createVehicle(userToken);

    expect(response.status).toBe(201);
    expect(response.body.make).toBe('Toyota');
    expect(response.body.quantity).toBe(5);
  });

  it('should reject a negative price', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        make: 'Toyota',
        model: 'Camry',
        category: 'Sedan',
        price: -1,
        quantity: 5
      });

    expect(response.status).toBe(400);
  });

  it('should reject a negative quantity', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        make: 'Toyota',
        model: 'Camry',
        category: 'Sedan',
        price: 25000,
        quantity: -1
      });

    expect(response.status).toBe(400);
  });

  it('should search vehicles by make', async () => {
    await createVehicle(userToken);

    const response = await request(app)
      .get('/api/vehicles/search?make=toyota')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].make).toBe('Toyota');
  });

  it('should search vehicles by price range', async () => {
    await createVehicle(userToken);

    const response = await request(app)
      .get('/api/vehicles/search?minPrice=21000&maxPrice=30000')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].make).toBe('Toyota');
  });

  it('should reject an invalid price range', async () => {
    const response = await request(app)
      .get('/api/vehicles/search?minPrice=30000&maxPrice=10000')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(400);
  });

  it('should update a vehicle', async () => {
    const created = await createVehicle(userToken);

    const response = await request(app)
      .put(`/api/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        make: 'Toyota',
        model: 'Camry',
        category: 'Sedan',
        price: 27000,
        quantity: 4
      });

    expect(response.status).toBe(200);
    expect(response.body.price).toBe(27000);
    expect(response.body.quantity).toBe(4);
  });

  it('should return 404 for a nonexistent vehicle update', async () => {
    const response = await request(app)
      .put('/api/vehicles/999')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        make: 'Toyota',
        model: 'Camry',
        category: 'Sedan',
        price: 25000,
        quantity: 5
      });

    expect(response.status).toBe(404);
  });

  it('should purchase a vehicle and decrease stock', async () => {
    const created = await createVehicle(userToken, 2);

    const response = await request(app)
      .post(`/api/vehicles/${created.body.id}/purchase`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.quantity).toBe(1);
  });

  it('should reject a purchase when stock is zero', async () => {
    const created = await createVehicle(userToken, 0);

    const response = await request(app)
      .post(`/api/vehicles/${created.body.id}/purchase`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Vehicle is out of stock');
  });

  it('should return 404 when purchasing a nonexistent vehicle', async () => {
    const response = await request(app)
      .post('/api/vehicles/999/purchase')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(404);
  });

  it('should allow an admin to restock a vehicle', async () => {
    const created = await createVehicle(userToken, 3);

    const response = await request(app)
      .post(`/api/vehicles/${created.body.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5 });

    expect(response.status).toBe(200);
    expect(response.body.quantity).toBe(8);
  });

  it('should reject restocking by a regular user', async () => {
    const created = await createVehicle(userToken, 3);

    const response = await request(app)
      .post(`/api/vehicles/${created.body.id}/restock`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 5 });

    expect(response.status).toBe(403);
  });

  it('should reject a restock quantity of zero', async () => {
    const created = await createVehicle(userToken, 3);

    const response = await request(app)
      .post(`/api/vehicles/${created.body.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 0 });

    expect(response.status).toBe(400);
  });

  it('should return 404 when restocking a nonexistent vehicle', async () => {
    const response = await request(app)
      .post('/api/vehicles/999/restock')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5 });

    expect(response.status).toBe(404);
  });

  it('should reject vehicle access without a token', async () => {
    const response = await request(app).get('/api/vehicles');

    expect(response.status).toBe(401);
  });

  it('should reject login with an incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword!'
      });

    expect(response.status).toBe(401);
  });

  it('should reject registration with a duplicate email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(response.status).toBe(409);
  });

  it('should allow an admin to delete a vehicle', async () => {
    const created = await createVehicle(userToken);

    const response = await request(app)
      .delete(`/api/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(204);
  });

  it('should reject vehicle deletion by a regular user', async () => {
    const created = await createVehicle(userToken);

    const response = await request(app)
      .delete(`/api/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
  });
});
