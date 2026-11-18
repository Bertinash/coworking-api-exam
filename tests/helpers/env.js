// Loaded by Jest (setupFiles) before any test module is required, so that
// config/auth.js and friends have the env they expect. Tests never touch a
// real database or the real .env values.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
