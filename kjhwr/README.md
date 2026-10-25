# Wind energy forecast backend

This project compares Elexon BMRS `WINDFOR` wind forecasts with `FUELHH` wind actuals. Values are treated as MW. For every target half-hour on day D, the pipeline selects the newest forecast published no later than **23:30 UTC on D-1**, then joins it to the wind actual.

## Local setup

```powershell
cd kjhwr
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pipeline.build_outputs --download
pytest
uvicorn backend.main:app --reload
```

Open `http://localhost:8000/docs`. The React dev server at `http://localhost:5173` is allowed by CORS. Available endpoints are `/health`, `/summary`, `/daily`, and `/observations?date=2026-01-15`.

## Docker

```powershell
docker compose up --build
```

The container only serves existing `data/*.json`; generate them locally with the pipeline before starting Compose. This keeps API startup deterministic and prevents API requests from triggering external downloads.

## Data assumptions

- FUELHH is requested with `fuelType=WIND` and normalized to `actual_mw`.
- WINDFOR revisions are normalized from `startTime`, `publishTime`, and `generation`.
- The cutoff is intentionally explicit and configurable in `pipeline.transform.DEFAULT_CUTOFF_TIME`.
