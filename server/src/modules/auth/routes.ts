import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { zLoginRequest } from '@kaiju/shared';
import { getRepositories } from '../../context.js';
import { handle, parseBody } from '../../middleware/handle.js';
import { setAuthCookie, clearAuthCookie, readCookie, AUTH_COOKIE } from '../../middleware/cookies.js';
import { requireHost, type HostRequest } from '../../middleware/requireHost.js';
import { AUTH_TTL_MS, login, logout, setupNeeded, setupOrganizer } from './service.js';
import { config } from '../../config.js';
import { authLimiter } from '../../lib/limiters.js';
import { Errors } from '../../lib/errors.js';

const zSetup = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().max(80).optional(),
  setupKey: z.string().optional(),
});

function checkSetupKey(candidate: string | undefined): boolean {
  const expected = config.setupKey;
  if (!expected || expected.length < 32 || !candidate) return false;
  const expectedBytes = Buffer.from(expected);
  const candidateBytes = Buffer.from(candidate);
  return expectedBytes.length === candidateBytes.length && timingSafeEqual(expectedBytes, candidateBytes);
}

export const authRouter = Router();

/** Indique si le premier compte organisateur reste à créer. */
authRouter.get(
  '/setup-status',
  handle((_req, res) => {
    res.json({ setupNeeded: setupNeeded(getRepositories()), setupKeyRequired: config.nodeEnv === 'production' });
  }),
);

/** Crée l'unique compte organisateur (premier démarrage uniquement). */
authRouter.post(
  '/setup',
  handle(async (req, res) => {
    const input = parseBody(zSetup, req.body);
    if (config.nodeEnv === 'production' && !checkSetupKey(input.setupKey)) throw Errors.unauthorized();
    const { id } = await setupOrganizer(getRepositories(), input);
    res.status(201).json({ ok: true, id });
  }),
);

authRouter.post(
  '/login',
  handle(async (req, res) => {
    if (!authLimiter.allow(req.ip ?? 'unknown')) throw Errors.rateLimited();
    const input = parseBody(zLoginRequest, req.body);
    const result = await login(getRepositories(), input);
    setAuthCookie(res, result.token, AUTH_TTL_MS);
    res.json({ ok: true, organizer: result.organizer });
  }),
);

authRouter.post(
  '/logout',
  handle((req, res) => {
    const token = readCookie(req, AUTH_COOKIE);
    if (token) logout(getRepositories(), token);
    clearAuthCookie(res);
    res.json({ ok: true });
  }),
);

/** Session courante (pour réhydrater l'UI organisateur). */
authRouter.get(
  '/me',
  requireHost,
  handle((req, res) => {
    const org = getRepositories().organizer.findById((req as HostRequest).organizerId!);
    if (!org) {
      res.status(401).json({ ok: false, errorKey: 'error.unauthorized' });
      return;
    }
    res.json({ ok: true, organizer: { id: org.id, username: org.username, displayName: org.display_name } });
  }),
);
