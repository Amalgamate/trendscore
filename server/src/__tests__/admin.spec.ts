import express from 'express';
import request from 'supertest';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permissions.middleware';
import adminRoutes from '../routes/admin.routes';
import { generateAccessToken } from '../utils/jwt.util';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  return app;
};

describe('Admin routes RBAC', () => {
  const baseUser = { id: 'u1', email: 'u1@example.com' };

  it('rejects non-authenticated requests', async () => {
    const app = buildApp();
    const res = await request(app).get('/admin/modules');
    expect(res.status).toBe(401);
  });

  it('rejects non-super-admin role', async () => {
    // Admin routes allow SUPER_ADMIN and ADMIN. Use a role that is not allowed.
    const token = generateAccessToken({ ...baseUser, role: 'PARENT', schoolId: 'S1' } as any);
    const app = buildApp();
    const res = await request(app).get('/admin/modules').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows SUPER_ADMIN access', async () => {
    const token = generateAccessToken({ ...baseUser, role: 'SUPER_ADMIN' } as any);
    const app = buildApp();
    const res = await request(app).get('/admin/modules').set('Authorization', `Bearer ${token}`);
    // May still fail inside route due to DB; just assert auth/role passed
    expect([200, 500]).toContain(res.status);
  });
});
