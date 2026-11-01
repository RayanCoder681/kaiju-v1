import type { Repositories, SessionActivityRow, SessionRow } from '../../db/repositories.js';
import { z } from 'zod';
import { zActivity, validateQuizIntegrity, type ActivityDraft, type ActivityState } from '@kaiju/shared';
import { computeResults, computeRanking } from '../../realtime/engine.js';
import { newId, newToken } from '../../lib/ids.js';
import { createSession } from '../sessions/service.js';
import { AppError } from '../../lib/errors.js';

/* ───────────── Export CSV des résultats ───────────── */

/** Échappe une valeur pour CSV (RFC 4180) : guillemets doublés, entourage si nécessaire. */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * Export CSV des scores par participant (une colonne par quiz).
 * BOM UTF-8 en tête pour une ouverture correcte dans Excel.
 */
export function exportResultsCsv(repos: Repositories, sessionId: string): string {
  const participants = repos.participant.listBySession(sessionId);
  const teams = new Map(repos.team.listBySession(sessionId).map((tm) => [tm.id, tm.name]));
  const activities = repos.sessionActivity
    .listBySession(sessionId)
    .filter((a) => a.type === 'quiz');

  // Score par (participant, activité quiz).
  const perActivity = new Map<string, Map<string, number>>();
  for (const a of activities) {
    const m = new Map<string, number>();
    for (const r of repos.answer.rankingRowsForActivity(a.id)) m.set(r.pid, r.total);
    perActivity.set(a.id, m);
  }

  const header = [
    'Pseudonyme',
    'Equipe',
    ...activities.map((a) => (JSON.parse(a.snapshot_json) as ActivityDraft).title),
    'Score total',
  ];
  const lines = [csvRow(header)];

  for (const p of participants) {
    let total = 0;
    const cells: (string | number)[] = [p.pseudonym, p.team_id ? (teams.get(p.team_id) ?? '') : ''];
    for (const a of activities) {
      const s = perActivity.get(a.id)?.get(p.id) ?? 0;
      total += s;
      cells.push(s);
    }
    cells.push(total);
    lines.push(csvRow(cells));
  }

  return '﻿' + lines.join('\r\n') + '\r\n';
}

/* ───────────── Export JSON des activités ───────────── */

export const ACTIVITIES_SCHEMA_VERSION = 1;

/** Exporte les définitions d'activités (bibliothèque) dans un format documenté. */
export function exportActivitiesJson(repos: Repositories): {
  schema: string;
  version: number;
  activities: ActivityDraft[];
} {
  const activities = repos.activityLibrary
    .list()
    .map((a) => JSON.parse(a.definition_json) as ActivityDraft);
  return { schema: 'kaiju.activities', version: ACTIVITIES_SCHEMA_VERSION, activities };
}

const zImportFile = z.object({
  schema: z.literal('kaiju.activities').optional(),
  version: z.number().optional(),
  activities: z.array(z.unknown()),
});

export interface ImportReport {
  imported: { index: number; title: string }[];
  duplicates: { index: number; title: string }[];
  errors: { index: number; error: string }[];
}

/**
 * Importe des activités depuis un JSON. Chaque élément est validé (Zod + intégrité quiz).
 * Jamais d'exécution de code : simple JSON.parse + validation. Doublons (même titre) signalés.
 * Rapport d'erreurs par ligne ; les éléments valides sont importés, les autres ignorés.
 */
export function importActivitiesJson(repos: Repositories, raw: unknown): ImportReport {
  const file = zImportFile.parse(raw);
  const report: ImportReport = { imported: [], duplicates: [], errors: [] };
  const existingTitles = new Set(repos.activityLibrary.list().map((a) => a.title.toLowerCase()));

  file.activities.forEach((item, index) => {
    const parsed = zActivity.safeParse(item);
    if (!parsed.success) {
      report.errors.push({ index, error: parsed.error.issues[0]?.message ?? 'Format invalide' });
      return;
    }
    const draft = parsed.data;
    if (draft.type === 'quiz') {
      const integ = validateQuizIntegrity(draft);
      if (!integ.ok) {
        report.errors.push({ index, error: integ.error });
        return;
      }
    }
    if (existingTitles.has(draft.title.toLowerCase())) {
      report.duplicates.push({ index, title: draft.title });
      return;
    }
    const now = Date.now();
    repos.activityLibrary.create({
      id: newId('act'),
      type: draft.type,
      title: draft.title,
      content_locale: draft.contentLocale,
      definition_json: JSON.stringify(draft),
      used: 0,
      created_at: now,
      updated_at: now,
    });
    existingTitles.add(draft.title.toLowerCase());
    report.imported.push({ index, title: draft.title });
  });

  return report;
}

