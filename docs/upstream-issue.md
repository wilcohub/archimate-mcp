# Upstream issue draft

Voor https://github.com/thijs-hakkenberg/archimate-mcp/issues

Plak de tekst hieronder als nieuwe issue. Titel:

> Relationship validation disagrees with ArchiMate 3.2 on 3.272 of 3.600 element pairs

---

## Summary

`src/relationships/validation.ts` classifies element types into categories
(`ActiveStructure`, `BehaviorInternal`, `PassiveStructure`, and so on) and then
applies generic rules per relationship type. That approach cannot reproduce
Appendix B.5 of the specification, which is the normative list of every
relationship the language permits.

I measured the disagreement over all 39.600 combinations of the 60 element types
and 11 relationship types the server supports. The current implementation
disagrees with the specification on 3.272 of the 3.600 element pairs.

| | Combinations | Element pairs |
|---|---|---|
| Rejected although the specification permits them | 2.091 | 1.044 |
| Accepted although the specification lists them nowhere | 6.544 | 2.856 |

The second row is the more consequential one. Because `archimate_create_relationship`
only rejects on `validateRelationship`, and `archimate_get_valid_relationships`
reports the same set, acceptance by the server currently carries no information
about conformance to ArchiMate 3.2.

## Examples

Rejected although permitted:

| Source | Relationship | Target | Appendix B.5 cell |
|---|---|---|---|
| Node | Triggering | ApplicationComponent | `r v t f O` |
| Node | Flow | ApplicationComponent | `r v t f O` |
| Node | Access | BusinessObject | row Business Object, column Node |
| Grouping | Specialization | Node | row Node, column Grouping |

Accepted although not listed anywhere:

| Source | Relationship | Target | Appendix B.5 cell |
|---|---|---|---|
| Stakeholder | Composition | Goal | `n O` |
| Stakeholder | Serving | Goal | `n O` |
| Node | Serving | Goal | `r n O` |
| ApplicationComponent | Realization | Driver | `n O` |
| Artifact | Serving | BusinessProcess | `r O` |

Reproduce with:

```ts
import { getValidRelationshipTypes } from './src/relationships/validation.js';

getValidRelationshipTypes('Stakeholder', 'Goal');
// current:  Composition, Aggregation, Realization, Serving, Influence, Association
// expected: Influence, Association

getValidRelationshipTypes('Node', 'ApplicationComponent');
// current:  Realization, Serving, Association
// expected: Realization, Serving, Association, Triggering, Flow
```

## Proposed fix

Replace the category reasoning with a lookup in the relationship tables.

Archi ships those tables as `relationships.xml` in
`com.archimatetool.model/model`. It is a small XML file with one entry per
source-target pair and a letter per permitted relationship type, with
`relationships-keys.xml` as the key. It carries `version="3.2"` and holds 3.844
pairs over 62 concepts, including `Junction` and `Relationship`. Both files are
in the same repository under the EPL, so vendoring or generating from them is
straightforward.

I verified that file against the specification before relying on it. I extracted
3.034 element pairs from the relationship tables in the ArchiMate 3.2
Specification (The Open Group, C226, pages 165 to 174) and compared them cell by
cell with `relationships.xml`. Zero discrepancies. The pairs not covered are rows
the PDF extraction merged, not pairs on which the two sources disagree.

The change I made locally:

- `scripts/generate-matrix.mjs` generates `src/relationships/matrix.generated.ts`
  from `relationships.xml`;
- `isValidRelationship` becomes a lookup of one letter in one string;
- the five exported functions keep their signatures, so `index.ts` is unchanged;
- `src/relationships/validation.test.ts` pins agreement with the matrix on all
  39.600 combinations, agreement between the matrix and its source file, and a
  set of cells read straight from Appendix B.5.

Full test suite stays green: 436 tests.

## Known limits of the proposal

- The source file uses lower-case letters throughout, so the matrix answers only
  whether a relationship is permitted. It does not distinguish direct from
  derived. The specification tables do make that distinction, through upper and
  lower case, so a richer table is possible if that matters to you.
- Out of scope either way: the derivation restrictions of B.4, junctions and
  relationships between relationships of B.6, and viewpoint constraints. Archi's
  `viewpoints.xml` would cover the last one.

Happy to open a PR if you want it in this shape.
