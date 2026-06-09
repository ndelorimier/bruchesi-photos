// api/tests/auth.test.js
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxx';
const { requireAuth, requireRole } = require('../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('requireAuth rejects missing token', () => {
  const req = { headers: {} };
  const res = mockRes();
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('requireAuth accepts valid JWT and sets req.user', () => {
  const token = jwt.sign({ id: 1, type: 'parent' }, 'test-secret-32-chars-minimum-xxxx');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.user).toMatchObject({ id: 1, type: 'parent' });
});

test('requireRole blocks wrong role', () => {
  const req = { user: { type: 'parent' } };
  const res = mockRes();
  const next = jest.fn();
  requireRole('admin')(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
});

test('requireRole allows correct role', () => {
  const req = { user: { type: 'employe', role: 'ADMIN' } };
  const res = mockRes();
  const next = jest.fn();
  requireRole('ADMIN')(req, res, next);
  expect(next).toHaveBeenCalled();
});
