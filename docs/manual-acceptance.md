# MVP manual acceptance

This checklist is the human verification required by PRD §24. Automated checks
cover deterministic graph, API, persistence, privacy, photo, and layout
properties; they do not establish visual readability or browser usability.

## Prepare a local acceptance tree

1. Use the pre-provisioned local organizer described in `SETUP.md`. Confirm
   `apps/api/.env` contains its `ORGANIZER_USER_ID` and a local `DATABASE_URL`.
2. Start local Supabase, apply migrations, and reconcile the private photo bucket:

   ```sh
   pnpm exec supabase start
   pnpm exec supabase migration up --local
   node --env-file=apps/api/.env apps/api/scripts/setup-supabase.mjs
   ```

3. Create a new, non-destructive synthetic tree:

   ```sh
   pnpm seed:acceptance
   ```

   The command accepts local PostgreSQL only, creates a new tree on every run,
   and prints its organizer URL. It does not create, replace, or delete Auth
   users, existing trees, share links, or Storage objects.
4. Start the app with `pnpm dev`, sign in as the organizer, and open the printed
   URL. Use a current Chrome, Firefox, or Safari window at desktop width and a
   narrow mobile-width window.

The fixture contains four generations, ten full siblings, a multiple-partner
branch, a half-sibling, a one-known-parent child, an isolated person, an adopted
person, incomplete facts, and living/deceased/unknown life statuses. It contains
no photos on purpose: acceptance must exercise the real signed upload workflow.

## Creation and integrity — PRD §24 Creation and Data integrity

Record pass/fail and notes for every item.

- [ ] From the organizer home, create a separate empty tree, add the first
  person, then add and connect at least two more generations. Each save appears
  in the tree without a reload.
- [ ] In the synthetic tree, Luc is visibly connected to both Claire and Nadia;
  Anne and Theo read as half-siblings through Luc's two partner branches.
- [ ] Anne's full-sibling group contains Pierre, Marc, Celine, Rene, Louise,
  Paul, Ines, Hugo, and Emma. No sibling relationship can be entered directly.
- [ ] Mia remains valid with one known parent. Sam Rivera remains valid while
  disconnected and communicates unknown parents separately from known absence
  of partners and children.
- [ ] Marc's adoption flag is visible and editable without changing his parent
  relationships.
- [ ] Try each invalid edit below. Submission is blocked with a specific rule,
  the entered values remain available, and reloading proves nothing invalid was
  persisted:
  - [ ] death year before birth year;
  - [ ] death year later than the current year;
  - [ ] `Living` together with a death year;
  - [ ] parent whose birth year is later than the child's;
  - [ ] a parent edge that closes an ancestry cycle;
  - [ ] a third parent for one person.
- [ ] Unknown birth/death years, equal parent/child birth years, and exactly two
  parents remain valid.

## Browsing — PRD §24 Browsing

- [ ] The full synthetic tree loads with every person represented once.
- [ ] Pan, zoom, zoom controls, and fit-to-view remain usable on desktop and at
  narrow width; the ten-sibling branch and disconnected Sam can be reached.
- [ ] Select Anne. Her focus is clear while enough of the wider tree remains to
  understand her position. `Show whole tree` restores the broad view.
- [ ] Open Anne's Parents, Brothers / Sisters, Partner(s), and Kids sections.
  Each listed person opens the correct next card without losing tree context;
  Theo is marked `Half`.
- [ ] Names, year/status text, adoption, up to three fun facts, placeholders,
  unknown values, and known-empty relationship sections remain readable.
- [ ] Upload a small JPEG/PNG/WebP to Anne for every bucket: Baby / Toddler,
  Kid, Adolescent, 20s, 30s, 40s, 50s, 60s, 70s, 80s, and 90s+. Each appears
  only in its selected bucket.
- [ ] Set a gallery image as Anne's portrait, refresh, then delete it. The map,
  sidebar, and card update, and the missing portrait falls back cleanly.
- [ ] Create a private viewer link and open it in a signed-out/private window.
  The tree, cards, navigation, facts, and private photos work without an account,
  and no editing or upload controls are available.
- [ ] Replace the viewer link. The old link can no longer load the tree and the
  new link works. The UI clearly says anyone with the link can view it.

## Visual design — PRD §24 Visual design

- [ ] Generation rows read top-to-bottom, partners sit together, and child
  routing makes Luc's two partner branches, Anne's full siblings, and Theo's
  half-sibling relationship understandable without organizer explanation.
- [ ] The ten-sibling branch remains legible at a practical zoom level and no
  person is obscured by a junction, edge, card, or control.
- [ ] Missing photos and unknown year/status/relationships look incomplete but
  not erroneous: no red treatment, warning triangle, opacity reduction, or
  aggressive completion prompt appears.
- [ ] Elise, Henri, Luc, and Pierre retain the same node size, color saturation,
  opacity, portrait treatment, and typographic prominence as living relatives.
- [ ] The deceased indicator is subtle and respectful, with no skull, tombstone,
  or religiously specific symbol. Marc's adoption indicator is also secondary
  to his name and portrait.
- [ ] Focus fading follows graph distance only: nearby deceased people are not
  dimmer than equally distant living people.

## Acceptance record

Complete this section in the pull request or release record; do not mark the
manifest capabilities shipped until every required item passes.

| Field | Result |
| --- | --- |
| Date / tester | |
| Commit SHA | |
| Browser(s) and viewport(s) | |
| Creation and integrity | Pass / Fail |
| Browsing | Pass / Fail |
| Visual design | Pass / Fail |
| Blocking issue links | |
| Overall MVP §24 result | Pass / Fail |

