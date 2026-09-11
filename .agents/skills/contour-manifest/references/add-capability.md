If the request describes technical work or an interaction detail, explain its proper manifest home or owning capability instead of adding an entry. If the ability already exists, report its ID rather than adding a duplicate or resetting its status. If the request bundles separate tasks, propose bounded capability names and explain the split; do not force them into one entry or invent which task the builder intended. Otherwise follow the creation instructions below.

For one distinct, bounded task, add one honest `status: planned` entry, choose a stable lowercase kebab-case id with the existing capability prefix, and fill the required fields: `id`, `name`, `status`, `why`, `code`, `verified_by`, `relies_on`, `doors`, and `open_questions`. Use empty lists when a relationship or reference is not known yet rather than inventing evidence, and do not add `last_verified` until the capability has been verified against implementation.

Preserve the file’s authored ordering and formatting conventions. Edit only `.contour/manifest/capabilities.yaml`; avoid unrelated manifest or product-code changes.

<!-- contour:skill version=0.6.0-19bf337432393f8d sha256=45c3b428b343ca247af312c2faa1ccdd114ddf0af39592339377cee1f0e741be -->
