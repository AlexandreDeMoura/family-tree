# Family Tree — Constrained MVP PRD

## 1. Product Summary

A beautiful, easy-to-digest family tree for large families.

The product is designed around two complementary users:

- **Primary user:** the family organizer who builds and maintains the tree.
- **Secondary user:** the casual relative who browses the tree to understand who people are and how the family is structured.

The MVP is successful only if the organizer can create a useful tree **and** casual relatives can immediately get value from browsing it.

---

## 2. Problem

Large families with many branches are difficult to understand, remember, and explain.

Traditional family trees are often:

- visually cluttered,
- overly genealogy-focused,
- difficult for casual relatives to browse,
- poor at conveying personality, memories, and visual history.

Families need a representation that makes relationships understandable while also making each person feel memorable and human.

### Problem statement

> Families with many branches struggle to visualize relationships and preserve photos and memorable facts in a way that is beautiful, simple, and engaging for relatives.

---

## 3. MVP Goal

Enable one family organizer to build a visually clear family tree from scratch and share it through a private link so casual relatives can browse it without an account.

### Primary MVP success criterion

> A casual relative can open the tree and correctly understand one unfamiliar branch of the family without asking the organizer for help.

---

## 4. Product Principles

### 4.1 Tree first

The family tree is the primary navigation and comprehension surface.

Rich person cards are the secondary surface.

### 4.2 Organizer effort must create viewer value

Every meaningful piece of data entered by the organizer should visibly improve the browsing experience.

### 4.3 Incomplete information should feel intriguing, not broken

Missing data should create curiosity and encourage completion without feeling like an error state.

The product must distinguish between:

- **unknown information**, and
- **known absence**.

Example:

- `Children unknown`
- `No children`

These are not equivalent states.

### 4.4 Deceased relatives must retain equal visual importance

Deceased relatives must never appear less important than living relatives.

The UI must avoid:

- grayscale treatment,
- reduced opacity,
- desaturation,
- smaller nodes,
- visual fading,
- negative or culturally loaded symbols such as skulls.

A subtle, positive, respectful visual indicator should be used instead.

This is a deliberate cultural design requirement: the product must not imply that deceased family members are less relevant or less present in the family story.

### 4.5 The family graph is authoritative

Relationships shown in the UI must be derived from a valid family graph.

The app must never persist an invalid family state.

---

## 5. Users

### 5.1 Family Organizer

The organizer:

- creates the tree,
- adds people,
- defines relationships,
- uploads photos,
- adds fun facts,
- edits information,
- shares the tree.

For MVP, there is exactly one organizer with edit permissions.

### 5.2 Casual Relative

The viewer:

- opens a private link,
- does not need an account,
- browses the tree,
- opens person cards,
- explores related people,
- views photos from different life stages,
- reads fun facts.

Viewers are read-only in MVP.

---

## 6. Core User Loop

1. Organizer adds a person.
2. Organizer connects them to the family graph.
3. Organizer adds photos and fun facts.
4. The person becomes visible in the family tree.
5. Organizer shares a private link.
6. Relative opens the tree.
7. Relative navigates the family visually.
8. Relative opens people and discovers relationships, photos, and memorable facts.

---

## 7. MVP Scope

### Included

- One organizer
- Manual tree creation from scratch
- Private unlisted sharing link
- Read-only viewers
- No viewer account required
- Interactive family tree
- Automatic layout
- Hybrid full-tree + focus navigation
- Rich person cards
- Parent relationships
- Partner relationships
- Children
- Full siblings
- Half-siblings
- Multiple partners
- Adoption badge
- Living / deceased / unknown status
- Positive deceased indicator
- Birth year
- Death year
- Photos categorized by age bucket
- Up to 3 free-text fun facts
- Unknown-information indicators
- Front-end validation
- Authoritative server-side validation

### Explicitly out of scope for MVP

