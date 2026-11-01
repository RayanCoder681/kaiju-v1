import { Router } from 'express';
import { getRepositories } from '../../context.js';
import { handle } from '../../middleware/handle.js';
import { requireHost } from '../../middleware/requireHost.js';
import {
  exportResultsCsv,
  exportActivitiesJson,
  importActivitiesJson,
  buildSessionReport,
  exportFullBundle,
  exportFullBundleCsv,
  importFullBundleCsv,
  importFullBundle,
} from './service.js';
import { importQuestionsCsv, QUESTIONS_CSV_TEMPLATE } from './questionsCsv.js';
import { getDb } from '../../db/connection.js';

/** Import/export + rapports (host). Monté sur /api. */
export const exchangeRouter = Router();
exchangeRouter.use(requireHost);

exchangeRouter.get(
  '/sessions/:id/report',
  handle((req, res) => {
    res.json({ ok: true, report: buildSessionReport(getRepositories(), req.params.id) });
  }),
);

exchangeRouter.post(
  '/sessions/import',
  handle((req, res) => {
    const importArchive = getDb().transaction(() => importFullBundle(getRepositories(), req.body));
    const result = importArchive();
    res.status(201).json({ ok: true, result });
  }),
);

exchangeRouter.post('/sessions/import.csv', handle((req, res) => {
  const importArchive = getDb().transaction(() => importFullBundleCsv(getRepositories(), req.body?.csv));
  res.status(201).json({ ok: true, result: importArchive() });
}));

exchangeRouter.get(
  '/sessions/:id/export/results.csv',
  handle((req, res) => {
    const csv = exportResultsCsv(getRepositories(), req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kaiju-resultats-${req.params.id}.csv"`);
    res.send(csv);
  }),
);

exchangeRouter.get(
  '/sessions/:id/export/bundle.json',
  handle((req, res) => {
    const bundle = exportFullBundle(getRepositories(), req.params.id);
    res.setHeader('Content-Disposition', `attachment; filename="kaiju-session-${req.params.id}.json"`);
    res.json(bundle);
  }),
);

exchangeRouter.get('/sessions/:id/export/bundle.csv', handle((req, res) => {
  const csv = exportFullBundleCsv(getRepositories(), req.params.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="kaiju-session-${req.params.id}.csv"`);
  res.send(csv);
}));

exchangeRouter.get(
  '/activities/export.json',
  handle((_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="kaiju-activites.json"');
    res.json(exportActivitiesJson(getRepositories()));
  }),
);

exchangeRouter.post(
  '/activities/import',
  handle((req, res) => {
    const report = importActivitiesJson(getRepositories(), req.body);
    res.json({ ok: true, report });
  }),
);

exchangeRouter.get('/activities/import-template.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="kaiju-questions-modele.csv"');
  res.send(QUESTIONS_CSV_TEMPLATE);
});

exchangeRouter.post(
  '/activities/import.csv',
  handle((req, res) => {
    const report = importQuestionsCsv(getRepositories(), req.body?.csv);
    res.json({ ok: true, report });
  }),
);
