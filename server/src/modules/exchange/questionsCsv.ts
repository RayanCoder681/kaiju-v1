import type { Repositories } from '../../db/repositories.js';
import { LIMITS, validateQuizIntegrity, zActivity, type ActivityDraft } from '@kaiju/shared';
import { newId } from '../../lib/ids.js';

export const QUESTIONS_CSV_HEADER = [
  'titre', 'question', 'choix', 'bonne_reponse', 'format', 'duree_s', 'explication', 'langue',
] as const;

export const QUESTIONS_CSV_TEMPLATE = [
  `\uFEFF${QUESTIONS_CSV_HEADER.join(';')}`,
  '"Complexité algorithmique";"Quelle est la complexité moyenne d’une recherche dans un arbre équilibré ?";"O(1)|O(log n)|O(n)";2;single;30;"La hauteur est en O(log n).";fr',
].join('\r\n') + '\r\n';

export interface QuestionsCsvReport {
  lineOffset: 2;
  imported: { index: number; title: string }[];
  duplicates: { index: number; title: string }[];
  errors: { index: number; error: string }[];
}

function parseSemicolonCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let justClosedQuote = false;

  for (let i = input.charCodeAt(0) === 0xfeff ? 1 : 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.trim() !== '' || justClosedQuote) throw new Error('Guillemet inattendu');
      field = '';
      quoted = true;
    } else if (char === ';') {
      row.push(field.trim());
      field = '';
      justClosedQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
      justClosedQuote = false;
    } else {
      if (justClosedQuote && char.trim() !== '') throw new Error('Texte après un champ entre guillemets');
      if (!justClosedQuote) field += char;
    }
  }
  if (quoted) throw new Error('Champ entre guillemets non terminé');
  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

function rowToQuiz(cells: string[]): ActivityDraft {
  if (cells.length !== QUESTIONS_CSV_HEADER.length) {
    throw new Error(`8 colonnes attendues, ${cells.length} reçue(s)`);
  }
  const [title, question, choicesCell, correctCell, formatCell, timerCell, explanation, localeCell] = cells;
  const format = formatCell || 'single';
  if (format !== 'single' && format !== 'multiple' && format !== 'truefalse') {
    throw new Error('format doit être single, multiple ou truefalse');
  }
  const questionText = question!.trim();
  const titleText = title!.trim() || questionText;
  const choices = format === 'truefalse'
    ? [{ text: 'Vrai' }, { text: 'Faux' }]
    : choicesCell!.split('|').map((text) => text.trim()).filter(Boolean).map((text) => ({ text }));
  if (format !== 'truefalse' && choices.length < 2) throw new Error('choix doit contenir au moins 2 réponses séparées par |');
  if (choices.length > LIMITS.choicesPerQuestionMax) throw new Error(`10 choix maximum`);

  const rawCorrect = correctCell!.split('|').map((value) => value.trim());
  const correctIndexes = rawCorrect.map((value) => {
    if (!/^\d+$/.test(value)) throw new Error('bonne_reponse utilise des numéros à partir de 1 séparés par |');
    return Number(value) - 1;
  });
  const timerSec = timerCell!.trim() ? Number(timerCell) : 30;
  const contentLocale = localeCell!.trim() || 'fr';
  const parsed = zActivity.safeParse({
    type: 'quiz', title: titleText, format, question: questionText, choices, correctIndexes,
    explanation: explanation!.trim() || undefined, timerSec,
    scoreRules: { basePoints: 100, speedBonusMax: 0, partialCredit: format === 'multiple' ? 'linear' : 'none', wrongPenalty: 0 },
    presentation: 'both', resultVisibility: 'on_close', contentLocale,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Question invalide');
  if (parsed.data.type !== 'quiz') throw new Error('Une question quiz est attendue');
  const integrity = validateQuizIntegrity(parsed.data);
  if (!integrity.ok) throw new Error(integrity.error);
  return parsed.data;
}

/** Import en lot d’une question par ligne depuis le modèle Kaiju CSV. */
export function importQuestionsCsv(repos: Repositories, raw: unknown): QuestionsCsvReport {
  if (typeof raw !== 'string') {
    return { lineOffset: 2, imported: [], duplicates: [], errors: [{ index: 0, error: 'Le contenu CSV doit être du texte.' }] };
  }
  if (raw.length > 2_000_000) {
    return { lineOffset: 2, imported: [], duplicates: [], errors: [{ index: 0, error: 'Fichier trop volumineux (2 Mo maximum).' }] };
  }
  let rows: string[][];
  try {
    rows = parseSemicolonCsv(raw);
  } catch (error) {
    return { lineOffset: 2, imported: [], duplicates: [], errors: [{ index: 0, error: (error as Error).message }] };
  }
  const header = rows.shift();
  if (!header || header.length !== QUESTIONS_CSV_HEADER.length || header.some((cell, i) => cell !== QUESTIONS_CSV_HEADER[i])) {
    return { lineOffset: 2, imported: [], duplicates: [], errors: [{ index: 0, error: `En-tête attendu : ${QUESTIONS_CSV_HEADER.join(';')}` }] };
  }

  const report: QuestionsCsvReport = { lineOffset: 2, imported: [], duplicates: [], errors: [] };
  const titles = new Set(repos.activityLibrary.list().map((item) => item.title.toLocaleLowerCase()));
  rows.forEach((cells, index) => {
    try {
      const draft = rowToQuiz(cells);
      if (titles.has(draft.title.toLocaleLowerCase())) {
        report.duplicates.push({ index, title: draft.title });
        return;
      }
      const now = Date.now();
      repos.activityLibrary.create({
        id: newId('act'), type: draft.type, title: draft.title,
        content_locale: draft.contentLocale, definition_json: JSON.stringify(draft),
        used: 0, created_at: now, updated_at: now,
      });
      titles.add(draft.title.toLocaleLowerCase());
      report.imported.push({ index, title: draft.title });
    } catch (error) {
      report.errors.push({ index, error: (error as Error).message });
    }
  });
  return report;
}
