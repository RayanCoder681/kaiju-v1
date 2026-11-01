#!/usr/bin/env node
const [major, minor] = process.versions.node.split('.').map(Number);
const supported = (major === 20 && minor >= 11) || major === 22;

if (!supported) {
  console.error(
    `Kaiju requiert Node 20.11+ ou 22 pour better-sqlite3. Version détectée : ${process.versions.node}. ` +
    'Utilisez la version 22 indiquée dans .nvmrc, puis réinstallez/reconstruisez les dépendances natives.',
  );
  process.exit(1);
}
