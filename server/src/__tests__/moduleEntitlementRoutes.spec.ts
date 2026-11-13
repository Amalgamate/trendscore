jest.mock('../middleware/requireApp', () => ({
  requireApp: (slug: string) => Object.assign(
    (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next(),
    { appSlug: slug },
  ),
}));

jest.mock('../controllers/approval.controller', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('../controllers/approvalWorkflow.controller', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('../controllers/biometric.controller', () => ({
  biometricController: new Proxy({}, { get: () => jest.fn() }),
}));
jest.mock('../controllers/broadcast.controller', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('../controllers/hr.controller', () => ({
  hrController: new Proxy({}, { get: () => jest.fn() }),
}));
jest.mock('../domains/transport/trip.controller', () => ({
  tripController: new Proxy({}, { get: () => jest.fn() }),
}));

import { Router } from 'express';
import approvalRoutes from '../routes/approval.routes';
import approvalWorkflowRoutes from '../routes/approvalWorkflow.routes';
import biometricRoutes from '../routes/biometric.routes';
import broadcastRoutes from '../routes/broadcast.routes';
import hrRoutes from '../routes/hr.routes';
import tripRoutes from '../routes/trips.routes';

type TaggedMiddleware = ((...args: unknown[]) => unknown) & { appSlug?: string };
type RouteLayer = {
  handle: TaggedMiddleware;
  route?: {
    methods: Record<string, boolean>;
    path: string;
    stack: Array<{ handle: TaggedMiddleware }>;
  };
};

const getRouteLayers = (router: Router) => router.stack as unknown as RouteLayer[];

const routeHasModuleGuard = (router: Router, path: string, method: string, slug: string) => {
  const route = getRouteLayers(router).find(
    (layer) => layer.route?.path === path && layer.route?.methods[method],
  );
  return route?.route?.stack.some(({ handle }) => handle.appSlug === slug) ?? false;
};

const routerHasModuleGuard = (router: Router, slug: string) =>
  getRouteLayers(router).some((layer) => layer.handle.appSlug === slug);

describe('module entitlement route coverage', () => {
  it.each([
    ['post', '/devices', 'biometric'],
    ['get', '/devices', 'biometric'],
    ['patch', '/devices/:id', 'biometric'],
    ['delete', '/devices/:id', 'biometric'],
    ['post', '/devices/:id/rotate-token', 'biometric'],
    ['post', '/devices/:id/activation', 'biometric'],
    ['post', '/devices/:id/test', 'biometric'],
    ['get', '/configuration', 'biometric'],
    ['post', '/face/enrollment/session', 'biometric'],
    ['post', '/face/enrollment/session/:sessionId/complete', 'biometric'],
    ['post', '/enroll', 'biometric'],
    ['get', '/enroll/:personType/:personId', 'biometric'],
    ['get', '/credentials', 'biometric'],
    ['delete', '/credentials/:id', 'biometric'],
    ['get', '/logs', 'biometric'],
    ['post', '/logs/:id/process', 'biometric'],
  ])('gates protected biometric %s %s routes', (method, path, slug) => {
    expect(routeHasModuleGuard(biometricRoutes, path, method, slug)).toBe(true);
  });

  it.each([
    ['post', '/terminal/activate'],
    ['post', '/terminal/events'],
    ['post', '/terminal/face/session'],
    ['post', '/terminal/face/session/:sessionId/complete'],
    ['post', '/log'],
  ])('does not gate public biometric callback %s %s routes', (method, path) => {
    expect(routeHasModuleGuard(biometricRoutes, path, method, 'biometric')).toBe(false);
  });

  it.each([
    ['post', '/attendance/clock-in'],
    ['post', '/attendance/clock-out'],
    ['get', '/attendance/today'],
    ['get', '/attendance/live'],
    ['post', '/attendance/presence-ping'],
  ])('gates early HR attendance %s %s routes', (method, path) => {
    expect(routeHasModuleGuard(hrRoutes, path, method, 'staff-hr')).toBe(true);
  });

  it('gates approvals and workflow configuration', () => {
    expect(routerHasModuleGuard(approvalRoutes, 'approvals')).toBe(true);
    expect(routerHasModuleGuard(approvalWorkflowRoutes, 'approvals')).toBe(true);
  });

  it('gates broadcast management on the Messages entitlement', () => {
    expect(routerHasModuleGuard(broadcastRoutes, 'sms-notifications')).toBe(true);
  });

  it('gates transport trip routes on the Transport entitlement', () => {
    expect(routerHasModuleGuard(tripRoutes, 'transport')).toBe(true);
  });
});
