# Helper Process Language Decision

Decision: Python

Rationale:
- Python enables rapid development, easy subprocess control for `git` and `pandoc`, and a large ecosystem for scripting and testing. It lowers friction for the single-developer MVP and simplifies packaging choices for the helper.

Recommended Libraries & Tools:
- Git interaction: prefer calling system `git` via `subprocess` to preserve SSH-agent behavior; `GitPython` or `pygit2` are options when higher-level control is needed.
- Process & async: `subprocess`, `asyncio` (optionally `uvloop`) for concurrent tasks.
- Local API (optional): `FastAPI` for a small HTTP RPC interface between Electron and helper.
- Packaging: `PyInstaller` (or `briefcase`/`pyoxidizer`) to produce a bundled macOS helper binary for `artifacts/`.
- Dependency management: `pyproject.toml` with `poetry` or `pip-tools` for reproducible installs.

Integration Pattern (recommended):
- Electron main spawns the helper process and supervises it. The helper exposes a local HTTP API (FastAPI) bound to localhost (random high port) for decoupled IPC; Electron calls that API. Use TLS loopback only if needed for extra assurance; otherwise localhost is sufficient for local-first tooling.
- Alternative: stdio JSON-RPC over child process pipes (less network overhead but more custom glue).

Security & SSH Integration:
- Invoke system `git` via `subprocess` to rely on the system SSH agent and avoid storing credentials in the helper.

Performance Considerations & Mitigations:
- Python is sufficient for orchestration and IO-heavy tasks. For CPU-heavy work, isolate into worker processes or replace hotspots with native extensions or small Go helpers.
- Use streaming IO and async workers to limit memory footprint and keep helper responsive.

Developer Experience & Testing:
- Add a CLI entrypoint (`helper/cli.py`) with commands: `snapshot`, `export`, `rebuild-dictionary`, `status`. Provide integration tests that run against temporary git repos and mock exports.

Next Steps:
- Add `helper/pyproject.toml`, a minimal `helper/cli.py`, and an example FastAPI `helper/api.py` (if you want HTTP IPC). Decide on IPC model next (HTTP vs stdio).
