const request = require('supertest');
const app = require('../../src/app');

// Register a user through the real auth route and return { token, user }.
// Admin creation through /register is intentionally open in this project.
const register = async (overrides = {}) => {
  const payload = {
    name: 'Test User',
    email: 'user@cowork.io',
    password: 'Secret123',
    ...overrides
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(
      `Failed to register test user: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return { token: res.body.token, user: res.body.user, password: payload.password };
};

const registerAdmin = (overrides = {}) =>
  register({ name: 'Alex Admin', email: 'admin@cowork.io', role: 'admin', ...overrides });

const registerTenant = (overrides = {}) =>
  register({ name: 'Tara Tenant', email: 'tara@cowork.io', role: 'tenant', ...overrides });

const bearer = (token) => `Bearer ${token}`;

module.exports = { register, registerAdmin, registerTenant, bearer };
