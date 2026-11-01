#!/usr/bin/env node
/**
 * Lancement Kaiju en une commande (mode démo/production local).
 *  1. Vérifie la version de Node.
 *  2. Compile shared → server → client si nécessaire.
 *  3. Démarre le serveur compilé (qui applique les migrations et sert le client).
 *
 * Développement (rechargement à chaud) : préférez deux terminaux —
 *   npm run dev:server   puis   npm run dev:client
 */
import { spawnSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './assert-supported-node.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) {
    console.error(`\nÉchec de la commande : ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

// 1. Rebuild on every launch so a presentation never serves stale dist files.
run('npm', ['run', 'build']);

// 2. Démarrage serveur.
console.log('\nDémarrage du serveur Kaiju…');
const child = spawn('node', ['server/dist/index.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
