const request = require('supertest');
const app = require('../src/app');
const { connect, clearDatabase, closeDatabase } = require('./helpers/db');
const { registerAdmin, registerTenant, bearer } = require('./helpers/auth');

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

const createExtra = (adminToken, overrides = {}) =>
  request(app)
    .post('/api/extras')
    .set('Authorization', bearer(adminToken))
    .send({
      name: 'Flat White',
      category: 'coffee',
      price: 3.5,
      description: 'Double shot',
      ...overrides
    });

// Admin adds an extra, tenant buys `quantity` of it. Returns the tenant token.
const buy = async (quantity, price = 3.5) => {
  const { token: adminToken } = await registerAdmin();
  const extraRes = await createExtra(adminToken, { price });
  const { token } = await registerTenant();
  await request(app)
    .post('/api/extras/purchase')
    .set('Authorization', bearer(token))
    .send({ extraId: extraRes.body.extra._id, quantity });
  return token;
};

describe('POST /api/extras', () => {
  it('lets an admin add an extra', async () => {
    const { token } = await registerAdmin();
    const res = await createExtra(token);

    expect(res.status).toBe(201);
    expect(res.body.extra).toMatchObject({
      name: 'Flat White',
      category: 'coffee',
      price: 3.5,
      isAvailable: true
    });
  });

  it('forbids a tenant (403)', async () => {
    const { token } = await registerTenant();
    const res = await createExtra(token);
    expect(res.status).toBe(403);
  });

  it('rejects missing required fields', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', bearer(token))
      .send({ category: 'printing' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/extras', () => {
  it('lists extras for any authenticated user', async () => {
    const { token: adminToken } = await registerAdmin();
    await createExtra(adminToken, { name: 'Espresso' });
    await createExtra(adminToken, { name: 'A4 Print', category: 'printing', price: 0.1 });

    const { token } = await registerTenant();
    const res = await request(app).get('/api/extras').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get('/api/extras');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/extras/purchase', () => {
  it('adds the cost to the tenant balance', async () => {
    const { token: adminToken } = await registerAdmin();
    const extraRes = await createExtra(adminToken, { price: 3.5 });
    const { token } = await registerTenant();

    const res = await request(app)
      .post('/api/extras/purchase')
      .set('Authorization', bearer(token))
      .send({ extraId: extraRes.body.extra._id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.extrasBalance).toBe(7);
  });

  it('rejects a missing extraId (400)', async () => {
    const { token } = await registerTenant();
    const res = await request(app)
      .post('/api/extras/purchase')
      .set('Authorization', bearer(token))
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive quantity (400)', async () => {
    const { token: adminToken } = await registerAdmin();
    const extraRes = await createExtra(adminToken);
    const { token } = await registerTenant();
    const res = await request(app)
      .post('/api/extras/purchase')
      .set('Authorization', bearer(token))
      .send({ extraId: extraRes.body.extra._id, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unavailable extra', async () => {
    const { token: adminToken } = await registerAdmin();
    const extraRes = await createExtra(adminToken, { isAvailable: false });
    const { token } = await registerTenant();
    const res = await request(app)
      .post('/api/extras/purchase')
      .set('Authorization', bearer(token))
      .send({ extraId: extraRes.body.extra._id });
    expect(res.status).toBe(404);
  });

  it('forbids an admin (403)', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .post('/api/extras/purchase')
      .set('Authorization', bearer(token))
      .send({ extraId: '665100000000000000000000' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/extras/pay', () => {
  it('applies a partial payment to the ledger', async () => {
    const token = await buy(2); // balance 7
    const res = await request(app)
      .post('/api/extras/pay')
      .set('Authorization', bearer(token))
      .send({ amount: 5 });

    expect(res.status).toBe(200);
    expect(res.body.extrasBalance).toBe(2);
    expect(res.body.extrasLedger[0]).toMatchObject({
      subtotal: 7,
      amountPaid: 5,
      status: 'partial'
    });
  });

  it('marks the entry paid when settled in full', async () => {
    const token = await buy(2);
    const res = await request(app)
      .post('/api/extras/pay')
      .set('Authorization', bearer(token))
      .send({ amount: 7 });

    expect(res.status).toBe(200);
    expect(res.body.extrasBalance).toBe(0);
    expect(res.body.extrasLedger[0].status).toBe('paid');
  });

  it('rejects paying more than is owed (400)', async () => {
    const token = await buy(1);
    const res = await request(app)
      .post('/api/extras/pay')
      .set('Authorization', bearer(token))
      .send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive amount (400)', async () => {
    const { token } = await registerTenant();
    const res = await request(app)
      .post('/api/extras/pay')
      .set('Authorization', bearer(token))
      .send({ amount: -1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/extras/balance/me', () => {
  it('returns the tenant\'s balance and ledger', async () => {
    const token = await buy(3, 1);
    const res = await request(app)
      .get('/api/extras/balance/me')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.extrasBalance).toBe(3);
    expect(res.body.extrasLedger).toHaveLength(1);
  });

  it('forbids an admin (403)', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .get('/api/extras/balance/me')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });
});
