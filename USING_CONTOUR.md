# Contour

A repository companion CLI and localhost viewer for capabilities, contracts,
source, search, and Git. Keep your editor and agent sessions; review project
knowledge in the browser and copy task prompts into your existing agent.
Rendering and mechanical checks require no agent credentials or AI calls.

The package is published on npm as `@trompetteman/contour` and installs the
`contour` command. See [package distribution](docs/package.md) to build the
artifact from a checkout instead.

## Adopt in a repository

Use Node.js `>=22.15.1 <23`. Git enables history and freshness; directories
outside Git also work. The owner installs dependencies. Run from the repository
root:

```sh
npm i -D @trompetteman/contour
# or
pnpm add -D @trompetteman/contour
```

Then initialize from the same root:

```sh
./node_modules/.bin/contour init
```

Commit package metadata and the lockfile so CI installs the same version.
Use the installed binary directly or through package scripts; validation must
report a missing installation instead of downloading a similarly named package.

`init` creates missing `.contour/manifest/` slices and the contracts directory,
and creates or refreshes owned rule blocks in `AGENTS.md` and `CLAUDE.md`.
It preserves authored YAML and surrounding instructions. Initialization performs
no semantic analysis and does not describe existing code, install hooks, edit
package scripts, or configure CI. Re-running it repairs missing paths and
refreshes owned guidance.

### Build the first feature, or bootstrap existing code

For a new project, ask your usual agent to build the first feature and maintain
the affected manifests using the installed standing rule. Empty scaffolds pass
mechanical checks but describe no features.

For an existing codebase, obtain the bootstrap prompt after initialization:

```sh
./node_modules/.bin/contour prompt bootstrap
```

Review the output and give it to your existing agent. The agent reads the code
and authors the manifests; printing the prompt does neither. Existing Contour
manifests need no re-bootstrap or schema migration. Preserve their IDs and
contracts and run `init` to refresh the owned instructions.

### Require validation

There are two complementary layers:

1. The standing rule tells agents to update affected manifests, run validation
   after the final edit, fix failures, rerun checks, and report results or blockers.
2. Repository scripts and required CI enforce a passing mechanical result before
   merge. Merge the manifest check into your existing validation, preserving tests
   and other checks. If no aggregate exists, start with this example:

```json
{
  "scripts": {
    "check:manifest": "contour check",
    "validate": "npm run check:manifest",
    "view:repo": "contour serve"
  }
}
```

```sh
npm run validate
npm run view:repo
```

Follow the [adoption guide](docs/adoption.md) to compose existing scripts and add
the [independent CI job](docs/examples/manifest-check.yml). It checks source-only
changes too, installs locked dependencies, and fetches full Git history. The owner
must configure branch protection or a ruleset to require `manifest-check`;
creating a workflow alone does not enforce merging requirements.

### Browse and maintain

Open the URL printed by `serve`, normally `http://127.0.0.1:4310`. Stop with Ctrl+C.
The viewer follows edits to the selected repository. Browse capabilities and
contracts, follow references into source, and inspect search and Git views.
**Add capability**, **State a rule**, and **Re-verify** display full prompts for
review and copying. If clipboard access fails, select and copy the text manually.
Give prompts to your normal agent; drafting does not write YAML or launch it.

Agents maintain the recorded knowledge and report mechanical validation. The
human builder reviews the running product, capability map, and contract cards to
decide whether behavior and stated contracts match their intent. A passing check
does not establish feature correctness or semantic completeness.

Both `serve` and `check` read the repository without writing it. They calculate
current findings in memory, replacing previous generated findings in the view.
To explicitly persist findings into only the verifier-owned section of
`attention.yaml`, run:

```sh
./node_modules/.bin/contour check --write
```

This records findings without repairing entries or clearing failures. Keep CI
read-only. See the [manifest format and ownership policy](docs/manifest-format.md)
and [CLI exit codes and versioned JSON contract](docs/cli.md).

## Troubleshooting and upgrades

