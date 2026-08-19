#!/usr/bin/env node
// Genereert src/relationships/matrix.generated.ts uit relationships.xml van Archi.
//
// Gebruik:
//   node scripts/generate-matrix.mjs <pad-naar-relationships.xml>
//
// Standaardpad is ../Archimatetool/relationships.xml, gerekend vanaf de wortel
// van dit project. Dat bestand komt uit de repository archimatetool/archi,
// submap com.archimatetool.model/model, en is een machineleesbare weergave van
// bijlage B.5 van de ArchiMate 3.2 Specification.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const input = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(root, '..', 'Archimatetool', 'relationships.xml');
const output = resolve(root, 'src', 'relationships', 'matrix.generated.ts');

const LETTERS = [
  ['a', 'Access'],
  ['c', 'Composition'],
  ['f', 'Flow'],
  ['g', 'Aggregation'],
  ['i', 'Assignment'],
  ['n', 'Influence'],
  ['o', 'Association'],
  ['r', 'Realization'],
  ['s', 'Specialization'],
  ['t', 'Triggering'],
  ['v', 'Serving'],
];

const xml = readFileSync(input, 'utf8');

const version = xml.match(/<relationships version="([^"]+)"/)?.[1];
if (!version) {
  throw new Error(`Geen versienummer gevonden in ${input}`);
}

const rows = [];
let current = null;
for (const line of xml.split('\n')) {
  const source = line.match(/<source concept="([^"]+)"/);
  if (source) {
    current = source[1];
    continue;
  }
  const target = line.match(/<target concept="([^"]+)" relations="([^"]*)"/);
  if (target && current) {
    const unknown = [...target[2]].filter((c) => !LETTERS.some(([l]) => l === c));
    if (unknown.length > 0) {
      throw new Error(
        `Onbekende letter ${unknown.join('')} bij ${current} naar ${target[1]} in ${input}`
      );
    }
    rows.push([current, target[1], [...new Set(target[2])].sort().join('')]);
  }
}

if (rows.length === 0) {
  throw new Error(`Geen relaties gevonden in ${input}`);
}

const concepts = [...new Set(rows.flatMap(([s, t]) => [s, t]))].sort();

const out = [
  '// GEGENEREERD BESTAND - NIET MET DE HAND BEWERKEN.',
  '// Bron: Archimatetool/relationships.xml uit de repository archimatetool/archi,',
  '// submap com.archimatetool.model/model. Dat bestand is een machineleesbare weergave',
  `// van bijlage B.5 van de ArchiMate ${version} Specification (The Open Group, C226).`,
  '// Opnieuw genereren: node scripts/generate-matrix.mjs <pad-naar-relationships.xml>',
  '',
  `export const MATRIX_SOURCE_VERSION = '${version}';`,
  '',
  '/** Sleutel van de letters, gelijk aan relationships-keys.xml. */',
  'export const RELATION_LETTERS: Record<string, string> = {',
  ...LETTERS.map(([letter, name]) => `  ${letter}: '${name}',`),
  '};',
  '',
  '/**',
  ' * Toegestane relaties per bron- en doelconcept, als lettercombinatie.',
  ' * De sleutel is `Bronconcept>Doelconcept`. Ontbreekt een sleutel, dan is er tussen',
  ' * die twee concepten geen enkele relatie toegestaan.',
  ' */',
  'export const RELATION_MATRIX: Record<string, string> = {',
  ...rows.map(([s, t, r]) => `  '${s}>${t}': '${r}',`),
  '};',
  '',
  `/** De ${concepts.length} concepten die de matrix kent, inclusief Junction en Relationship. */`,
  'export const MATRIX_CONCEPTS: readonly string[] = [',
  ...concepts.map((c) => `  '${c}',`),
  '] as const;',
  '',
].join('\n');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, out);

console.log(
  `matrix.generated.ts geschreven: ${rows.length} paren, ${concepts.length} concepten, bronversie ${version}`
);
