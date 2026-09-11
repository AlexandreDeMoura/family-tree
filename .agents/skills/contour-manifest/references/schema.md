# Manifest schema

All manifest paths are relative to `.contour/manifest/`.

| File | Shape |
| --- | --- |
| `project.yaml` | Mapping with optional `purpose`, `tech` string list, `entry_points` code references, and positive integer `stale_after_commits` (default 30). |
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

Contracts additionally require exactly one owner: `capability: cap-*` or `part: part-*`. Never supply both or neither. `accepts`, `guarantees`, and `rules` are optional lists of nonempty statements. Use empty lists when no supported promise is known. Capabilities inherit contracts from parts in `relies_on`.

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

Preserve authored ordering, comments, unknown fields, and stable IDs. Do not hand-edit the block between `# contour:generated-attention:start` and `# contour:generated-attention:end`. Plain `contour check` is read-only; only explicit `contour check --write` refreshes generated findings. Mechanical checks cover YAML, fields, references, paths, and freshness, not semantic correctness or manual acceptance.

<!-- contour:skill version=0.6.0-19bf337432393f8d sha256=2ca8492919a14f6db1c79a6bb94a11f369bab5d7b1288e7dfd8996292b9ced99 -->