| Symptom | Action |
| --- | --- |
| CLI missing | Install the dependency yourself; do not let validation fetch a missing binary. |
| Wrong repository | Pass `--repo /path/to/project`. Otherwise discovery selects the current Git worktree root, or the current directory outside Git. |
| Empty viewer after init | Author the first feature's entries or give the bootstrap prompt to your agent. Initialization only creates a skeleton. |
| Malformed YAML or broken reference | Use the reported file/field and source position to repair the entry, then rerun validation. Intact viewer slices remain usable. |
| Partial init or invalid ownership markers | Review reported paths and restore one complete owned block, preserving surrounding text, then rerun `init`. Escaping symlinks and inaccessible paths must be corrected by the owner. |
| Unknown, unreachable, or stale verification stamp | Verify the actual entry against code; use a genuine commit stamp. Fetch missing history before comparing with CI's checked revision. Never invent stamps to pass. |
| Git/freshness unavailable | Install Git yourself and use a repository with a readable HEAD for history and commit distance. Without them, freshness is unavailable; path and schema checks still run. |
| Port busy | Default serving tries 4310–4319. An explicit busy port fails; choose another with `serve --port 4311`, or use `--port 0`. Open the exact printed URL. |
| Missing viewer assets | Reinstall the published version, or from a tool checkout run `npm run build` and repack/reinstall the complete artifact. Production serving does not start Vite. |
| Server interrupted | Restart `serve`; reopen the printed URL if its port changes. Reconnecting clients refresh repository data. |
| Old commit hook fails | Existing clone-local hooks remain installed. Inspect and explicitly update or remove the owned hook with care for chained hooks; `init` does not change it. |

To upgrade, review release changes and install the new version with
`npm i -D @trompetteman/contour@<version>` (or the `pnpm add -D` equivalent).
Commit updated package metadata and the lockfile; rerun the local `init`,
validation, and manual viewer review. The legacy/v1 manifests need no migration
for the companion refactor. New hook installation is deferred; existing hooks
may still depend on the earlier desktop setup and are not proof of manifest quality.

## Contribute and explore

See [CONTRIBUTING.md](CONTRIBUTING.md) for checkout setup, backend/build checks,
panel experiments, and owner manual QA. [Current product requirements](docs/0-prd-base.md)
explain how the companion supersedes the historical desktop experiment.

- [Adoption and required CI](docs/adoption.md)
- [Package build, installation, and release checks](docs/package.md)
- [CLI reference](docs/cli.md)
- [Manifest format and evolution](docs/manifest-format.md)
- [HTTP API](docs/server-api.md) and [viewer client](docs/viewer-client.md)