- Collaborative editing
- Viewer contributions
- Comments
- Reactions
- Messaging
- Public tree discovery
- Relationship labels such as `uncle`, `cousin`, or `grandfather`
- Viewer identity selection
- GEDCOM import
- Import from genealogy services
- AI-assisted family extraction
- WhatsApp/photo dump ingestion
- Manual node positioning
- Rich story timelines
- Documents
- Marriage dates
- Divorce dates
- Guardianship
- Step-parent semantics
- Biological-vs-adoptive parent graph modeling
- More than two parents
- Exact birth dates
- Exact death dates
- Automatic age estimation
- Automatic photo age estimation
- Family relationship calculation
- Advanced pedigree-collapse handling

---

## 8. Family Tree Experience

## 8.1 Tree Node

Each visible tree node contains:

- Main photo
- First name
- Last name
- Birth year

Optional visual indicators may also appear for:

- adopted person,
- deceased person,
- incomplete information.

These indicators must remain subtle and must not overwhelm the core node content.

---

## 8.2 Tree Layout

The tree is laid out entirely by the application.

The organizer cannot manually position nodes.

### Layout rules

- Generations are arranged on horizontal rows.
- Older generations appear above younger generations.
- Partners are positioned together.
- Children appear below the relevant parent or parent pair.
- Multiple-partner family structures must be supported.
- Half-sibling branches must remain understandable.
- Large trees support pan and zoom.

---

## 8.3 Hybrid Navigation

The tree combines full-tree navigation with person-focused navigation.

### Default state

The viewer can see and navigate the broader family tree.

### Focus state

When a person is selected:

- that person becomes visually prominent,
- nearby family relationships remain prominent,
- distant branches may fade or collapse,
- the viewer retains enough surrounding context to understand where the selected person sits in the family.

The person card opens without losing tree context.

---

## 9. Person Card

A tree node opens a rich person card.

## 9.1 Collapsed / Summary Content

The compact representation should prioritize:

- photo,
- name,
- birth year.

---

## 9.2 Expanded Card Content

The expanded card contains:

- Main portrait
- Photo gallery
- Photo age-bucket selector
- Birth/death information
- Living/deceased/unknown status representation
- Adoption mention when applicable
- Up to 3 fun facts
- Expandable family relationship sections

### Relationship sections

The card contains four sections:

- Parents
- Brothers / Sisters
- Partner(s)
- Kids

Each section can expand.

Each listed person is clickable and opens that person's card while preserving tree context.

---

## 10. Family Graph Model

## 10.1 Source of Truth

The graph stores **parent → child** relationships.

Sibling relationships are derived.

The organizer must never directly declare that two people are siblings.

---

## 10.2 Parent Relationships

A person may have:

- 0 known parents,
- 1 known parent,
- 2 known parents.

Unknown parents are valid.

The MVP supports at most two parents per person.

---

## 10.3 Siblings

### Full siblings

Two people are full siblings when they share both known parents.

### Half-siblings

Two people are half-siblings when they share exactly one parent.

Half-siblings are part of the MVP.

They must be represented naturally through the shared parent and the parent's other partner branch.

In the expanded `Brothers / Sisters` section, a subtle `Half` indicator may distinguish a half-sibling from a full sibling.

---

## 10.4 Partners

A person may have multiple partners.

This is required to represent remarriages, sequential relationships, and half-sibling branches.

The MVP does not model:

- marriage dates,
- divorce dates,
- relationship chronology beyond structural family connections.

---

## 10.5 Adoption

Adoption is represented as person-level metadata in MVP.

An adopted person:

- gets an `Adopted` badge on their tree node,
- has adoption mentioned in their expanded card,
- otherwise participates in parent/child relationships normally.

The MVP does not create:

- alternate biological-parent graph representations,
- alternate line styles,
- separate adoptive and biological relationship types.

---

## 11. Person Data Model

Each person may contain:

### Required / Core

- First name
- Last name
- Life status: `Living`, `Deceased`, or `Unknown`