/* ───────────── Rapport de session ───────────── */

export interface SessionReport {
  session: { id: string; title: string; code: string; state: string };
  participation: { total: number; connected: number };
  ranking: { pseudonym: string; totalScore: number }[];
  activities: {
    id: string;
    type: string;
    title: string;
    state: string;
    totalResponses: number;
    choiceCounts?: number[];
    correctIndexes?: number[];
  }[];
}

export function buildSessionReport(repos: Repositories, sessionId: string): SessionReport {
  const session = repos.session.findById(sessionId);
  if (!session) throw new Error('session introuvable');
  const participants = repos.participant.listBySession(sessionId);
  const activities = repos.sessionActivity.listBySession(sessionId).map((a: SessionActivityRow) => {
    const draft = JSON.parse(a.snapshot_json) as ActivityDraft;
    const res = computeResults(repos, a.id, true);
    return {
      id: a.id,
      type: a.type,
      title: draft.title,
      state: a.state,
      totalResponses: res.totalResponses,
      choiceCounts: res.choiceCounts,
      correctIndexes: res.correctIndexes,
    };
  });

  return {
    session: { id: session.id, title: session.title, code: session.code, state: session.state },
    participation: {
      total: participants.length,
      connected: participants.filter((p) => p.connected).length,
    },
    ranking: computeRanking(repos, sessionId).map((r) => ({
      pseudonym: r.pseudonym,
      totalScore: r.totalScore,
    })),
    activities,
  };
}

/** Archive complète et réimportable : métadonnées, snapshots, participants et soumissions brutes. */
export function exportFullBundle(repos: Repositories, sessionId: string) {
  const report = buildSessionReport(repos, sessionId);
  const session = repos.session.findById(sessionId)!;
  const participants = repos.participant.listBySession(sessionId);
  const snapshots = repos.sessionActivity.listBySession(sessionId);
  const activities = snapshots.map((a) => ({
    id: a.id,
    type: a.type,
    position: a.position,
    snapshot: JSON.parse(a.snapshot_json) as ActivityDraft,
    state: a.state,
    privateNotes: a.private_notes,
    startedAt: a.started_at,
    deadlineAt: a.deadline_at,
    closedAt: a.closed_at,
    resultsPublishedConsole: Boolean(a.results_published_console),
    resultsPublishedProjection: Boolean(a.results_published_projection),
    answers: repos.answer.listByActivity(a.id).map((answer) => ({
      participantId: answer.participant_id,
      payload: JSON.parse(answer.payload_json) as unknown,
      score: answer.score,
      answerTimeMs: answer.answer_time_ms,
      createdAt: answer.created_at,
    })),
    questions: repos.qaQuestion.listByActivity(a.id).map((question) => ({
      id: question.id,
      participantId: question.participant_id,
      anonymous: Boolean(question.anonymous),
      text: question.text,
      status: question.status,
      projected: Boolean(question.projected),
      createdAt: question.created_at,
      votes: repos.qaVote.listByQuestion(question.id).map((vote) => ({
        participantId: vote.participant_id,
        createdAt: vote.created_at,
      })),
    })),
    openAnswers: repos.openAnswer.listByActivity(a.id).map((answer) => ({
      participantId: answer.participant_id,
      text: answer.text,
      hidden: Boolean(answer.hidden),
      groupLabel: answer.group_label,
      manualScore: answer.manual_score,
      projected: Boolean(answer.projected),
      createdAt: answer.created_at,
    })),
  }));
  return {
    schema: 'kaiju.session-bundle',
    version: 2,
    exportedAt: Date.now(),
    report,
    session: {
      id: session.id,
      code: session.code,
      title: session.title,
      description: session.description,
      state: session.state,
      contentLocale: session.content_locale,
      anonymous: Boolean(session.anonymous),
      plannedAt: session.planned_at,
      createdAt: session.created_at,
      startedAt: session.started_at,
      closedAt: session.closed_at,
      settings: JSON.parse(session.settings_json) as Record<string, unknown>,
    },
    teams: repos.team.listBySession(sessionId).map((team) => ({
      id: team.id, name: team.name, createdAt: team.created_at,
    })),
    participants: participants.map((participant) => ({
      id: participant.id,
      pseudonym: participant.pseudonym,
      avatar: participant.avatar,
      teamId: participant.team_id,
      joinOrder: participant.join_order,
      createdAt: participant.created_at,
    })),
    activities,
    // Compatibilité avec les lecteurs du format v1 (rapport + snapshots).
    snapshots: activities.map(({ id, type, snapshot }) => ({ id, type, snapshot })),
  };
}