One repository is served per process, on loopback only. Search is a bounded plain
text walk; source is read-only. Editor extensions, direct agent execution, remote
hosting, multiple repositories, and the proposed dossier are follow-up work.
Licensed under [MIT](LICENSE). Published on npm as
[`@trompetteman/contour`](https://www.npmjs.com/package/@trompetteman/contour).

# Required repository validation

These instructions and the examples are for repositories adopting the companion.
They ship under `node_modules/@trompetteman/contour/docs/`. The tool's own
build/test CI is separate. `init` reports these steps; it does not edit package
scripts, workflows, hooks, or remote merge settings.

## Install and initialize

Use Node.js `>=22.15.1 <23`. The package is published as `@trompetteman/contour`
and exposes the binary `contour`; do not install an unrelated registry package
with that command name. See [package distribution](package.md) for installing a
locally built tarball instead. The repository owner runs from the adopting
repository root:

```sh
npm i -D @trompetteman/contour
# or
pnpm add -D @trompetteman/contour
```

Then initialize from the same root:

```sh
./node_modules/.bin/contour init
```

Commit package metadata and the lockfile so CI installs the same version. The
owner performs installation; validation never downloads a missing CLI. No agent
credentials or AI calls are needed to check manifests.

`init` installs the standing rule in owned blocks in `AGENTS.md` and `CLAUDE.md`:
agents update affected manifests, run required validation after their final edit,
fix failures, rerun affected checks, and report results or blockers. Author the
entries during development, or give `contour prompt bootstrap` output to your
existing agent. Empty scaffolds pass mechanical validation but describe no features.

## Compose the repository scripts

Merge the [script example](examples/package-scripts.json) into the existing
`package.json`; do not replace the file or discard existing validation steps.
Its lint/typecheck/test commands are illustrative: retain the actual commands,
arguments, order, and tests your repository already uses. If an aggregate exists,
append `&& npm run check:manifest` to it. If none exists, start with:

```json
{
  "scripts": {
    "check:manifest": "contour check",
    "validate": "npm run check:manifest"
  }
}
```

Add other checks as the project adopts them. If `check:manifest` already exists,
review and compose it without losing its existing checks. Run from the root:

```sh
npm run validate
```

Npm scripts resolve the installed local binary without using `npx` or fetching a
missing tool. Keep the dependency pinned in the lockfile. For other package
managers, use their local script runner and frozen/immutable lockfile install;
for non-Node projects, explicitly arrange a local tool installation and integrate
its check into the existing validation command. An unavailable binary is a setup
blocker, never a successful check.

The CLI returns `0` for success, `1` for findings (including malformed YAML or
broken references), and `2` for invocation/operational failures. The example
propagates failure through both npm scripts. Checks read repository files and
compute findings in memory. CI must not use `--write`, repair manifests, commit
generated changes, or suppress failures. See the [CLI contract](cli.md).

## Add the independent CI job

Copy or merge [manifest-check.yml](examples/manifest-check.yml) into
`.github/workflows/manifest-check.yml`, preserving existing workflows and jobs.
It installs locked dependencies including development dependencies and runs
`npm run check:manifest` independently of lint/typecheck/test jobs. Keep both the
job ID and displayed name `manifest-check` stable and unique across workflows.

The template runs on every push and pull request, plus merge queues and manual
dispatch, without path filters or conditional skips. Source-only changes must
run the check because references and freshness can change without YAML edits.
Either exit `1` or `2` fails the job; there is no failure suppression or auto-repair.

The checkout explicitly selects the event's `github.sha` and fetches full history.
For pull requests this is the synthetic merge commit, for pushes the pushed
commit, and for merge queues the merge-group commit. Freshness compares stamps
against that checked-out HEAD, which the job prints. For a local/CI comparison,
fetch the same event commit and its history into a separate worktree and run the
same validation with the same lockfile and a clean working tree. Checking only
the PR branch tip or including uncommitted local edits can give different results.
Full history resolves ancestor verification stamps; genuinely unknown or
unreachable stamps remain findings. Do not invent stamps to satisfy CI.
See the official [checkout documentation](https://github.com/actions/checkout)
for history and revision behavior and [setup-node documentation](https://github.com/actions/setup-node)
for Node setup and locked npm installation.

## Require the status before merging (owner action)

After the workflow has run, the repository owner edits branch protection or a
ruleset for each protected target branch and adds `manifest-check` as a required
status check (select GitHub Actions as the source where available). Retain other
required checks. Review bypass permissions to match the repository's merge policy.
A workflow file alone does not require a passing check before merging; `init`
does not configure this remote setting.

In a disposable adopting-repository PR, the owner verifies:

1. Valid authored manifests produce a passing `manifest-check` status.
2. A broken reference or malformed YAML fails the status and prevents merging
   under the configured rule.
3. A source-only change runs the job; restoring valid content passes again and
   satisfies this requirement, subject to other merge requirements.

These remote enforcement checks remain owner acceptance work. Mechanical checks
do not establish feature correctness or semantic completeness. The human builder
reviews behavior through the running product and the companion views.

# Package distribution

The package name is `@trompetteman/contour`, version `0.1.0`, published publicly
on npm through `publishConfig` (`access: "public"`). It installs the binary as
`contour`. Adopting repositories install it from the registry as described in the
[adoption guide](adoption.md); the local tarball route below remains for
development and pre-release checks.

## Supported runtime

Build and runtime support is currently Node.js `>=22.15.1 <23`, the Node 22 line
tested for this distribution. TypeScript emits ES2022 CommonJS, Vite builds static
browser assets, and the server uses Node's filesystem, HTTP, and watcher APIs.
Other Node major versions are not yet qualified. Git is optional but required for
history and commit freshness. Serving requires no Vite process, agent credentials,
native terminal modules, or runtime downloads.

## Build and inspect

The owner refreshes the checkout's dependencies and stale lockfile first:

```sh
cd /path/to/contour
npm install --ignore-scripts
npm pack
```

`prepack` runs a clean CLI and web build, including prompt generation. For the
scoped name the tarball is `trompetteman-contour-0.1.0.tgz`. The allowlist
includes compiled CLI/core/server/shared modules, compiled prompt strings,
version metadata, web assets, and runtime docs. Source TypeScript, tests, build
tools, and historical product documents are excluded.
The compiled executable retains its Node shebang; npm creates the local binary
link (or Windows command shim) when installing it. Assets are resolved relative
to the installed server module, never the consuming repository.

There are no install, postinstall, or prepare hooks. Installing a tarball does not
build the application, scaffold manifests, or edit agent instructions. Only explicit
`contour init` creates or refreshes those repository files.

## Owner's clean installation check

Run these exact commands to install into a disposable directory (macOS/Linux):

```sh
package_check_dir="$(mktemp -d /tmp/contour-install.XXXXXX)"
cd "$package_check_dir"
npm init -y
npm install --save-dev --save-exact /path/to/contour/trompetteman-contour-0.1.0.tgz
./node_modules/.bin/contour --version
./node_modules/.bin/contour init
./node_modules/.bin/contour prompt bootstrap
./node_modules/.bin/contour check --json
./node_modules/.bin/contour serve --port 0
```

Open the printed URL for manual QA, then stop with Ctrl+C. The installed tool uses
its bundled viewer/prompts and production dependencies; checkout sources and the
tool's development dependencies are unnecessary. Initial installation can fetch
declared dependencies; subsequent CLI execution requires no external downloads.

Substitute `npm i -D @trompetteman/contour` to check the published artifact
instead of a local build. For a real repository, install from its root the same
way and add local scripts to its existing `package.json`, preserving its other
validation commands:

```json
{
  "scripts": {
    "check:manifest": "contour check",
    "view:repo": "contour serve"
  }
}
```

`npm run check:manifest` uses `node_modules/.bin` and preserves the CLI exit code;
it does not download a missing binary. Commit package metadata and the lockfile so
CI resolves the same version from the registry. To pin a locally built artifact
instead, put the tarball at a stable repository-relative location (for example
`vendor/trompetteman-contour-0.1.0.tgz`), install from that path, and commit it so
CI can access it. CI runs `npm ci --include=dev`, then
`npm run check:manifest`, with sufficient Git history for verification stamps.
Do not omit development dependencies in this validation job. Follow the [adoption guide](adoption.md) for script composition, the supplied
[workflow template](examples/manifest-check.yml), and required-status setup.

## Automated package checks

`npm run test:package` builds, inspects the actual tarball, and extracts it into a
temporary directory outside the checkout. It copies the already available YAML
runtime dependency there without invoking a package installer, then exercises the
executable, prompts, init/check exit codes, and HTTP asset delivery with loopback
networking only. It also runs the shipped npm script example against the extracted
binary, checking exit codes 0/1/2, preservation of existing test failures, and
unchanged repository contents and modification times (including Git metadata). This is a non-UI smoke test; the clean npm installation and browser
QA above remain owner checks.

## Release ownership

See [contribution and release guidance](../CONTRIBUTING.md) for the tool CI matrix
and owner QA. The [MIT license](../LICENSE) ships with the package and matches
its `license: "MIT"` metadata. The package is published on npm as
[`@trompetteman/contour`](https://www.npmjs.com/package/@trompetteman/contour);
publishing each new version remains an explicit owner action after release checks.
