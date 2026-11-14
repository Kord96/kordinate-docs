# Isolated developer-cycle UI preview

This branch adds a locked development shell and a fixed container recipe for the
existing snapshot docs UI. The checked-in `synthetic-data/snapshot-store` is **UI
development fixture data only**. Its project names, snapshots and SHAs are not
InfraJobs, build, publication, deployment or native execution evidence.

Enter the development shell without updating the checked-in flake lock:

```sh
nix develop --no-write-lock-file
npm ci --ignore-scripts
node scripts/infra-cycle-preview.mjs
```

Open port 4321. The existing development login accepts `dev` for admin and `guest`
for guest unless configured through the existing development auth settings. This
is a development preview and uses the existing development authentication.

The supervisor always uses the checked-in fixture store and starts the existing
synthetic API on port 4010, waits for its health response, then runs Astro dev on
port 4321. The existing Astro frontmatter fetches data inside the preview process
using `http://127.0.0.1:4010`; the browser does not need access to localhost:4010.
It clears the gateway token and pins the data URL and fixture identity. Do not
supply production secrets, production gateway URLs or production stores to this
preview. No gateway API or authentication implementation is replaced.

Either child's unexpected exit stops the other child and fails the supervisor.
SIGTERM/SIGINT shut down both children, with a five-second forced shutdown limit.
Only publish/container-route port 4321; the fixture API is not a public service.

Build and run the fixed preview recipe:

```sh
docker build -t kordinate-docs-infra-cycle .
docker run --rm -p 4321:4321 kordinate-docs-infra-cycle
```

The Node 22 Bookworm slim image is pinned by digest and dependency installation uses
`npm ci --ignore-scripts` with the existing package lock. The Docker build runs `scripts/infra-cycle-check.mjs` to compile the actual site
against the local fixture and fails if compilation fails. The image runs as UID/GID
10001, owns `/app`, and starts the
real Astro UI from source; its development server renders the fixture data.
The flake lock was copied unchanged from the known locked template, and the
shell selects Node 22 and Git from that locked nixpkgs input. Use
`--no-write-lock-file` for shell and evaluation commands; updating the source
lock is an explicit maintenance action.

Run the finite static build check after installing dependencies:

```sh
node scripts/infra-cycle-check.mjs
```

It starts the existing local synthetic API, waits for readiness, runs the installed
Astro build, stops the API and returns the build status. It requires port 4010 to
be free and never installs dependencies or contacts the production gateway.

This builds the actual project against its local UI fixture. It does not turn
the fixture's snapshot metadata into evidence of any external developer cycle.