/** Archive complète en CSV à une ligne, transportable sans perdre les données imbriquées. */
export function exportFullBundleCsv(repos: Repositories, sessionId: string): string {
  const bundle = JSON.stringify(exportFullBundle(repos, sessionId));
  return `kaiju.session-bundle\r\n"${bundle.replace(/"/g, '""')}"\r\n`;
}

/** Lit le CSV d’archive (une colonne contenant le JSON complet) puis réutilise sa validation. */
export function importFullBundleCsv(repos: Repositories, raw: unknown): SessionBundleImportReport {
  if (typeof raw !== 'string' || raw.length > 50_000_000) throw new AppError(400, 'error.validation');
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  const firstBreak = normalized.indexOf('\n');
  if (firstBreak < 0 || normalized.slice(0, firstBreak) !== 'kaiju.session-bundle') throw new AppError(400, 'error.validation');
  const cell = normalized.slice(firstBreak + 1);
  if (!cell.startsWith('"') || !cell.endsWith('"')) throw new AppError(400, 'error.validation');
  let json: string;
  try { json = JSON.parse(`"${cell.slice(1, -1).replace(/""/g, '\\"')}"`) as string; }
  catch { throw new AppError(400, 'error.validation'); }
  return importFullBundle(repos, JSON.parse(json) as unknown);
}

const zBundleAnswer = z.object({
  participantId: z.string().min(1), payload: z.unknown(), score: z.number().int().nullable(),
  answerTimeMs: z.number().int().nonnegative(), createdAt: z.number().int().nonnegative(),
});
const zBundleQuestion = z.object({
  id: z.string().min(1), participantId: z.string().min(1).nullable(), anonymous: z.boolean(),
  text: z.string().min(1).max(500), status: z.enum(['pending', 'approved', 'hidden', 'archived', 'answered']),
  projected: z.boolean(), createdAt: z.number().int().nonnegative(),
  votes: z.array(z.object({ participantId: z.string().min(1), createdAt: z.number().int().nonnegative() })),
});
const zBundleOpenAnswer = z.object({
  participantId: z.string().min(1).nullable(), text: z.string().min(1), hidden: z.boolean(),
  groupLabel: z.string().nullable(), manualScore: z.number().int().nullable(), projected: z.boolean(),
  createdAt: z.number().int().nonnegative(),
});
const zBundleActivity = z.object({
  id: z.string().min(1), type: z.enum(['quiz', 'poll', 'qa', 'open']), position: z.number().int().nonnegative(),
  snapshot: z.unknown(), state: z.enum(['prepared', 'countdown', 'running', 'paused', 'closed', 'cancelled']),
  privateNotes: z.string().nullable(), startedAt: z.number().int().nullable(),
  deadlineAt: z.number().int().nullable(), closedAt: z.number().int().nullable(),
  resultsPublishedConsole: z.boolean(), resultsPublishedProjection: z.boolean(),
  answers: z.array(zBundleAnswer), questions: z.array(zBundleQuestion), openAnswers: z.array(zBundleOpenAnswer),
});
const zSessionBundle = z.object({
  schema: z.literal('kaiju.session-bundle'), version: z.literal(2),
  session: z.object({
    id: z.string().min(1), code: z.string().min(1), title: z.string().trim().min(1).max(140),
    description: z.string().nullable(), state: z.enum(['preparation', 'active', 'suspended', 'closed', 'cancelled']),
    contentLocale: z.enum(['fr', 'en']), anonymous: z.boolean(), plannedAt: z.number().int().nullable(),
    createdAt: z.number().int().nonnegative(), startedAt: z.number().int().nullable(),
    closedAt: z.number().int().nullable(), settings: z.record(z.string(), z.unknown()),
  }),
  teams: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), createdAt: z.number().int().nonnegative() })),
  participants: z.array(z.object({
    id: z.string().min(1), pseudonym: z.string().min(1).max(40), avatar: z.string().nullable(),
    teamId: z.string().nullable(), joinOrder: z.number().int().nonnegative(), createdAt: z.number().int().nonnegative(),
  })),
  activities: z.array(zBundleActivity),
}).passthrough();

