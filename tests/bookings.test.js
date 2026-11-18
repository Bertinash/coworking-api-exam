const request = require('supertest');
const app = require('../src/app');
const { connect, clearDatabase, closeDatabase } = require('./helpers/db');
const { registerAdmin, registerTenant, bearer } = require('./helpers/auth');

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

const book = (token, overrides = {}) =>
  request(app)
    .post('/api/bookings')
    .set('Authorization', bearer(token))
    .send({
      room: 'meeting_room',
      startsAt: '2030-01-05T09:00:00.000Z',
      endsAt: '2030-01-05T10:00:00.000Z',
      notes: 'Client pitch',
      ...overrides
    });

describe('POST /api/bookings', () => {
  it('lets a tenant book a room', async () => {
    const { token, user } = await registerTenant();
    const res = await book(token);

    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      tenant: user.id,
      room: 'meeting_room',
      status: 'scheduled',
      notes: 'Client pitch'
    });
  });

  it('rejects missing fields (400)', async () => {
    const { token } = await registerTenant();
    const res = await book(token, { room: undefined });
    expect(res.status).toBe(400);
  });

  it('rejects an end time before the start time (400)', async () => {
    const { token } = await registerTenant();
    const res = await book(token, {
      startsAt: '2030-01-05T10:00:00.000Z',
      endsAt: '2030-01-05T09:00:00.000Z'
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid dates (400)', async () => {
    const { token } = await registerTenant();
    const res = await book(token, { startsAt: 'tomorrow-ish' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown room', async () => {
    const { token } = await registerTenant();
    const res = await book(token, { room: 'rooftop' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an overlapping booking for the same room (409)', async () => {
    const { token } = await registerTenant();
    await book(token);
    const { token: other } = await registerTenant({ email: 'other@cowork.io' });

    const res = await book(other, {
      startsAt: '2030-01-05T09:30:00.000Z',
      endsAt: '2030-01-05T11:00:00.000Z'
    });
    expect(res.status).toBe(409);
  });

  it('allows back-to-back bookings and other rooms at the same time', async () => {
    const { token } = await registerTenant();
    await book(token);

    const backToBack = await book(token, {
      startsAt: '2030-01-05T10:00:00.000Z',
      endsAt: '2030-01-05T11:00:00.000Z'
    });
    const otherRoom = await book(token, { room: 'focus_room' });

    expect(backToBack.status).toBe(201);
    expect(otherRoom.status).toBe(201);
  });

  it('forbids an admin (403)', async () => {
    const { token } = await registerAdmin();
    const res = await book(token);
    expect(res.status).toBe(403);
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).post('/api/bookings').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/bookings', () => {
  it('shows a tenant only their own bookings', async () => {
    const { token: a } = await registerTenant({ email: 'a@cowork.io' });
    const { token: b } = await registerTenant({ email: 'b@cowork.io' });
    await book(a);
    await book(b, { room: 'focus_room' });

    const res = await request(app).get('/api/bookings').set('Authorization', bearer(a));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.bookings[0].tenant.email).toBe('a@cowork.io');
  });

  it('shows an admin every booking, sorted by start time', async () => {
    const { token: a } = await registerTenant({ email: 'a@cowork.io' });
    await book(a, {
      startsAt: '2030-01-06T09:00:00.000Z',
      endsAt: '2030-01-06T10:00:00.000Z'
    });
    await book(a);
    const { token: admin } = await registerAdmin();

    const res = await request(app).get('/api/bookings').set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.bookings[0].startsAt).toBe('2030-01-05T09:00:00.000Z');
  });
});