### Optional

- Birth year
- Death year
- Main photo
- Additional photos
- Adoption flag
- Up to 3 fun facts

Some fields may be unknown.

The product must distinguish unknown information from an explicitly known absence where applicable.

---

## 12. Life Status

Life status is explicit and must never be inferred from age or birth year.

Allowed values:

- `Living`
- `Deceased`
- `Unknown`

---

## 13. Birth and Death Information

## 13.1 Birth

MVP stores only:

- optional birth year.

Exact birth dates are out of scope.

Examples:

- `Born 1974`
- `Birth year unknown`

---

## 13.2 Death

For deceased people:

- death year is optional.

Examples:

- `1942–2018`
- `1942–?`
- `?–2018`
- `Dates unknown`

The deceased indicator is independent of whether birth/death years are known.

---

## 13.3 Age

The MVP does not calculate or display current age.

Reason:

A known birth year without a birth date cannot produce an exact current age reliably.

Use birth year instead.

---

## 14. Deceased Person Visual Treatment

Deceased relatives receive a subtle, respectful, positive visual indicator.

### Requirements

The indicator:

- must not use a skull,
- must not use a tombstone,
- should avoid religiously specific symbolism,
- should avoid culturally negative symbolism,
- must not reduce node prominence.

Deceased nodes must not be:

- gray,
- faded,
- desaturated,
- smaller,
- visually deprioritized.

The final iconography is a design exploration and is not prescribed by the PRD.

---

## 15. Photos

Each uploaded photo must be assigned to exactly one age bucket.

### Age buckets

- Baby / Toddler
- Kid
- Adolescent
- 20s
- 30s
- 40s
- 50s
- 60s
- 70s
- 80s
- 90s+

The organizer chooses the category that best represents the person's approximate age in the photo.

Precise photo year is not required.

Automatic age estimation is out of scope.

### Viewer behavior

The expanded card allows viewers to browse photos by age bucket, enabling experiences such as:

> seeing a grandfather when he was young.

---

## 16. Fun Facts

Each person can have up to 3 fun facts.

### Format

- Short
- Free text
- No category
- No rich formatting

Examples:

- `Owned a bakery in Lyon`
- `Had 11 children`
- `Could play accordion by ear`

---

## 17. Unknown and Incomplete Information

Unknown information should have a subtle visual treatment designed to create curiosity rather than frustration.

### Examples

- Missing photo → tasteful portrait placeholder
- Unknown birth year → subtle `Year unknown`
- Unknown parent → understated placeholder
- Incomplete person → small positive discovery/completion indicator

### Prohibited treatment

Unknown information must not use:

- red error states,
- warning triangles,
- blocking warnings when the data is legitimately unknown,
- visually degraded person nodes,
- aggressive completion nags.

### Viewer vs organizer behavior

Both viewers and organizers may see that information is incomplete.

Only the organizer receives editing affordances.

---

## 18. Known Absence vs Unknown

The data model must preserve the difference between:

- a fact being unknown,
- a fact being known not to exist.

Examples:

| Field | Known value | Unknown | Known absence |
|---|---|---|---|
| Birth year | 1952 | Unknown | N/A |
| Death year | 2019 | Unknown | N/A if living |
| Parents | Jean + Anne | Unknown | Rare / exceptional |
| Partner | Marie | Unknown | No partner |
| Children | Sophie + Marc | Unknown | No children |

This distinction must remain available to the UI.

---

## 19. Sharing and Permissions

## 19.1 Organizer

- Exactly one organizer can edit the tree in MVP.

## 19.2 Viewer

- Viewers are read-only.
- Viewers do not need an account.

## 19.3 Private Link

The organizer can share an unlisted private link.

Anyone with the link can view the tree.

### Product caveat

A private link is convenient rather than strongly private.

The MVP does not attempt to prevent access if the link is forwarded.

The tree must not be publicly indexed or discoverable through the product.

---

## 20. Relationship Labels

