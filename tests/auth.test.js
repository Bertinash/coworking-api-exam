const request = require('supertest');
const app = require('../src/app');
const { connect, clearDatabase, closeDatabase } = require('./helpers/db');
const { registerAdmin, registerTenant, bearer } = require('./helpers/auth');

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

describe('GET /', () => {
  it('reports the API is running', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Coworking API is running' });
  });
});

describe('POST /api/auth/register', () => {
  it('registers a tenant by default and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Tara', email: 'tara@cowork.io', password: 'Secret123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: 'tara@cowork.io', role: 'tenant' });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('registers an admin when role is admin', async () => {
    const { user } = await registerAdmin();
    expect(user.role).toBe('admin');
  });

  it('rejects a duplicate email (400)', async () => {
    await registerTenant();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Again', email: 'tara@cowork.io', password: 'Secret123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid data via model validation', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short', email: 'not-an-email', password: '123' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await registerTenant();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tara@cowork.io', password: 'Secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('tara@cowork.io');
  });

  it('rejects a wrong password (401)', async () => {
    await registerTenant();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tara@cowork.io', password: 'wrong-pass' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@cowork.io', password: 'Secret123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the profile with plan and extras balance', async () => {
    const { token } = await registerTenant();
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'tara@cowork.io', extrasBalance: 0 });
    expect(res.body.user.plan).toMatchObject({ planName: 'hot_desk', status: 'inactive' });
  });

  it('requires a token (401)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token (401)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
