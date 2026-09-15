Inspect only the code and related manifest entries needed to validate these claims. Correct stale paths, relationships, status, rationale, open questions, implementation declarations, review instructions, and actual automated results in the owning manifest file. Preserve failing, mixed, and incomplete results honestly. Set `last_verified` to the current commit only after the entry is accurate. If a claim cannot be resolved mechanically, add a concrete attention item instead of guessing. Do not change product code as part of this verification.

Re-verification is evidence maintenance, not human acceptance. Never add, edit, or remove `acceptance_history`, never call the acceptance endpoint, and never accept or reopen the capability for the builder. Source changes do not revoke or manufacture lifecycle events, and acceptance state does not authorize a delivery-status change.

For a capability, compare its scope with the other capabilities before confirming it. Keep the same ID for the same task. If correcting scope requires a split or merge and changes to other entries or contract ownership, record the proposed correction in an attention item linked to this entry; do not partially migrate references during an entry-scoped verification.

<!-- contour:skill version=0.7.1-34753fb6f4b3209f sha256=e5057166314e61d3bc9912275a82b680ad3978ab90a64d47061ad4dfc9d95c17 -->