The MVP does not calculate or display relationship labels such as:

- uncle,
- aunt,
- cousin,
- grandfather,
- niece,
- nephew.

Relationships are understood visually through the tree and explicit parent/partner/child structure.

---

## 21. Validation and Domain Invariants

Invalid family states must never be persistable.

All domain invariants are enforced:

1. immediately in the front end for UX,
2. authoritatively on the server.

The server remains the source of truth even if client-side checks are bypassed.

---

## 21.1 Death Year Must Not Precede Birth Year

When both values are known:

`deathYear >= birthYear`

Violation blocks creation or update.

---

## 21.2 Parent Cannot Be Younger Than Child

When both birth years are known:

`parent.birthYear <= child.birthYear`

Violation blocks relationship creation or update.

Because only years are stored, the same birth year is technically allowed.

If either birth year is unknown, this rule cannot be evaluated and does not block the action.

---

## 21.3 Death Year Cannot Be in the Future

For a deceased person:

`deathYear <= currentYear`

Violation blocks creation or update.

---

## 21.4 Living Person Cannot Have a Death Year

If:

`lifeStatus = Living`

then:

`deathYear = null`

Violation blocks creation or update.

---

## 21.5 Family Graph Must Remain Acyclic

The graph may never contain ancestry cycles.

A person cannot become:

- their own parent,
- their own ancestor,
- their own descendant,
- directly or indirectly part of a cyclical ancestry relationship.

Any mutation that introduces a cycle must be blocked.

---

## 21.6 Validation UX

The front end should:

- validate as early as practical,
- show the rule that was violated,
- identify the conflicting person or value,
- prevent submission while an invariant is violated.

Validation should be specific rather than generic.

Example:

> `Jean cannot be added as Marie's parent because Jean's birth year is later than Marie's.`

The server must repeat all validation independently.

---

## 22. Tree Creation Flow

The MVP starts from scratch.

### Suggested organizer flow

1. Create the first person.
2. Add another person.
3. Connect them as parent, child, or partner.
4. Add birth/life information.
5. Upload main photo.
6. Upload additional photos and assign age buckets.
7. Add up to 3 fun facts.
8. Repeat.

There is no spreadsheet-style genealogy editor in MVP.

---

## 23. Core User Stories

### Organizer

As an organizer, I can:

- create a family tree from scratch,
- add a person,
- edit a person,
- define parents,
- define partners,
- define children,
- create multiple-partner branches,
- represent half-siblings correctly,
- mark someone as adopted,
- mark someone as living, deceased, or unknown,
- enter birth/death years,
- upload photos,
- categorize photos by life stage,
- add up to 3 fun facts,
- see which information remains unknown,
- share the tree through a private link.

### Viewer

As a casual relative, I can:

- open the private link without an account,
- see the broader family tree,
- pan and zoom,
- focus on a selected person,
- open their expanded card,
- browse photos by age bucket,
- read fun facts,
- inspect parents,
- inspect siblings,
- identify half-siblings,
- inspect partners,
- inspect children,
- navigate from one person's card to another,
- understand an unfamiliar branch without assistance.

---

## 24. MVP Acceptance Criteria

The MVP is ready when:

### Creation

- An organizer can create a multi-generation family tree from scratch.
- Multiple partners are supported.
- Half-siblings are derived correctly.
- Unknown parents are supported.
- Adoption can be represented.
- Invalid ancestry relationships cannot be persisted.

### Browsing

- A viewer can open the shared tree without authentication.
- Large family structures can be navigated through pan/zoom.
- Selecting a person provides focused context.
- Person cards allow navigation to immediate family members.
- Photos can be browsed by age bucket.
- Fun facts are visible and readable.

### Visual design

- The tree remains understandable with large branches.
- Missing information looks incomplete but not broken.
- Deceased relatives retain equal visual prominence.
- Adoption and deceased indicators remain subtle.
- No negative deceased iconography is used.

