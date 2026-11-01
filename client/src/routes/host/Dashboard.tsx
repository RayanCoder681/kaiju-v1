import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useI18n } from '../../ui/I18nProvider.js';
import { Card, Button, Input, Field, Badge } from '../../ui/primitives.js';
import type { SessionState } from '@kaiju/shared';

interface SessionView {
  id: string;
  code: string;
  title: string;
  state: SessionState;
  createdAt: number;
}

export function Dashboard({ organizerName }: { organizerName: string }) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const archiveFileRef = useRef<HTMLInputElement>(null);

  const load = async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<{ sessions: SessionView[] }>('/api/sessions');
      setSessions(res.sessions);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent, quickStart: boolean): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/sessions', { title: title.trim(), quickStart });
      setTitle('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const importArchive = async (file: File): Promise<void> => {
    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const isCsv = file.name.toLocaleLowerCase().endsWith('.csv');
      const response = isCsv
        ? await api.post<{ result: { session: { title: string }; participants: number; activities: number } }>(
            '/api/sessions/import.csv', { csv: text },
          )
        : await api.post<{ result: { session: { title: string }; participants: number; activities: number } }>(
            '/api/sessions/import', JSON.parse(text) as unknown,
          );
      setImportMessage(`Session « ${response.result.session.title} » importée (${response.result.participants} participants, ${response.result.activities} activités).`);
      await load();
    } catch {
      setImportMessage('Import impossible. Sélectionnez une archive complète CSV ou JSON Kaiju valide.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="dashboard-heading mb-8 flex items-center justify-between gap-5">
        <div>
          <p className="eyebrow"><span className="eyebrow__line" />ESPACE ORGANISATEUR</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Bonjour {organizerName}</h1>
          <p className="mt-1 text-sm text-muted">La prochaine bonne idée commence ici.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/host/library"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-elevated"
          >
            Bibliothèque
          </Link>
          <Link
            to="/host/diagnostics"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-elevated"
          >
            Diagnostic
          </Link>
          <LogoutButton />
        </div>
      </div>

      <Card className="dashboard-create mb-10">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Nouvelle session — titre">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="TD Systèmes Distribués"
                maxLength={140}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={(e) => create(e, true)} disabled={busy || !title.trim()}>
              Démarrer maintenant
            </Button>
            <Button variant="secondary" onClick={(e) => create(e, false)} disabled={busy || !title.trim()}>
              Préparer
            </Button>
          </div>
        </form>
      </Card>

      <Card className="dashboard-archive-import mb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Importer les résultats d’une session</h2>
            <p className="mt-1 text-sm text-muted">Réimporte en une fois activités, participants et réponses depuis une archive CSV ou JSON Kaiju.</p>
          </div>
          <input
            ref={archiveFileRef}
            type="file"
            accept="application/json,.json,text/csv,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importArchive(file);
              event.target.value = '';
            }}
          />
          <Button variant="secondary" disabled={importing} onClick={() => archiveFileRef.current?.click()}>
            {importing ? 'Import en cours…' : 'Choisir une archive CSV / JSON'}
          </Button>
        </div>
        {importMessage && <p className="mt-3 text-sm text-muted" role="status">{importMessage}</p>}
      </Card>

      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="eyebrow mb-2"><span className="eyebrow__line" />VOTRE ACTIVITÉ</p><h2 className="font-display text-2xl font-bold">Sessions récentes</h2></div>
        <span className="font-mono text-xs text-muted">{sessions.length.toString().padStart(2, '0')} SESSION{sessions.length > 1 ? 'S' : ''}</span>
      </div>
      {loading ? (
        <div className="dashboard-state" role="status"><span className="dashboard-state__spinner" />Chargement de vos sessions…</div>
      ) : loadError ? (
        <div className="dashboard-state dashboard-state--error" role="alert"><span>La liste n’a pas pu être chargée.</span><Button variant="secondary" onClick={() => void load()}>Réessayer</Button></div>
      ) : sessions.length === 0 ? (
        <div className="dashboard-empty">
          <span className="dashboard-empty__mark">✳</span>
          <div><h3>La salle est encore calme.</h3><p>Créez une session pour inviter votre public à participer.</p></div>
          <span className="dashboard-empty__arrow" aria-hidden="true">↗</span>
        </div>
      ) : (
        <ul className="dashboard-sessions space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                to={`/host/sessions/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-elevated"
              >
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="font-mono text-xs text-muted">{t(`session.state.${s.state}` as const)}</div>
                </div>
                <Badge>{s.code}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogoutButton() {
  const logout = async (): Promise<void> => {
    await api.post('/api/auth/logout');
    window.location.reload();
  };
  return (
    <Button variant="secondary" onClick={logout}>
      Déconnexion
    </Button>
  );
}
