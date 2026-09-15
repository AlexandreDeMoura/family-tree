# Manifest schema

All manifest paths are relative to `.contour/manifest/`.

| File | Shape |
| --- | --- |
| `project.yaml` | Mapping with optional `purpose`, `tech` string list, `entry_points` code references, positive integer `stale_after_commits` (default 30), and `release_groups`. |
| `capabilities.yaml` | Sequence of user capabilities (`cap-*`). |
| `boundaries.yaml` | Sequence of runtime parts (`part-*`). |
| `surface.yaml` | Sequence of pages, endpoints, commands, or other doors (`door-*`). |
| `decisions.yaml` | Sequence of durable decisions (preserve the project's existing ID prefix). |
| `attention.yaml` | Sequence of authored uncertainties (`attention-*`), plus Contour's generated findings block. |
| `contracts/*.yaml` | One contract mapping per file (`contract-*`). |

Collection and contract files can be empty or comments-only. Entries require a globally unique lowercase kebab-case `id`, nonempty `name` and `why`, and `status` (`planned`, `in-progress`, or `shipped`). Author these lists explicitly, using `[]` for unknown or absent items:

- `code` and `verified_by`: repository-relative path strings, or mappings with `path` and optional nonempty `symbol`. Resolved paths must stay inside the repository. Verification references must be genuine evidence.
- `relies_on`: IDs of dependencies. For authored attention, include the IDs of the entries the uncertainty concerns.
- `doors`: IDs of product entry points in `surface.yaml`.
- `open_questions`: nonempty question strings.

`last_verified` is an optional Git commit stamp. Set it only after checking the complete entry against the implementation. A supplied stamp must resolve to a reachable ancestor of HEAD. Missing stamps produce findings except on planned capabilities. Do not fabricate stamps or change status just to silence a check. Freshness is unavailable without readable Git history.

Capabilities may also carry review preparation and evidence:

```yaml
implementation: complete
automated_verification:
  - scope: "A customer completes checkout with a valid card."
    outcome: passed
    method: "End-to-end test"
    evidence:
      path: test/checkout.test.ts
      symbol: checkoutFlow
    checked_revision: abc1234
review_instructions:
  - summary: "Complete checkout and confirm the receipt shows the submitted total."
    source:
      path: docs/checkout.md
      section: Manual review
```

`implementation` is optional and accepts `not-started`, `partial`, or `complete`. Each `automated_verification` item requires a nonempty `scope` and an `outcome` of `passed`, `failed`, `mixed`, or `incomplete`; `method`, a repository-relative `evidence` code reference, and nonempty `checked_revision` are optional. Record only results that actually ran, including failures, mixed coverage, and incomplete checks. Do not infer a result from `verified_by`, delivery status, or a supporting part.

Each `review_instructions` item requires a concise nonempty `summary`. Its optional `source` has a repository-relative `path` and optional nonempty `section`. The summary must remain useful if the source cannot be resolved. Keep full procedures in the linked document; do not add checklist state. Capability-owned `review_instructions` are authoritative for “What to check.” A capability also inherits explicitly authored `review_instructions` from its directly bound and supporting-part contracts, with capability-owned summaries first and exact duplicate summaries once. Contract `rules` remain contract evidence and never become manual review instructions.

`acceptance_history` is not an authoring field. It is server-owned lifecycle history written only after the human builder chooses Accept or Reopen in Contour's local web view. Never create, edit, backfill, or delete those events and never call the acceptance endpoint. Accept atomically appends the event and sets `status: shipped`. Reopen appends its event and preserves delivery status. Neither action changes implementation or verification evidence, `verified_by`, or `last_verified`. Agents must not imitate these human actions by editing status or history.

`project.yaml` may define explicit release membership:

```yaml
release_groups:
  - id: first-release
    name: First release
    capabilities: [cap-checkout, cap-order-history]
```

Group IDs are stable lowercase kebab-case, names are nonempty, and `capabilities` must be a nonempty list of existing `cap-*` IDs. IDs must be unique. Do not infer membership from `relies_on`, create empty placeholder groups, or author gates and blocked outcomes. Invalid groups are authoring diagnostics and are omitted from builder-facing readiness; readiness itself is derived and never written to the manifest.

Contracts additionally require exactly one owner: `capability: cap-*` or `part: part-*`. Never supply both or neither. `accepts`, `guarantees`, and `rules` are optional lists of nonempty statements. Use empty lists when no supported promise is known. Capabilities inherit contracts from parts in `relies_on`. A contract may use the same `review_instructions` shape only for a reusable human exercise; do not copy its `rules` into that field.

Example of unbuilt intent:

```yaml
- id: cap-manage-relatives
  name: Create, edit, and delete a relative in a selected family tree
  status: planned
  why: Lets an organizer maintain relative records in the selected tree; excludes connecting relationships and sharing access.
  code: []
  verified_by: []
  relies_on: []
  doors: []
  open_questions: []
```

Preserve authored ordering, comments, unknown fields, and stable IDs. Existing manifests require no migration: do not backfill review fields, acceptance history, or release groups. Do not hand-edit the block between `# contour:generated-attention:start` and `# contour:generated-attention:end`. Plain `contour check` is read-only; only explicit `contour check --write` refreshes generated findings. Mechanical checks cover YAML, fields, references, paths, and freshness, not semantic correctness or manual acceptance.

<!-- contour:skill version=0.8.0-2378d3b4632e2902 sha256=d125127628035b23774072ae110fd105b9ac4b3d55cb49c9c7676b34e37fb752 -->