### Data integrity

All five domain invariants are enforced on both client and server.

---

## 25. Key MVP Risks

### 25.1 Tree readability

Large family branches may become visually dense.

The hybrid navigation model and automatic layout must be tested with realistically large families, not only small demo trees.

### 25.2 Organizer effort

Manual creation can be time-consuming.

The creation experience must make each added person feel immediately useful and visible.

### 25.3 Auto-layout complexity

Half-siblings, multiple partners, and large sibling groups can create difficult layouts.

Layout quality is a core product capability, not cosmetic polish.

### 25.4 Privacy expectations

Users may interpret `private link` as stronger privacy than it provides.

The UI should communicate that anyone with the link can access the tree.

### 25.5 Cultural sensitivity

Visual treatment of deceased relatives and family structures must avoid assumptions that work only in one cultural context.

---

## 26. Future Opportunities — Not MVP Commitments

Potential later directions include:

- Family collaboration
- Contribution requests
- Import from genealogy tools
- GEDCOM support
- AI-assisted ingestion
- Relationship labels
- Viewer selects themselves
- Story timelines
- Audio memories
- Photo restoration
- Exact dates
- Rich historical context
- Search
- Branch filters
- Family-event modes
- More sophisticated adoption / step-family modeling
- Stronger access controls
- Password-protected links
- Invitations
- Multiple editors

These should not expand MVP scope unless user testing exposes a blocking need.

---

## 27. MVP Definition in One Sentence

> A single organizer can manually build and privately share a beautiful, automatically laid-out family tree where relatives can visually understand family branches and explore rich person cards containing life-stage photos, fun facts, and immediate family connections.

---

## 28. Implementation Commit Plan

Commits 01–12 are the implemented MVP baseline. Do not repeat or rebuild them. Commits 13–15 are the remaining follow-up work identified by comparing the current web app with the four desktop interfaces in `ui-mockups/Family Tree - Mockups.dc.html`.

Implement only the remaining commits in order. Each commit should build independently and include meaningful non-UI tests where applicable. The organizer performs all UI QA manually; do not run browser or screenshot verification. Installation commands are provided for the user to run, and the user stages and commits changes.

Initialization commands are documented in [SETUP.md](SETUP.md); they and commits 01–12 already established the development and MVP foundation.

### 01 — `chore: initialize pnpm workspace and local Supabase`

- Scaffold `apps/web`, `apps/api`, and `packages/family-core` with TypeScript, workspace imports, and ordered build/typecheck scripts.
- Configure React/Vite/Tailwind, React Router, TanStack Query, Fastify, Zod, and Vitest. Install React Flow and ELK.js for the later layout work.
- Initialize the Supabase CLI configuration and migration directory; document local/hosted credentials, organizer provisioning, and the private `family-photos` bucket.
- Add environment examples and ignore secrets, dependencies, build outputs, and Supabase temporary state.
- Establish a minimal web shell and API health endpoint. Keep application data access on Fastify; use browser Supabase only for Auth and signed uploads.
- Validation: package resolution, typecheck, production build, API health, and database/storage connectivity. User manually checks the starter page.

### 02 — `feat(core): define person schemas and family graph rules`

- Define person, life-status, age-bucket, parent-child, partnership, and completeness schemas in the pure shared package.
- Implement birth/death validation, the two-parent limit, self-link rejection, ancestry DFS, and parent/child birth-year ordering.
- Derive parents, children, partners, full siblings, and half-siblings from persisted edges. Follow §10.3: two shared known parents means full siblings; exactly one shared known parent means half-siblings, without inventing unknown parents.
- Validate person edits against existing parents and children, since changing a birth year can invalidate an existing edge.
- Test unknown years, equal birth years, future deaths with an injected current year, living/death conflicts, long cycles, duplicate edges, multiple partners, and sibling derivation.

### 03 — `feat(db): add family schema and private access boundaries`

