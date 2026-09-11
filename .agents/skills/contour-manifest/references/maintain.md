Use this procedure for ordinary feature work, bug fixes, and ongoing manifest maintenance. Map the requested change to existing capabilities before adding an entry. Read the capability scoping reference when adding, updating, splitting, or merging a capability. Update affected parts, doors, contracts, decisions, and attention as needed. The add-only procedure applies to a request to record planned intent; it does not restrict an authorized implementation task to YAML or require implemented work to be marked planned.

Before broad codebase exploration, read `.contour/manifest/project.yaml`, the manifest slices relevant to the task, and any relevant files under `.contour/manifest/contracts/`. Treat them as a map, then verify affected claims against the code.

After changing code, update the affected manifest YAML files.

Follow the project manifest standing rule in the root agent instruction files: after your final edit, run the repository's required validation, including the locally installed `contour check`. Resolve failures and rerun affected checks before reporting completion. Use the repository's package-manager runner for the installed binary. Report commands and results or an explicit setup blocker; do not download a missing tool, bypass checks, weaken validation, or invent verification stamps.

Keep stable ids stable, record durable architectural choices in `decisions.yaml`, and do not edit marker-owned generated sections in `attention.yaml` by hand.

Each contract file contains one `contract-*` entry bound to exactly one owner: either `part: part-*` or `capability: cap-*`, never both or neither. Keep its `accepts`, `guarantees`, and `rules` as sequences of non-empty statements; use an empty sequence instead of inventing a promise. When affected behavior changes, keep those statements and their `verified_by` evidence honest, and update `last_verified` only after verifying the complete entry at the current commit.

When code and manifest disagree, update the manifest to describe the implemented truth or call out the unresolved mismatch in `attention.yaml`. An authored uncertainty in `attention.yaml` must reference the entry it concerns in `relies_on` using its stable id.

<!-- contour:skill version=0.6.0-19bf337432393f8d sha256=0a8efbf3f9e89e792f360b2207f5f14a2bfb3a580d643cddcb78c616bd74ce83 -->
