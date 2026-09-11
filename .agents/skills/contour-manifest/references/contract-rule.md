Use the target capability and rule from the task. Inspect its current contracts when no target contract state is supplied.

If the target state identifies an existing contract, edit that exact file and entry. Preserve its existing `part` or `capability` binding and its authored accepts, guarantees, and rules unless the new rule requires a precise correction.

If no target contract exists, inspect the capability and related manifest entries, then create one YAML file under `.contour/manifest/contracts/` containing exactly one contract. Use a stable lowercase kebab-case `contract-*` id, bind it with `capability` set to the target capability ID, and give it an honest name and rationale. Include the contract fields `id`, `capability`, `name`, `status`, `why`, `code`, `verified_by`, `relies_on`, `doors`, `open_questions`, `accepts`, `guarantees`, and `rules`; use empty sequences for unknown references or statements rather than inventing them.

Make the rule true in product code and focused tests before claiming it in the contract. Add the rule once, update `verified_by` only with repository-relative paths that genuinely verify it, and update `last_verified` only when the completed entry is accurate at the current commit. Do not record an aspiration as an implemented promise, and avoid unrelated edits.

<!-- contour:skill version=0.6.0-19bf337432393f8d sha256=8ef7512469d642bfbef757205b51755cbaead60da73f0284527297c9e7792681 -->