- Add SQL migrations for `trees`, `people`, `parent_child`, `partnerships`, and `photos`. Each tree has one organizer user ID; adoption stays on the person.
- Store nullable years, explicit life status, at most three text fun facts, relationship completeness flags, and photo storage paths with exactly one age bucket. Keep main-photo references within the same person/tree.
- Add indexes, foreign keys that prevent cross-tree references, unique parent edges, canonical unordered partnership pairs, and row-level constraints for applicable invariants. Define deletion behavior explicitly.
- Enable RLS and restrict grants so browser `anon`/`authenticated` callers cannot bypass Fastify for family data or mutations. Add no public Storage access policies.
- Use a small server-side PostgreSQL client for transactions; no ORM. All graph-affecting writes must acquire the same tree-row lock before reading, validating, and writing within one transaction.
- Persist no siblings, coordinates, placeholders, or layout routing artifacts. Keep share secrets out of tree payloads.
- Validation: migrations apply to a fresh local database; constraints reject malformed/cross-tree records; direct browser-role access is denied.

### 04 — `feat(api): authenticate organizer and manage trees and people`

- Verify Supabase Auth credentials server-side and check the configured organizer and tree ownership on every organizer endpoint.
- Implement tree creation/loading and person creation/editing using `routes -> service -> queries`. Return stable, specific validation errors.
- Apply shared domain checks independently on the server. Lock graph-affecting person edits and revalidate connected people before saving.
- Expose completeness flags without treating legitimate unknown data as an error.
- Validation: Fastify injection tests for successful requests, invalid payloads, missing/forged authentication, non-organizer users, cross-tree access, and invalid birth-year edits.

### 05 — `feat(api): add atomic parent and partner mutations`

- Implement adding/removing parents and partners, including single parents, multiple partners, and incomplete family information.
- Within the transaction and tree lock, load current edges, enforce shared graph rules, and commit only valid mutations. Relationship writes and person edits use the same locking discipline.
- Do not automatically infer a partnership from two parents or a parent relationship from a partnership.
- Return the updated authoritative graph and actionable conflict messages.
- Validation: concurrent requests cannot create a third parent, a cycle, or inconsistent birth-year relationships; failed mutations roll back fully.

### 06 — `feat(web): add organizer sign-in and family editing`

- Add Auth session handling, routes, Query provider, authenticated API calls, and explicit loading/error/empty states.
- Provide first-tree/first-person creation and person/relationship editing forms with shared client validation and server-error feedback.
- Support life status, optional years, adoption, fun facts, and known absence versus unknown; derive siblings instead of exposing sibling editing.
- Invalidate relevant graph/person queries after successful mutations. Preserve entered values after failed saves.
- Validation: typecheck/build and meaningful form-to-domain logic checks. User manually checks sign-in, creation, editing, and validation messages.

### 07 — `feat(tree): lay out family graphs with ELK and React Flow`

- Implement `layoutFamilyGraph(graph): PositionedFamilyGraph` independently of persistence.
- Create temporary family junctions/routing nodes as needed; arrange generation rows, group partners, and route children below the relevant parents.
- Render nodes with portrait placeholder, names, birth year, and subtle adoption/deceased/incomplete indicators. Disable manual node positioning; support pan, zoom, and fit-to-view.
- Handle disconnected people and one-known-parent families without inventing persisted relatives.
- Validation: pure layout checks for finite positions, complete person coverage, and unchanged source graphs across realistic multi-generation, multiple-partner, half-sibling, and large-sibling fixtures. User manually assesses readability and navigation.

### 08 — `feat(people): add rich cards and contextual tree navigation`

- Open a person's card while retaining tree context; make immediate family entries clickable.
- Add expandable Parents, Brothers / Sisters, Partner(s), and Kids sections, derived sibling labels, life information, adoption, and fun facts.
- Implement focus mode with nearby relationships prominent and a clear return to the broader tree.
- Preserve equal visual importance for deceased people; any focus fading depends on distance from selection, never life status.
- Validation: unit checks for focused subgraphs and relationship/completeness projections. User manually checks cards, navigation, unknown states, and respectful visual treatment.

