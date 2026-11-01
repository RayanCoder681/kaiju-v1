import { RateLimiter } from './rateLimit.js';
import { config } from '../config.js';

/** Limiteur des entrées (par IP) — protège contre les connexions abusives. */
export const joinLimiter = new RateLimiter(config.limits.rateWindowMs, config.limits.rateMaxActions);

/** Limiteur des actions participant (par participant) — soumissions, votes, Q&A. */
export const actionLimiter = new RateLimiter(
  config.limits.rateWindowMs,
  config.limits.rateMaxActions,
);

/** Limiteur d’authentification : au plus 10 tentatives par IP sur 15 minutes. */
export const authLimiter = new RateLimiter(15 * 60_000, 10);