export interface SessionBundleImportReport {
  session: { id: string; title: string; code: string; state: string };
  participants: number;
  activities: number;
  answers: number;
  questions: number;
  openAnswers: number;
}

function ensureUnique(values: string[]): void {
  if (new Set(values).size !== values.length) throw new AppError(400, 'error.validation');
}

/** Importe une archive complète comme nouvelle session clôturée (aucun accès participant possible). */
export function importFullBundle(repos: Repositories, raw: unknown): SessionBundleImportReport {
  const parsed = zSessionBundle.safeParse(raw);
  if (!parsed.success) throw new AppError(400, 'error.validation');
  const bundle = parsed.data;
  const teamIds = bundle.teams.map((team) => team.id);
  const participantIds = bundle.participants.map((participant) => participant.id);
  const activityIds = bundle.activities.map((activity) => activity.id);
  ensureUnique(teamIds);
  ensureUnique(participantIds);
  ensureUnique(activityIds);
  const teamIdSet = new Set(teamIds);
  const participantIdSet = new Set(participantIds);
  const participantMap = new Map<string, string>();
  const activityMap = new Map<string, string>();
  const answerCount = bundle.activities.reduce((n, activity) => n + activity.answers.length, 0);
  const questionCount = bundle.activities.reduce((n, activity) => n + activity.questions.length, 0);
  const openAnswerCount = bundle.activities.reduce((n, activity) => n + activity.openAnswers.length, 0);

  for (const participant of bundle.participants) {
    if (participant.teamId && !teamIdSet.has(participant.teamId)) throw new AppError(400, 'error.validation');
  }
  for (const activity of bundle.activities) {
    const draft = zActivity.safeParse(activity.snapshot);
    if (!draft.success || draft.data.type !== activity.type) throw new AppError(400, 'error.validation');
    if (draft.data.type === 'quiz' && !validateQuizIntegrity(draft.data).ok) throw new AppError(400, 'error.validation');
    if ((activity.type === 'qa' && (activity.answers.length || activity.openAnswers.length)) ||
        (activity.type === 'open' && (activity.answers.length || activity.questions.length)) ||
        ((activity.type === 'quiz' || activity.type === 'poll') && (activity.questions.length || activity.openAnswers.length))) {
      throw new AppError(400, 'error.validation');
    }
    const answerParticipants = activity.answers.map((answer) => answer.participantId);
    ensureUnique(answerParticipants);
    for (const answer of activity.answers) if (!participantIdSet.has(answer.participantId)) throw new AppError(400, 'error.validation');
    const questionIds = activity.questions.map((question) => question.id);
    ensureUnique(questionIds);
    for (const question of activity.questions) {
      if (question.participantId && !participantIdSet.has(question.participantId)) throw new AppError(400, 'error.validation');
      for (const vote of question.votes) if (!participantIdSet.has(vote.participantId)) throw new AppError(400, 'error.validation');
      ensureUnique(question.votes.map((vote) => vote.participantId));
    }
    for (const answer of activity.openAnswers) if (answer.participantId && !participantIdSet.has(answer.participantId)) throw new AppError(400, 'error.validation');
  }

  const title = `${bundle.session.title} (importée)`.slice(0, 140);
  const created = createSession(repos, {
    title,
    description: bundle.session.description ?? `Archive importée de la session ${bundle.session.title}`,
    contentLocale: bundle.session.contentLocale,
    anonymous: bundle.session.anonymous,
    quickStart: false,
  });
  const now = Date.now();
  repos.session.updateState(created.id, 'closed', { closed_at: now });

  // Stable source IDs are remapped to fresh local IDs; reconnect tokens are never exported/imported.
  const teamMap = new Map(bundle.teams.map((team) => [team.id, newId('team')]));
  for (const team of bundle.teams) {
    const mappedId = teamMap.get(team.id)!;
    repos.team.create(mappedId, created.id, team.name, team.createdAt);
  }
  for (const participant of bundle.participants) {
    const id = newId('par');
    participantMap.set(participant.id, id);
    repos.participant.create({
      id, session_id: created.id, pseudonym: participant.pseudonym, avatar: participant.avatar,
      reconnect_token: newToken(), team_id: participant.teamId ? teamMap.get(participant.teamId)! : null,
      join_order: participant.joinOrder, connected: 0, created_at: participant.createdAt,
      last_seen_at: participant.createdAt,
    });
  }
  for (const activity of bundle.activities) {
    const id = newId('sac');
    activityMap.set(activity.id, id);
    const state: ActivityState = ['countdown', 'running', 'paused'].includes(activity.state) ? 'closed' : activity.state;
    repos.sessionActivity.create({
      id, session_id: created.id, library_id: null, type: activity.type,
      position: activity.position, snapshot_json: JSON.stringify(activity.snapshot), state,
      private_notes: activity.privateNotes, results_published_console: activity.resultsPublishedConsole ? 1 : 0,
      results_published_projection: activity.resultsPublishedProjection ? 1 : 0,
      started_at: activity.startedAt, deadline_at: activity.deadlineAt, closed_at: activity.closedAt ?? (state === 'closed' ? now : null),
      created_at: now,
    });
  }
  for (const activity of bundle.activities) {
    const activityId = activityMap.get(activity.id)!;
    for (const answer of activity.answers) {
      repos.answer.insert({
        id: newId('ans'), session_activity_id: activityId,
        participant_id: participantMap.get(answer.participantId)!, client_submission_id: newId('sub'),
        payload_json: JSON.stringify(answer.payload), score: answer.score,
        answer_time_ms: answer.answerTimeMs, created_at: answer.createdAt,
      });
    }
    for (const question of activity.questions) {
      const questionId = newId('q');
      repos.qaQuestion.create({
        id: questionId, session_activity_id: activityId,
        participant_id: question.participantId ? participantMap.get(question.participantId)! : null,
        anonymous: question.anonymous ? 1 : 0, text: question.text, status: question.status,
        projected: question.projected ? 1 : 0, created_at: question.createdAt,
      });
      for (const vote of question.votes) {
        repos.qaVote.create({
          id: newId('vote'), question_id: questionId,
          participant_id: participantMap.get(vote.participantId)!, created_at: vote.createdAt,
        });
      }
    }
    for (const answer of activity.openAnswers) {
      repos.openAnswer.create({
        id: newId('open'), session_activity_id: activityId,
        participant_id: answer.participantId ? participantMap.get(answer.participantId)! : null,
        text: answer.text, hidden: answer.hidden ? 1 : 0, group_label: answer.groupLabel,
        manual_score: answer.manualScore, projected: answer.projected ? 1 : 0, created_at: answer.createdAt,
      });
    }
  }
  const imported = repos.session.findById(created.id) as SessionRow;
  return {
    session: { id: imported.id, title: imported.title, code: imported.code, state: imported.state },
    participants: bundle.participants.length, activities: bundle.activities.length,
    answers: answerCount, questions: questionCount, openAnswers: openAnswerCount,
  };
}