### 09 — `feat(photos): support private portraits and age-bucket galleries`

- Authorize and issue signed upload URLs for `trees/{treeId}/people/{personId}/{photoId}.jpg` in the single private `family-photos` bucket.
- Convert accepted browser images to JPEG before upload; apply an explicit upload-size limit and validate completion before publishing photo metadata.
- Store only paths and metadata; issue short-lived viewing URLs after access checks. Support a main portrait and exactly one age bucket per photo.
- Add gallery/bucket selection and handle missing images, expired URLs, and failed uploads. Define retry/cleanup behavior for storage/database partial failures without background workers.
- Validation: unauthorized/cross-tree uploads and viewing are rejected; invalid files/buckets and missing objects do not become visible photo records. User manually checks upload and gallery flows.

### 10 — `feat(sharing): add private read-only viewer links`

- Generate an unguessable bearer token and store its hash. Resolve token access through Fastify without requiring a viewer account.
- Reuse tree/card/gallery views with read-only controls; enforce read-only access on every server endpoint, including photo operations.
- Require tree-specific token or organizer authorization for graph, person, and signed-photo reads. Support token replacement to invalidate an accidentally shared link; already-issued photo URLs expire within their short lifetime.
- Exclude private views from indexing and discovery; use no-referrer handling and redact tokens/authorization credentials from logs.
- Explain that anyone holding the link can view the tree.
- Validation: absent/invalid/replaced tokens fail, a token cannot access another tree, and viewers cannot mutate even with crafted requests. User manually checks account-free browsing.

### 11 — `test: cover MVP integrity and prepare manual acceptance fixtures`

- Consolidate integration coverage for every invariant, including the two-parent maximum, transaction races, mutation rollback, access boundaries, and private photos.
- Add synthetic fixtures covering large sibling groups, multiple partners, half-siblings, several generations, isolated people, incomplete facts, adoption, and all life statuses.
- Document a manual organizer/viewer acceptance checklist mapped to §24, including layout readability, focus, pan/zoom, cards, photo buckets, and deceased-node prominence.
- Add CI commands for frozen-lockfile installation, typecheck, domain/API/layout tests, production builds, and migration checks against a disposable local database. No automated UI verification.
- Validation: automated non-UI checks pass; the user records manual QA results and any blocking issues.

### 12 — `docs: document deployment and MVP operating procedures`

- Document hosted migration application, private bucket provisioning, the sole organizer account, Auth redirect URLs, API environment variables, HTTPS, and frontend API configuration.
- Document frontend SPA route fallback and API CORS for the chosen deployment origins; keep server credentials entirely out of Vite variables.
- Record development commands, schema/type regeneration, synthetic seed usage, share-link replacement, and photo cleanup/retry procedures.
- Validation: configuration and release checklist review, passing non-UI checks, and user completion of manual acceptance before release.

### 13 — `feat(ui): align the family tree workspace with the album mockups`

- Replace the current forest/green visual theme with the mockup's family-album system on /ui-mockups: Newsreader headings and names, Public Sans interface copy, warm paper and ink surfaces, terracotta actions and remembered-person accents, sage discovery cues, compact radii, and quieter borders and shadows.
- Make the organizer and viewer tree surfaces full-height workspaces beneath a compact header instead of placing the tree inside a long content page. Keep the tree name and context in the header and move zoom-out, zoom percentage, zoom-in, and fit controls into the visible workspace chrome.
- Restyle tree nodes to the compact portrait/name/year cards in the mockup so larger families fit at a useful initial scale. Show deceased people with the same size, contrast, and color as living people, using only the terracotta portrait ring and year range; retain the subtle adoption badge and sage incomplete-information cue.
- Render unknown and known-absent family information using the established semantics: dashed, neutral placeholders for unknown people or branches; plain copy for known absence such as `No children`; and no persisted placeholder people, routing nodes, or coordinates.
- Preserve the existing React Flow/ELK behavior, automatic layout, accessibility, focus-distance logic, pan/zoom, read-only permissions, and all API contracts. This is a presentation and workspace-composition change, not a new family-graph feature.
- Validation: typecheck, production build, and existing layout/person-card unit tests. The user manually compares the whole-tree and focused-person states with mockups 01 and 02 at desktop sizes and checks the existing responsive layouts separately.

