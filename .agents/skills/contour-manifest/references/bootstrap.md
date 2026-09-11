Read `.contour/manifest/project.yaml` first, then inspect the repository economically. Work in this order:

1. Surface: inventory user-visible and machine-facing doors in `.contour/manifest/surface.yaml`.
2. Boundaries: map the major runtime parts and ownership boundaries in `.contour/manifest/boundaries.yaml`.
3. Capabilities: derive bounded user tasks from current product behavior, compare the whole list for umbrellas, duplicates, and interaction details, then describe them in `.contour/manifest/capabilities.yaml`, linking them to the relevant parts and doors. Do not translate the folder structure, feature plan, or commit history into one entry per item.
4. Contracts: add one YAML file per important capability or part under `.contour/manifest/contracts/` when its promises and rules are evident from code and focused tests.

Fill `project.yaml` with the repository purpose, technologies, entry points, and the default staleness threshold. Leave `decisions.yaml` empty: do not infer historical decisions that the repository cannot prove. Keep `attention.yaml` for concrete uncertainties or contradictions that need human review.

Every contract file contains exactly one contract. A contract binds to exactly one owner: use either `capability: cap-*` or `part: part-*`, never both and never neither. Use this complete capability-owned shape:

```yaml
id: contract-checkout-total
capability: cap-checkout
name: Checkout total
status: shipped
why: "Keeps the amount shown to a customer consistent with the amount submitted."
code: [src/checkout/]
verified_by: [test/checkout.test.ts]
relies_on: []
doors: [door-checkout-page]
open_questions: []
accepts:
  - "A cart whose items have valid prices and quantities."
guarantees:
  - "The submitted total matches the displayed total."
rules:
  - "An order total is never negative."
last_verified: abc1234
```

For a part-owned contract, replace the `capability` line with a single `part: part-*` binding and keep the same remaining fields. `accepts`, `guarantees`, and `rules` are sequences whose authored statements must be non-empty. Use `[]` when no evidenced statement is known rather than inventing a promise. Record only behavior supported by the current code and focused tests, cite genuine repository-relative evidence in `verified_by`, and set `last_verified` only when the entire entry is accurate at that commit. Put uncertainty in `attention.yaml` instead of presenting it as a contract.

Use stable lowercase kebab-case ids with the prefixes shown in the scaffold examples. Reference repository-relative paths, verify every claim against the code, and do not modify product code during this bootstrap.

<!-- contour:skill version=0.6.0-19bf337432393f8d sha256=cf3ae9063b5b46e651ad8836cd7fcb0529480ffce31ead90050ff77ab84691a2 -->
