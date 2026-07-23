# Tech Stack

> Architecture and tooling as declared in repository configs and lockfiles.  
> Evidence: `frontend/package.json`, `backend/requirements.txt`, Dockerfiles, `docker-compose.yml`, `vite.config.ts`, `components.json`, tsconfig/eslint configs.

## High-level architecture

```text
Browser (:5173)
    │  GET /api/metrics...
    ▼
Vite dev server (frontend container)
    │  proxy /api → http://backend:8000
    ▼
FastAPI + uvicorn (:8000)
    │
    └── in-memory mock generator (seed=42)
         (no database)
```

Two Compose services (`docker-compose.yml`): `frontend` depends_on `backend`. Both mount source for live reload. Backend also exposes debugpy on `5678`.

---

## Frontend

| Layer | Choice | Evidence |
|-------|--------|----------|
| Language | TypeScript (~6.0.2) | `frontend/package.json`, `tsconfig*.json` |
| UI library | React 19.2.x + react-dom | `package.json` dependencies |
| Bundler / dev server | Vite 8 | `vite`, `@vitejs/plugin-react`, `npm run dev` |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` | `package.json`, `vite.config.ts`, `src/index.css` |
| Charts | Recharts 3.8.x | `package.json`; used in dashboard chart components |
| Icons | lucide-react | dashboard header / KPI icons |
| Class utilities | `clsx`, `tailwind-merge`, `class-variance-authority` | `lib/utils.ts`, `package.json` |
| UI primitives | shadcn-style (new-york / zinc) | `frontend/components.json`; `components/ui/card.tsx`, `skeleton.tsx` |
| Path alias | `@` → `./src` | `vite.config.ts`, `tsconfig.app.json` |
| Routing | None (single `App.tsx` screen) | no `react-router` in dependencies; `main.tsx` mounts `App` only |
| State | Local React `useState` / `useEffect` | `App.tsx` (no Redux/Zustand app dependency) |

### Frontend core dependencies (runtime)

From `frontend/package.json` `dependencies`:

- `react`, `react-dom`
- `recharts`
- `lucide-react`
- `clsx`, `tailwind-merge`, `class-variance-authority`

### Frontend tooling (dev)

- **Lint:** ESLint 9 + `typescript-eslint` + React Hooks / Refresh plugins (`eslint.config.js`)
- **Test:** Vitest 4 + `@vitest/coverage-v8` (`npm test`, `test:coverage`)
- **Build:** `tsc -b && vite build`
- **CSS pipeline extras:** `postcss`, `autoprefixer` listed as devDependencies
- **Types:** `@types/react`, `@types/react-dom`, `@types/node`

### Frontend runtime image

`frontend/Dockerfile`: `node:24-alpine`, `npm install`, `npm run dev -- --host 0.0.0.0 --port 5173`.

### API access from the browser

- Default: relative `/api/...` so Vite proxy applies (`App.tsx`: `VITE_API_BASE_URL ?? ""`)
- Proxy target: `http://backend:8000` (`vite.config.ts`) — Compose DNS name
- Optional override: `VITE_API_BASE_URL` (`frontend/.env.example`)

---

## Backend

| Layer | Choice | Evidence |
|-------|--------|----------|
| Language / runtime | Python 3.13 (slim image) | `backend/Dockerfile` `FROM python:3.13-slim` |
| Web framework | FastAPI | `requirements.txt`, `backend/app/main.py` |
| ASGI server | uvicorn `[standard]` | Dockerfile CMD, `requirements.txt` |
| Validation / schemas | Pydantic models in `routes.py` | `BaseModel`, `response_model=...` |
| Debugger | debugpy on `0.0.0.0:5678` | Dockerfile CMD |
| Persistence | None | mock generator only |
| Auth | None | CORS `allow_origins=["*"]` in `main.py` |

### Backend package layout

```text
backend/
├── app/
│   ├── main.py      # FastAPI app, CORS, include_router
│   ├── routes.py    # models + domain helpers + all routes
│   └── __init__.py
├── tests/
│   ├── conftest.py  # sys.path bootstrap
│   └── test_routes.py
├── requirements.txt
└── Dockerfile
```

### Backend core dependencies

From `backend/requirements.txt` (unpinned versions):

| Package | Role |
|---------|------|
| `fastapi` | HTTP API framework |
| `uvicorn[standard]` | ASGI server |
| `debugpy` | Remote debugging |
| `pytest` | Tests |
| `pytest-cov` | Coverage |
| `httpx` | HTTP client (typical FastAPI `TestClient` stack; listed explicitly) |

App entry: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.

---

## Infrastructure & DevOps

| Concern | Implementation | Evidence |
|---------|----------------|----------|
| Local orchestration | Docker Compose v2-style `services:` | `docker-compose.yml` |
| Frontend container | Build `./frontend`, port `5173:5173`, bind-mount + anonymous `node_modules` volume | Compose + Dockerfile |
| Backend container | Build `./backend`, ports `8000:8000`, `5678:5678`, bind-mount | Compose + Dockerfile |
| Service dependency | `frontend.depends_on: backend` (start order only; no healthcheck) | Compose |
| Hot reload | Vite HMR; uvicorn `--reload`; source volumes | Dockerfiles + Compose volumes |
| CI/CD in repo | Not present in this checkout | no `.github/workflows` found |
| Production deploy config | Not present (dev-oriented Compose/Docker only) | Dockerfiles run `dev` / reload |

### Local ports (README)

| Port | Service |
|------|---------|
| 5173 | Frontend |
| 8000 | Backend API + `/docs` |
| 5678 | debugpy |

---

## Tooling & agent configuration

| Area | Location | Notes |
|------|----------|-------|
| Agent entry guidance | `AGENTS.md` | Must read `.agents/rules`, `.agents/skills`, `memory-bank` |
| Agent rules | `.agents/rules/*.md` | `pure-domain-logic`, `api-contracts-and-errors`, `dashboard-ui-structure` |
| Agent skills | `.agents/skills` | **Not present** yet (README expects it) |
| Project docs | `summary.md`, `practices.md`, this `memory-bank/` | Handover / practices / living memory |
| Frontend ignore / env sample | `frontend/.gitignore`, `frontend/.env.example` | |

### TypeScript compiler strictness (selected)

`frontend/tsconfig.app.json` enables among others: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noFallthroughCasesInSwitch`.

---

## Key integration contracts

1. **HTTP prefix:** metrics routes live under `/api/metrics*` on the backend; the browser uses the same path through the Vite proxy.
2. **CORS:** backend allows all origins (`main.py`), so direct calls to `:8000` also work outside the proxy.
3. **Deterministic mock seed:** handlers use `generate_mock_movements(seed=42)` for reproducible API responses and tests.
4. **Shared domain vocabulary:** Python `Literal`s / Pydantic models and TypeScript unions in `financial-types.ts` must stay aligned (enforced by project rules).
