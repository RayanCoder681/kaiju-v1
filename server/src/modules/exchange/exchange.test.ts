import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../db/migrate.js';
import { makeRepositories, type Repositories } from '../../db/repositories.js';
import { createSession } from '../sessions/service.js';
import { attachActivity, createLibraryActivity } from '../activities/service.js';
import { startActivity, submitQuizAnswer } from '../../realtime/engine.js';
import {
  exportResultsCsv,
  exportActivitiesJson,
  importActivitiesJson,
  buildSessionReport,
  exportFullBundle,
  exportFullBundleCsv,
  importFullBundle,
  importFullBundleCsv,
} from './service.js';
import { importQuestionsCsv, QUESTIONS_CSV_TEMPLATE } from './questionsCsv.js';

let repos: Repositories;

const quizDraft = (over: Record<string, unknown> = {}) => ({
  type: 'quiz' as const,
  title: 'Complexité',
  format: 'single' as const,
  question: 'Pire cas ?',
  choices: [{ text: 'O(1)' }, { text: 'O(log n)' }],
  correctIndexes: [1],
  timerSec: 30,
  scoreRules: { basePoints: 100, speedBonusMax: 0, partialCredit: 'none' as const, wrongPenalty: 0 },
  contentLocale: 'fr' as const,
  ...over,
});

function seededSession() {
  const s = createSession(repos, { title: 'TD', contentLocale: 'fr', anonymous: false, quickStart: true });
  const sac = attachActivity(repos, s.id, { draft: quizDraft() });
  for (const [pid, name, order] of [['p1', 'Alice', 1], ['p2', 'Bob', 2]] as const) {
    repos.participant.create({
      id: pid, session_id: s.id, pseudonym: name, avatar: null, reconnect_token: `t_${pid}`,
      team_id: null, join_order: order, connected: 1, created_at: 0, last_seen_at: 0,
    });
  }
  startActivity(repos, sac.id, 0, 0);
  submitQuizAnswer(repos, { sessionActivityId: sac.id, participantId: 'p1', selectedIndexes: [1], clientSubmissionId: 'c1' }, 1000);
  submitQuizAnswer(repos, { sessionActivityId: sac.id, participantId: 'p2', selectedIndexes: [0], clientSubmissionId: 'c2' }, 1000);
  return { sessionId: s.id, sacId: sac.id };
}

beforeEach(() => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  repos = makeRepositories(db);
});

describe('Export CSV des résultats', () => {
  it('produit un en-tête, une ligne par participant et un total', () => {
    const { sessionId } = seededSession();
    const csv = exportResultsCsv(repos, sessionId);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toContain('Pseudonyme');
    expect(lines[0]).toContain('Score total');
    const alice = lines.find((l) => l.startsWith('Alice'));
    expect(alice).toContain('100'); // Alice a la bonne réponse
    expect(lines).toHaveLength(3); // en-tête + 2 participants
  });
});

describe('Export / import JSON des activités', () => {
  it('exporte les définitions de la bibliothèque', () => {
    createLibraryActivity(repos, quizDraft());
    const out = exportActivitiesJson(repos);
    expect(out.schema).toBe('kaiju.activities');
    expect(out.activities).toHaveLength(1);
  });

  it('importe les valides, signale erreurs et doublons, sans exécuter de code', () => {
    createLibraryActivity(repos, quizDraft({ title: 'Déjà là' }));
    const report = importActivitiesJson(repos, {
      schema: 'kaiju.activities',
      version: 1,
      activities: [
        quizDraft({ title: 'Nouvelle' }), // valide
        quizDraft({ title: 'Mauvaise', correctIndexes: [9] }), // index hors choix -> erreur
        quizDraft({ title: 'Déjà là' }), // doublon
      ],
    });
    expect(report.imported.map((i) => i.title)).toContain('Nouvelle');
    expect(report.errors).toHaveLength(1);
    expect(report.duplicates.map((d) => d.title)).toContain('Déjà là');
  });
});

