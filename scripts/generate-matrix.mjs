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
  '// GENERATED FILE - DO NOT EDIT BY HAND.',
  '// Regenerate with: node scripts/generate-matrix.mjs [path/to/relationships.xml]',
  '//',
  '// Derived from relationships.xml in the Archi repository (archimatetool/archi),',
  '// directory com.archimatetool.model, which is a machine-readable rendering of the',
  `// relationship tables in Appendix B.5 of the ArchiMate ${version} Specification.`,
  '//',
  '// The source material carries the following notice, reproduced here as its licence',
  '// requires:',
  '//',
  '//   Copyright (c) 2013-2026 Phillip Beauvoir, Jean-Baptiste Sarrodie, The Open Group',
  '//',
  '//   Permission is hereby granted, free of charge, to any person obtaining a copy of',
  '//   this software and associated documentation files (the "Software"), to deal in',
  '//   the Software without restriction, including without limitation the rights to',
  '//   use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of',
  '//   the Software, and to permit persons to whom the Software is furnished to do so,',
  '//   subject to the following conditions:',
  '//',
  '//   The above copyright notice and this permission notice shall be included in all',
  '//   copies or substantial portions of the Software.',
  '//',
  '//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  '//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS',
  '//   FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR',
  '//   COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER',
  '//   IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN',
  '//   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
  '//',
  '// ArchiMate is a registered trademark of The Open Group.',
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
