import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isValidRelationship,
  getValidRelationshipTypes,
  getValidTargetTypes,
  validateRelationship,
  getRelationshipGuidance,
} from './validation.js';
import { RELATION_MATRIX, MATRIX_SOURCE_VERSION } from './matrix.generated.js';
import { AllElementTypes, RelationshipTypes } from '../model/types.js';
import type { ElementType, RelationshipType } from '../model/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const RELATIONSHIPS_XML = resolve(here, '../../../Archimatetool/relationships.xml');

const LETTER_TO_TYPE: Record<string, RelationshipType> = {
  a: 'Access',
  c: 'Composition',
  f: 'Flow',
  g: 'Aggregation',
  i: 'Assignment',
  n: 'Influence',
  o: 'Association',
  r: 'Realization',
  s: 'Specialization',
  t: 'Triggering',
  v: 'Serving',
};

describe('validation is a lookup in the ArchiMate 3.2 relationship tables', () => {
  it('reports the specification version it was generated from', () => {
    expect(MATRIX_SOURCE_VERSION).toBe('3.2');
  });

  it('covers every pair of element types the server knows', () => {
    const missing: string[] = [];
    for (const source of AllElementTypes) {
      for (const target of AllElementTypes) {
        if (RELATION_MATRIX[`${source}>${target}`] === undefined) {
          missing.push(`${source}>${target}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('agrees with the generated matrix on all 39.600 combinations', () => {
    const disagreements: string[] = [];
    for (const source of AllElementTypes) {
      for (const target of AllElementTypes) {
        const letters = RELATION_MATRIX[`${source}>${target}`] ?? '';
        for (const relType of RelationshipTypes) {
          const expected = Object.entries(LETTER_TO_TYPE).some(
            ([letter, name]) => name === relType && letters.includes(letter)
          );
          if (isValidRelationship(source, target, relType) !== expected) {
            disagreements.push(`${source} -${relType}-> ${target}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });
});

describe('the generated matrix still matches its source file', () => {
  it('has the same entries as Archimatetool/relationships.xml', () => {
    let xml: string;
    try {
      xml = readFileSync(RELATIONSHIPS_XML, 'utf8');
    } catch {
      // Het bronbestand hoort bij de projectmap en is niet altijd aanwezig.
      return;
    }

    const fromXml: Record<string, string> = {};
    let current: string | null = null;
    for (const line of xml.split('\n')) {
      const source = line.match(/<source concept="([^"]+)"/);
      if (source) {
        current = source[1];
        continue;
      }
      const target = line.match(/<target concept="([^"]+)" relations="([^"]*)"/);
      if (target && current) {
        fromXml[`${current}>${target[1]}`] = [...new Set(target[2])].sort().join('');
      }
    }

    expect(RELATION_MATRIX).toEqual(fromXml);
  });
});

describe('known cells from Appendix B.5', () => {
  // Bron: ArchiMate 3.2 Specification, C226, bijlage B.5.
  const cases: Array<[ElementType, ElementType, RelationshipType[]]> = [
    // Rij Application Component, kolom Node: r v t f O.
    ['Node', 'ApplicationComponent', ['Realization', 'Serving', 'Association', 'Triggering', 'Flow']],
    // Rij Goal, kolom Stakeholder: n O. Geen compositie, aggregatie, realisatie of serving.
    ['Stakeholder', 'Goal', ['Influence', 'Association']],
    // Rij Node, kolom Node: S C G i v t f O.
    ['Node', 'Node', ['Composition', 'Aggregation', 'Assignment', 'Serving', 'Association', 'Triggering', 'Flow', 'Specialization']],
    // Rij Business Process, kolom Application Component: r v t f O.
    ['ApplicationComponent', 'BusinessProcess', ['Realization', 'Serving', 'Association', 'Triggering', 'Flow']],
  ];

  it.each(cases)('%s to %s', (source, target, expected) => {
    expect(getValidRelationshipTypes(source, target).sort()).toEqual([...expected].sort());
  });

  it('rejects relationships the specification does not list', () => {
    expect(isValidRelationship('Stakeholder', 'Goal', 'Composition')).toBe(false);
    expect(isValidRelationship('Node', 'Goal', 'Serving')).toBe(false);
    expect(isValidRelationship('ApplicationComponent', 'Driver', 'Realization')).toBe(false);
  });

  it('allows association between any two element types', () => {
    for (const source of AllElementTypes) {
      for (const target of AllElementTypes) {
        expect(isValidRelationship(source, target, 'Association')).toBe(true);
      }
    }
  });
});

describe('the surrounding helpers', () => {
  it('lists target types consistently with isValidRelationship', () => {
    const targets = getValidTargetTypes('ApplicationComponent', 'Serving');
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(isValidRelationship('ApplicationComponent', target, 'Serving')).toBe(true);
    }
    expect(targets).not.toContain('Driver');
  });

  it('names the specification version in its error message', () => {
    const result = validateRelationship('Node', 'Goal', 'Serving');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ArchiMate 3.2');
    // Rij Goal, kolom Node: r n O. Realisatie en influence mogen wel, serving niet.
    expect(result.suggestions).toEqual(['Realization', 'Influence', 'Association']);
  });

  it('accepts a relationship the specification does list', () => {
    expect(validateRelationship('Node', 'ApplicationComponent', 'Serving')).toEqual({ valid: true });
  });

  it('points at the relationship tables in its guidance', () => {
    const guidance = getRelationshipGuidance('Node', 'ApplicationComponent');
    expect(guidance).toContain('Appendix B.5');
    expect(guidance).toContain('Serving');
    expect(getRelationshipGuidance('Node')).toContain('Permitted relationship types');
  });
});
