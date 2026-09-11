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

Before creating or modifying manifest entries, or implementing changes that affect recorded product behavior, read `.agents/skills/contour-manifest/SKILL.md` and follow the relevant procedure. Read that file directly if your agent does not discover skills automatically. Its references contain the complete capability scope rules, schema, examples, and task procedures; no Contour webapp action is required.

Capabilities are bounded user tasks with observable results. Keep their boundaries independent of implementation commits, reuse existing IDs for the same task, and keep evidence and delivery status honest. After changing code, update the affected manifest YAML files. Respect the builder's manual acceptance requirements.

Follow the project manifest standing rule in the root agent instruction files: after your final edit, run the repository's required validation, including the locally installed `contour check`. Resolve failures and rerun affected checks before reporting completion. Use the repository's package-manager runner for the installed binary. Report commands and results or an explicit setup blocker; do not download a missing tool, bypass checks, weaken validation, or invent verification stamps.
<!-- contour:manifest:end -->