describe('Import CSV de questions', () => {
  it('importe le modèle fourni avec une bonne réponse indexée à partir de 1', () => {
    const report = importQuestionsCsv(repos, QUESTIONS_CSV_TEMPLATE);
    expect(report.imported).toHaveLength(1);
    const [activity] = repos.activityLibrary.list();
    const definition = JSON.parse(activity!.definition_json) as ReturnType<typeof quizDraft>;
    expect(definition.correctIndexes).toEqual([1]);
    expect(definition.choices[1]!.text).toBe('O(log n)');
  });

  it('respecte les guillemets et isole les erreurs ligne par ligne', () => {
    const csv = '\uFEFFtitre;question;choix;bonne_reponse;format;duree_s;explication;langue\r\n' +
      '"Titre; avec séparateur";"Quel mot contient un ""guillemet"" ?";"non|oui";2;single;30;;fr\r\n' +
      'Invalide;Question;une seule option;2;single;30;;fr\r\n';
    const report = importQuestionsCsv(repos, csv);
    expect(report.imported.map((item) => item.title)).toEqual(['Titre; avec séparateur']);
    expect(report.errors).toHaveLength(1);
  });
});

describe('Bundle de session — export et import en lot', () => {
  it('restaure en une fois les activités, réponses, Q&A et réponses ouvertes', () => {
    const { sessionId, sacId } = seededSession();
    repos.team.create('team_src', sessionId, 'Équipe A', 0);
    repos.participant.assignTeam('p1', 'team_src');
    const qa = attachActivity(repos, sessionId, {
      draft: { type: 'qa', title: 'Questions', allowAnonymous: true, contentLocale: 'fr' },
    });
    repos.qaQuestion.create({
      id: 'question_src', session_activity_id: qa.id, participant_id: 'p1', anonymous: 0,
      text: 'Comment ça marche ?', status: 'approved', projected: 1, created_at: 10,
    });
    repos.qaVote.create({ id: 'vote_src', question_id: 'question_src', participant_id: 'p2', created_at: 11 });
    const open = attachActivity(repos, sessionId, {
      draft: { type: 'open', title: 'Retour', question: 'Un commentaire ?', contentLocale: 'fr' },
    });
    repos.openAnswer.create({
      id: 'open_src', session_activity_id: open.id, participant_id: 'p2', text: 'Très clair', hidden: 0,
      group_label: null, manual_score: 5, projected: 0, created_at: 12,
    });

    const bundle = exportFullBundle(repos, sessionId);
    const imported = importFullBundle(repos, bundle);
    expect(imported.session.state).toBe('closed');
    expect(imported.participants).toBe(2);
    expect(imported.activities).toBe(3);
    expect(imported.answers).toBe(2);
    expect(imported.questions).toBe(1);
    expect(imported.openAnswers).toBe(1);
    const report = buildSessionReport(repos, imported.session.id);
    expect(report.ranking.map((row) => row.totalScore)).toEqual([100, 0]);
    const restored = exportFullBundle(repos, imported.session.id);
    expect(restored.activities.find((activity) => activity.type === 'qa')?.questions[0]?.votes).toHaveLength(1);
    expect(restored.activities.find((activity) => activity.type === 'open')?.openAnswers[0]?.text).toBe('Très clair');
    expect(restored.activities.find((activity) => activity.id === sacId)).toBeUndefined();
  });

  it('rejette les références orphelines avant de créer la session importée', () => {
    const { sessionId } = seededSession();
    const bundle = exportFullBundle(repos, sessionId) as ReturnType<typeof exportFullBundle> & {
      activities: { answers: { participantId: string }[] }[];
    };
    bundle.activities[0]!.answers[0]!.participantId = 'missing-participant';
    expect(() => importFullBundle(repos, bundle)).toThrow();
    expect(repos.session.listRecent()).toHaveLength(1);
  });

  it('restaure aussi la même archive depuis le CSV complet', () => {
    const { sessionId } = seededSession();
    const csv = exportFullBundleCsv(repos, sessionId);
    const imported = importFullBundleCsv(repos, csv);
    expect(imported.participants).toBe(2);
    expect(imported.answers).toBe(2);
    expect(buildSessionReport(repos, imported.session.id).ranking[0]?.totalScore).toBe(100);
  });
});

describe('Rapport de session', () => {
  it('résume participation, classement et activités', () => {
    const { sessionId } = seededSession();
    const report = buildSessionReport(repos, sessionId);
    expect(report.participation.total).toBe(2);
    expect(report.ranking[0]!.pseudonym).toBe('Alice');
    expect(report.activities[0]!.totalResponses).toBe(2);
    expect(report.activities[0]!.correctIndexes).toEqual([1]);
  });
});
