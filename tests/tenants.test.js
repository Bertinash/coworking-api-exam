const request = require('supertest');
const app = require('../src/app');
const { connect, clearDatabase, closeDatabase } = require('./helpers/db');
const { registerAdmin, registerTenant, bearer } = require('./helpers/auth');

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

const MISSING_ID = '665100000000000000000000';

describe('Tenants (admin)', () => {
  describe('POST /api/tenants', () => {
    it('lets an admin create a tenant', async () => {
      const { token } = await registerAdmin();
      const res = await request(app)
        .post('/api/tenants')
        .set('Authorization', bearer(token))
        .send({ name: 'New Tenant', email: 'new@cowork.io', password: 'Pass1234' });

      expect(res.status).toBe(201);
      expect(res.body.tenant).toMatchObject({ name: 'New Tenant', email: 'new@cowork.io' });
      expect(res.body.tenant).toHaveProperty('plan');
    });

    it('rejects missing fields (400)', async () => {
      const { token } = await registerAdmin();
      const res = await request(app)
        .post('/api/tenants')
        .set('Authorization', bearer(token))
        .send({ email: 'incomplete@cowork.io' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate email (400)', async () => {
      const { token } = await registerAdmin();
      await registerTenant({ email: 'dupe@cowork.io' });
      const res = await request(app)
        .post('/api/tenants')
        .set('Authorization', bearer(token))
        .send({ name: 'Dupe', email: 'dupe@cowork.io', password: 'Pass1234' });
      expect(res.status).toBe(400);
    });

    it('forbids a tenant (403)', async () => {
      const { token } = await registerTenant();
      const res = await request(app)
        .post('/api/tenants')
        .set('Authorization', bearer(token))
        .send({ name: 'X', email: 'x@cowork.io', password: 'Pass1234' });
      expect(res.status).toBe(403);
    });

    it('requires authentication (401)', async () => {
      const res = await request(app)
        .post('/api/tenants')
        .send({ name: 'X', email: 'x@cowork.io', password: 'Pass1234' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tenants', () => {
    it('lists only tenants, without passwords', async () => {
      const { token } = await registerAdmin();
      await registerTenant({ email: 'a@cowork.io' });
      await registerTenant({ email: 'b@cowork.io' });

      const res = await request(app).get('/api/tenants').set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      res.body.tenants.forEach((t) => {
        expect(t.role).toBe('tenant');
        expect(t).not.toHaveProperty('password');
      });
    });
  });

  describe('GET /api/tenants/:tenantId', () => {
    it('returns tenant details', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();
      const res = await request(app)
        .get(`/api/tenants/${user.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.tenant.email).toBe('tara@cowork.io');
    });

    it('returns 404 for an unknown tenant', async () => {
      const { token } = await registerAdmin();
      const res = await request(app)
        .get(`/api/tenants/${MISSING_ID}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(404);
    });

    it('returns 404 when the id belongs to an admin', async () => {
      const { token, user } = await registerAdmin();
      const res = await request(app)
        .get(`/api/tenants/${user.id}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/tenants/:tenantId/plan', () => {
    it('assigns a paid plan and computes the end date', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();
      const res = await request(app)
        .post(`/api/tenants/${user.id}/plan`)
        .set('Authorization', bearer(token))
        .send({
          planName: 'dedicated_desk',
          price: 199,
          startDate: '2030-01-01T00:00:00.000Z',
          durationInDays: 30,
          markPaid: true,
          autoRenew: true
        });

      expect(res.status).toBe(200);
      expect(res.body.plan).toMatchObject({
        planName: 'dedicated_desk',
        price: 199,
        status: 'active',
        autoRenew: true,
        endDate: '2030-01-31T00:00:00.000Z'
      });
      expect(res.body.plan.lastPaidAt).toBeDefined();
    });

    it('leaves an unpaid plan pending', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();
      const res = await request(app)
        .post(`/api/tenants/${user.id}/plan`)
        .set('Authorization', bearer(token))
        .send({ planName: 'private_office', price: 499, durationInDays: 30 });

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('pending');
    });

    it('marks a plan that already ended as expired', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();
      const res = await request(app)
        .post(`/api/tenants/${user.id}/plan`)
        .set('Authorization', bearer(token))
        .send({ startDate: '2020-01-01', endDate: '2020-02-01' });

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('expired');
    });

    it('rejects an unknown plan name', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();
      const res = await request(app)
        .post(`/api/tenants/${user.id}/plan`)
        .set('Authorization', bearer(token))
        .send({ planName: 'penthouse' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for an unknown tenant', async () => {
      const { token } = await registerAdmin();
      const res = await request(app)
        .post(`/api/tenants/${MISSING_ID}/plan`)
        .set('Authorization', bearer(token))
        .send({ planName: 'hot_desk' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tenants/:tenantId/balance', () => {
    it('returns plan and extras balance', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();
      const res = await request(app)
        .get(`/api/tenants/${user.id}/balance`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.tenant).toMatchObject({ extrasBalance: 0, extrasLedger: [] });
      expect(res.body.tenant).toHaveProperty('plan');
    });
  });

  describe('DELETE /api/tenants/:tenantId', () => {
    it('deletes a tenant', async () => {
      const { token } = await registerAdmin();
      const { user } = await registerTenant();

      const res = await request(app)
        .delete(`/api/tenants/${user.id}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(200);

      const after = await request(app)
        .get(`/api/tenants/${user.id}`)
        .set('Authorization', bearer(token));
      expect(after.status).toBe(404);
    });

    it('returns 404 for an unknown tenant', async () => {
      const { token } = await registerAdmin();
      const res = await request(app)
        .delete(`/api/tenants/${MISSING_ID}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(404);
    });
  });
});

describe('Plan (tenant)', () => {
  describe('GET /api/tenants/me/plan', () => {
    it('returns the tenant\'s own plan', async () => {
      const { token } = await registerTenant();
      const res = await request(app)
        .get('/api/tenants/me/plan')
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.plan.status).toBe('inactive');
      expect(res.body.extrasBalance).toBe(0);
    });
  });

  describe('POST /api/tenants/plan/pay', () => {
    it('activates the plan with a default 30-day duration', async () => {
      const { token } = await registerTenant();
      const res = await request(app)
        .post('/api/tenants/plan/pay')
        .set('Authorization', bearer(token))
        .send({ planName: 'hot_desk', price: 99, startDate: '2030-03-01T00:00:00.000Z' });

      expect(res.status).toBe(200);
      expect(res.body.plan).toMatchObject({
        planName: 'hot_desk',
        price: 99,
        status: 'active',
        endDate: '2030-03-31T00:00:00.000Z'
      });
    });

    it('rejects an end date before the start date (400)', async () => {
      const { token } = await registerTenant();
      const res = await request(app)
        .post('/api/tenants/plan/pay')
        .set('Authorization', bearer(token))
        .send({ startDate: '2030-03-10', endDate: '2030-03-01' });
      expect(res.status).toBe(400);
    });

    it('forbids an admin (403)', async () => {
      const { token } = await registerAdmin();
      const res = await request(app)
        .post('/api/tenants/plan/pay')
        .set('Authorization', bearer(token))
        .send({ planName: 'hot_desk' });
      expect(res.status).toBe(403);
    });
  });
});
