# AGENTS.md
## Project
Family Tree MVP: a private, shareable family tree with reliable relationship modeling, rich person cards, photos, and automatic layout.

## Principles
- Keep architecture simple; put complexity only in graph rules and tree layout.
- The family graph is authoritative; invalid states must never persist.
- Frontend validation improves UX; backend validation is authoritative.
- Do not persist derived siblings, layout coordinates, or rendering-only nodes.

## Stack
- TypeScript
- React + Vite + Tailwind CSS
- React Router + TanStack Query
- React Flow + ELK.js
- Fastify + Zod
- Supabase PostgreSQL, Auth, and Storage
- Vitest + pnpm

## Repository
```text
apps/
  web/src/
    app/
    features/{tree,people,photos,organizer}/
    components/
    lib/
  api/src/
    features/{trees,people,relationships,photos,sharing}/
    lib/
    server.ts
packages/
  family-core/src/
    person.ts
    graph.ts
    invariants.ts
    relationships.ts
    schemas.ts
supabase/migrations/
```

## Backend Conventions
Backend features normally contain:
- `*.routes.ts`: HTTP concerns only.
- `*.service.ts`: application/business logic.
- `*.queries.ts`: persistence only.
Flow: `route -> service -> queries/storage`, with services calling domain logic.
Avoid DI containers, CQRS, repositories, or extra layers without a concrete need.

## Shared Domain Logic
`packages/family-core` contains pure logic shared by web and API.
Examples: `validatePerson()`, `wouldCreateAncestryCycle()`, `validateParentRelationship()`, `deriveSiblings()`, `getSiblingType()`.
Keep it free of React, Fastify, Supabase, and storage concerns.

## Family Graph
Persist:
- people
- parent -> child relationships
- partnerships
Derive siblings and immediate relationship views.

Required invariants:
- `deathYear >= birthYear`
- parent birth year <= child birth year when both are known
- death year cannot be in the future
- living people cannot have a death year
- ancestry graph must remain acyclic
- maximum two parents per person
For MVP, cycle detection may load parent edges and run DFS in TypeScript.

## Database
Use PostgreSQL, not a graph database.
Suggested tables: `trees`, `people`, `parent_child`, `partnerships`, `photos`.
Use completeness flags to distinguish unknown from known absence, e.g. `children_complete`.
Use PostgreSQL arrays for small bounded data such as up to 3 fun facts.

## Supabase
Preferred data path: `React -> Fastify -> Supabase PostgreSQL / Storage`.
The frontend may use Supabase Auth; server-only credentials stay on the API.
Use SQL migrations as the schema source of truth.
Do not add Prisma or Drizzle unless query complexity creates a real need.

## Photos
Use one private bucket: `family-photos`.
Path: `trees/{treeId}/people/{personId}/{photoId}.jpg`.
Store only the storage path in PostgreSQL, never signed URLs.
Use signed upload URLs for browser uploads and short-lived signed URLs for viewing.
Do not create one bucket per tree or person.

## Tree Layout
Keep layout separate from persistence behind:
`layoutFamilyGraph(graph): PositionedFamilyGraph`
The layout layer may create temporary junction nodes, family-group nodes, routing edges, and x/y coordinates.
Do not persist those artifacts.
Prioritize realistic testing of multiple partners, half-siblings, large sibling groups, multi-generation branches, focus mode, and pan/zoom readability.

## Avoid for MVP
Do not add without demonstrated need:
- NestJS
- Prisma or Drizzle
- Redux or Zustand
- CQRS or event buses
- graph databases
- generic repositories
- background image workers
- multiple storage buckets
- microservices
- server-side layout
- persisted layout coordinates
- separate DTO/domain/entity models

## Decision Rule
Prefer the simpler design unless extra complexity directly improves graph correctness, tree layout quality, privacy, or organizer/viewer UX.

<!-- contour:manifest:start -->
## Project manifest standing rule

Capabilities are stable outcomes experienced by the product's intended users. Identify those users from the PRD or product brief; the developer working on the repository is not automatically a product persona. Developer-facing products can have developer users and real CLI or API surfaces.

Before adding or updating a capability, ask:
1. Can a product persona say, “I can now ___”?
2. Would the outcome stay conceptually the same if the technical stack changed?
3. Through which product surface can (or will) that user exercise it?

Route setup and technology choices to `project.yaml`; system parts, infrastructure, libraries, validation engines, and persistence to `boundaries.yaml`; guarantees and invariants to part-owned `contracts/`; pages, endpoints, commands, and jobs to `surface.yaml`; and durable reasons to `decisions.yaml`. For example, “Validate and derive a family graph” belongs in a part and its contract; “Connect family members without impossible relationships” is a user capability. Do not create one capability per implementation commit or technical milestone. Reuse stable capability IDs across commits, linking foundations through `relies_on` and their contracts.

Capability statuses describe the user outcome:
- `planned`: the outcome has been chosen; no completed implementation is claimed. Empty references and an omitted `last_verified` are honest here.
- `in-progress`: some implementation exists, but the outcome is not yet usable and verified end to end.
- `shipped`: the intended user can complete the outcome through a real product surface, with end-to-end verification evidence. Record its `doors` and genuine `verified_by` paths. Unit tests of a foundation alone do not establish delivery; respect the builder's manual acceptance requirements and never invent evidence.

For greenfield work, seed a small outcome checklist from the PRD's MVP user loop before implementation. Keep unbuilt outcomes planned, and advance the same entries as work progresses. For existing code, distinguish implemented outcomes from documented plans; do not infer a roadmap from folders or commits. Completed foundations can coexist with zero shipped capabilities. A shipped part or contract does not automatically ship its dependent capabilities. Semantic warnings are prompts for review, not proof that an outcome is wrong; confirm the evidence before changing status or ownership.

Before broad codebase exploration, read `.contour/manifest/project.yaml`, the manifest slices relevant to the task, and any relevant files under `.contour/manifest/contracts/`. Treat them as a map, then verify affected claims against the code.

After changing code, update the affected manifest YAML files. Run the repository's required validation command, including the manifest check, after your final code or manifest edit. If validation does not yet include it, run the locally installed `contour check` explicitly. Resolve check failures and rerun the affected checks before declaring the task complete. Report the commands run and their results. If a check cannot run, report the blocker explicitly and do not claim it passed. Do not bypass checks, weaken validation, or invent verification stamps to make the result pass.

Use the repository's package-manager runner for the installed binary; do not download a missing package as part of validation. An unavailable tool is a setup blocker to report. Keep stable ids stable, record durable architectural choices in `decisions.yaml`, and do not edit marker-owned generated sections in `attention.yaml` by hand.

Each contract file contains one `contract-*` entry bound to exactly one owner: either `part: part-*` or `capability: cap-*`, never both or neither. Keep its `accepts`, `guarantees`, and `rules` as sequences of non-empty statements; use an empty sequence instead of inventing a promise. When affected behavior changes, keep those statements and their `verified_by` evidence honest, and update `last_verified` only after verifying the complete entry at the current commit.

When code and manifest disagree, update the manifest to describe the implemented truth or call out the unresolved mismatch in `attention.yaml`. An authored uncertainty in `attention.yaml` must reference the entry it concerns in `relies_on` using its stable id.
<!-- contour:manifest:end -->