### 14 — `feat(photos): add the dedicated life-stage photo viewer`

- Move the viewer's expanded photo experience out of the narrow person card into a dedicated, route-backed page for the selected person while keeping the card's compact photo preview as the entry point.
- Match mockup 03 with a warm brown-black gallery surface, person identity and photo-count context in the header, a large selected image, bucket-local thumbnails and position, and a persistent life-order list of all eleven age buckets. Filled buckets show counts; empty buckets remain visible as quiet `none yet` states.
- Provide explicit `Back to card` and close-to-tree navigation. Preserve the private viewer bearer-token fragment across internal route changes, browser refreshes, and back/forward navigation; an invalid or replaced token must continue to fail through the existing read-only API boundary.
- Reuse the existing signed-photo reads, expiration refresh behavior, age-bucket metadata, and missing-image states. Do not add exact dates, inferred ages, automatic ordering guesses, or new photo metadata.
- Keep organizer upload, replacement, main-portrait, bucket assignment, cleanup retry, and deletion controls out of the read-only viewer page; they remain available only in authenticated organizer editing.
- Validation: add route/navigation and gallery-state unit tests for token preservation, bucket selection, counts, empty buckets, missing images, and returning to the originating card/tree. Run typecheck, production build, and existing photo/share tests; the user manually checks mockup 03 and real image fitting.

### 15 — `feat(organizer): move person editing into a dedicated workspace`

- Replace the current stacked editor—people sidebar, share panel, tree, person form, and generic relationship panel on one long page—with explicit tree-overview and dedicated add/edit-person routes. Selecting edit or add opens a full-height workspace; save or discard returns to the tree without losing the relevant person focus.
- Compose the dedicated page from the already implemented person, relationship, completeness, and photo capabilities: identity, manual life status, optional years, adoption, up to three facts, main portrait, additional photos with required age buckets, parents, partners, and children. Siblings remain derived and non-editable.
- Present parents and partners as person-specific selections and children with an explicit known / no children / unknown control backed by the existing completeness data. Keep the two-parent limit, graph locking, and authoritative server validation unchanged; never persist an invalid intermediate relationship.
- Validate the edited person and staged relationship choices together as early as practical. Show the specific conflicting people, years, and rule in a terracotta fact-conflict banner, keep entered values intact, and disable the save action until the draft is valid; the server must still repeat every check.
- Add the mockup's read-only right rail with the resulting tree-node preview, a live summary of checked invariants, and non-blocking `Still to discover` prompts for incomplete facts, photo buckets, or relationships. Missing information remains an invitation and never becomes a validation error.
- Reuse the current API operations and storage flows unless an atomic coordinator is required to prevent partial person/relationship saves; any such coordinator must stay within the existing `route -> service -> queries` architecture and tree-locking discipline rather than introduce a new domain model.
- Validation: add route, draft-validation, return-focus, and view-model tests for create/edit, relationship conflicts, known absence, discovery prompts, and failed-save value preservation. Run typecheck, production build, and existing person/relationship/photo tests; the user manually compares the result with mockup 04 and checks add-person, discard, and narrow-screen behavior.

### Completion rule

The PRD's five numbered invariants plus the maximum-two-parents requirement in §10.2 and `AGENTS.md` must all be enforced. A working starter, passing automated checks, or a small demo tree alone does not establish MVP completion; the organizer and viewer acceptance criteria must also pass manual QA.
