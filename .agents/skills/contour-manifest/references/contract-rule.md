Use the target capability and rule from the task. Inspect its current contracts when no target contract state is supplied.

If the target state identifies an existing contract, edit that exact file and entry. Preserve its existing `part` or `capability` binding and its authored accepts, guarantees, and rules unless the new rule requires a precise correction.

If no target contract exists, inspect the capability and related manifest entries, then create one YAML file under `.contour/manifest/contracts/` containing exactly one contract. Use a stable lowercase kebab-case `contract-*` id, bind it with `capability` set to the target capability ID, and give it an honest name and rationale. Include the contract fields `id`, `capability`, `name`, `status`, `why`, `code`, `verified_by`, `relies_on`, `doors`, `open_questions`, `accepts`, `guarantees`, and `rules`; use empty sequences for unknown references or statements rather than inventing them.

Make the rule true in product code and focused tests before claiming it in the contract. Add the rule once, update `verified_by` only with repository-relative paths that genuinely verify it, and update `last_verified` only when the completed entry is accurate at the current commit. Do not record an aspiration as an implemented promise, and avoid unrelated edits.

If the rule needs a distinct human exercise, add or update a concise `review_instructions` summary on the target capability, with an optional repository-relative source document and section. Only put the instruction on the contract when the same manual exercise genuinely applies to every capability that inherits it. Contract `rules` stay in evidence and never enter “What to check” by themselves, so do not copy a rule into review guidance unless it describes a real human exercise. Do not create an acceptance event or invoke the acceptance endpoint after implementing or documenting the rule; the builder owns that decision.

<!-- contour:skill version=0.8.0-2378d3b4632e2902 sha256=f305fb601a20c6949cb9d1271915c01eb4ed7ea339ad0c31ed31f81d0071c456 -->
