# Gridwise – Wind Intelligence

A decision dashboard for a UK energy utility's day-ahead power buying team. It shows the latest national wind generation forecast for a chosen day and measures how accurate those forecasts have historically been, so buyers can judge how much to trust them when committing to purchases.

**Live app:** https://forengwin.vercel.app

Scope: national UK wind generation, January 2026, using Elexon BMRS data only.

---

## What it does

| View | Purpose |
|---|---|
| **Decision view** | Forecast for a selected day as it would have looked at decision time, energy estimates, forecast vs. actual charts, and data export |
| **Forecast accuracy** | MAE, RMSE, bias and error distribution across the month |
| **Horizon analysis** | How forecast error changes with lead time (how far ahead the forecast was issued) |

### Method

- **Actuals:** Elexon `FUELHH`, filtered to `fuelType = WIND`.
- **Forecasts:** Elexon `WINDFOR`, which contains multiple revisions per half-hour (each with a `publishTime`).
- **Decision-time rule:** for every half-hour on day **D**, the app uses the newest forecast published no later than **23:30 UTC on D−1**, i.e. what a day-ahead buyer would actually have had in hand. That forecast is then compared with the actual generation.
- **Metrics:** MAE, RMSE, bias and P90 absolute error.

Bundled January 2026 results: **720 matched half-hour periods**, decision-time **MAE ≈ 1,836 MW**.

---

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide icons
- **Backend:** Python, FastAPI (serves pre-generated JSON outputs)
- **Data pipeline:** Python scripts that download, transform and score Elexon data
- **Containers:** Docker / Docker Compose for the backend
- **Deployment:** Vercel (frontend)

---

## Repository structure

```text
.
├── src/                      React application
│   ├── App.jsx               Dashboard, charts and UI logic
│   ├── main.jsx              Entry point
│   ├── index.css             Global styles and Tailwind theme
│   ├── lib/utils.js          Shared helpers
│   └── assets/               Static visual assets
├── public/                   Favicon and SVG icons
├── kjhwr/                    Python backend and data pipeline
│   ├── backend/
│   │   └── main.py           FastAPI app and endpoints
│   ├── pipeline/
│   │   ├── ingest.py         Downloads FUELHH and WINDFOR from Elexon
│   │   ├── transform.py      Normalises, selects and joins forecasts and actuals
│   │   ├── metrics.py        MAE, RMSE, bias, P90 calculations
│   │   ├── build_outputs.py  Produces the JSON files the API serves
│   │   └── tests/            Unit tests for transforms and metrics
│   ├── data/                 Generated JSON outputs (summary, daily, observations, horizon)
│   ├── notebooks/explore.ipynb   Exploratory analysis
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml    Runs the API on port 8000
│   └── README.md             Backend and pipeline details
├── package.json              Frontend dependencies and scripts
├── vite.config.js            Vite config, `/api` proxy to port 8000
├── tailwind.config.js
├── .env.example              API base URL example
└── index.html
```

---

## How to run locally

Prerequisites: Node.js, Python 3.10+, and optionally Docker.

You need two terminals: one for the backend, one for the frontend.

### 1. Backend

```bash
cd kjhwr
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn backend.main:app --reload
```

The API runs at http://localhost:8000 and interactive docs are at http://localhost:8000/docs.

The January 2026 results are already checked in as JSON, so the API works immediately without downloading anything.

**Using Docker instead:**

```bash
cd kjhwr
docker compose up --build
```

**Rebuild the data from Elexon and run tests (optional):**

```bash
cd kjhwr
python -m pipeline.build_outputs --download
pytest
```

### 2. Frontend

From the repository root:

```bash
npm install
npm run dev
```

Open http://localhost:5173.

By default `.env.example` sets `VITE_API_BASE_URL=/api`, and Vite proxies those requests to the backend on port 8000. On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd run dev`.

### Production build

```bash
npm run build
```

---

## Deployment

- **Frontend:** deployed on Vercel at https://forengwin.vercel.app/ .
- **Backend:** https://forengwin.onrender.com
  the FastAPI service is containerised (`kjhwr/Dockerfile`). For a deployed frontend to reach it, set `VITE_API_BASE_URL` to the backend's base URL at build time. If it is not set, the frontend calls `/api`.

---

## Notes and limitations

- Scope is national wind only, for January 2026.
- `npm run lint` currently reports three issues in `src/App.jsx` (an unused prop and two React hook warnings). The production build succeeds.
- The build prints CSS minifier warnings about newer Tailwind at-rules; they do not affect the output.

---

## Use of AI tools

AI assistance was used during this project: **Claude and chatgpt- for planning and decision making, Codex - For helping in coding, error handling and suggestions**. All code was reviewed and tested by the author.

---

## Data source

[Elexon BMRS](https://bmrs.elexon.co.uk/) – `FUELHH` (half-hourly generation by fuel type) and `WINDFOR` (wind generation forecasts).
