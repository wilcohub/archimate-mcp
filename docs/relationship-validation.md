# Relationship validation

Since 0.4.1 the validator answers by looking up the ArchiMate 3.2 relationship
tables instead of reasoning about element categories.

## Where the answer comes from

`src/relationships/matrix.generated.ts` is generated from `relationships.xml`
in the Archi repository (`archimatetool/archi`, `com.archimatetool.model/model`).
That file is a machine-readable rendering of Appendix B.5 of the ArchiMate 3.2
Specification (The Open Group, C226), the appendix that lists every relationship
the language permits. It holds 3844 source-target pairs over 62 concepts.

Regenerate it with:

```
node scripts/generate-matrix.mjs [path/to/relationships.xml]
```

## What it does not cover

- Direct versus derived. The source file uses lower-case letters throughout, so
  the matrix answers only whether a relationship is permitted.
- The derivation restrictions of Appendix B.4.
- Junctions and relationships between relationships, Appendix B.6.
- Viewpoint constraints, see `viewpoints.xml` in the Archi repository.
- Whether a permitted relationship is meaningful in a given model.

## Behavioural change against 0.4.0

Over all 39.600 combinations of 60 element types and 11 relationship types:

| | Combinations | Element pairs |
|---|---|---|
| Now permitted, previously rejected | 2091 | 1044 |
| Now rejected, previously permitted | 6544 | 2856 |

The second row is the more consequential one. The previous implementation
approved relationships the specification does not list anywhere, so its approval
carried no information.

### Examples of relationships that are now permitted

| Source | Relationship | Target |
|---|---|---|
| ApplicationComponent | Triggering | BusinessActor |
| ApplicationComponent | Flow | BusinessActor |
| ApplicationComponent | Triggering | BusinessRole |
| ApplicationComponent | Flow | BusinessRole |
| ApplicationComponent | Triggering | BusinessCollaboration |
| ApplicationComponent | Flow | BusinessCollaboration |
| ApplicationComponent | Triggering | BusinessInterface |
| ApplicationComponent | Flow | BusinessInterface |

### Examples of relationships that are now rejected

| Source | Relationship | Target |
|---|---|---|
| Stakeholder | Composition | Driver |
| Stakeholder | Aggregation | Driver |
| Stakeholder | Realization | Driver |
| Stakeholder | Serving | Driver |
| Stakeholder | Composition | Goal |
| Stakeholder | Aggregation | Goal |
| Stakeholder | Realization | Goal |
| Stakeholder | Serving | Goal |

## Regression tests

`src/relationships/validation.test.ts` pins three things: the validator agrees
with the generated matrix on all 39.600 combinations, the generated matrix still
matches `relationships.xml` when that file is reachable, and a handful of cells
read straight from Appendix B.5 come out as the specification prints them.
