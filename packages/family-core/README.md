# Family core

Pure TypeScript and Zod shared by web and API. All exports are available through
`@family-tree/family-core`; this package has no framework, storage, or clock access.

`createPersonSchema(currentYear)` and `validatePerson(input, currentYear)` validate
person fields and birth/death invariants. Callers supply the current calendar year.
Life statuses are `living`, `deceased`, and `unknown`; years are nullable integers.
Unknown status stays explicit even when dates are provided. Any supplied death year
must not be in the future. The PRD does not impose a minimum year, a future-birth
restriction, or a minimum parent age, so the domain adds none.

Names and facts are trimmed and nonempty; at most three facts are allowed. Adoption
defaults to false, years/main photo to null, and facts to an empty list. The boolean
`parentsComplete`, `partnersComplete`, and `childrenComplete` fields default to false.
An empty edge list plus false means unknown; an empty list plus true means known
absence. Completeness also applies to nonempty lists and does not forbid later edits.

`ageBucketSchema` accepts `baby_toddler`, `kid`, `adolescent`, `20s`, `30s`, `40s`,
`50s`, `60s`, `70s`, `80s`, and `90s_plus`. Each value describes one photo bucket.
Photo records and main-photo ownership validation follow with persistence/photos.

A `FamilyGraph` contains `treeId`, `people`, `parentChild`, and `partnerships`.
People have opaque string IDs and a tree ID. Edges reference people within that
graph: `{ parentId, childId }` or `{ person1Id, person2Id }`. Partnership schemas
canonicalize the unordered pair lexicographically without changing input objects.
Strict object schemas reject unknown fields, including stored siblings and layout data.

`createFamilyGraphSchema(currentYear)` checks structure and person fields.
Use **`validateFamilyGraph(input, currentYear)`** to additionally enforce endpoint
existence, tree membership, unique people/edges, two parents, parent-year ordering,
and acyclic ancestry. Its result is `{ success: true, data }` or
`{ success: false, issues }`; issues carry stable codes, messages, paths, and
conflicting IDs where available. Schema issues identify values through their paths.

```ts
import { validateParentRelationship, validatePersonEdit } from '@family-tree/family-core';

const relationship = validateParentRelationship(graph, { parentId, childId }, currentYear);
const edit = validatePersonEdit(graph, { ...existingPerson, birthYear: 1970 }, currentYear);
```

`validateParentRelationship` and `validatePartnership` validate proposed additions.
`validatePersonEdit` takes a complete replacement for an existing ID: merge patches
before calling it. It revalidates both incoming and outgoing parent edges.
All return a validated new graph on success and leave inputs untouched. For edge
replacements/removals, construct the proposed snapshot and use `validateFamilyGraph`.
Future API services must repeat these checks under the same tree transaction lock
before persistence; these functions alone do not implement authorization or locking.

`wouldCreateAncestryCycle` checks a proposed parent edge with iterative DFS;
`findAncestryCycle` checks a whole edge set, including disconnected components.
Neither uses recursive calls, so long ancestry paths do not overflow the call stack.

On a validated graph, `deriveParents`, `deriveChildren`, `derivePartners`, and
`deriveSiblings` produce relationship views in people order. `deriveImmediateFamily`
combines them. `getSiblingType` returns `full`, `half`, or null: two shared known
parents means full; exactly one means half, even when it is both people's only known
parent. Unknown parents are never invented. Adoption does not alter these rules.
Partnerships do not imply parent edges, and shared children do not imply partnerships.

Run domain tests with `pnpm exec vitest run packages/family-core/src` from the root,
and the complete repository checks with `pnpm validate`. UI QA remains manual.
