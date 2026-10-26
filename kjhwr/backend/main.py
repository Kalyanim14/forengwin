"""Read-only API serving generated wind forecast outputs."""
from __future__ import annotations

import json
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
app = FastAPI(title="Wind forecast accuracy API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173","https://forengwin.vercel.app", "https://forengwin-git-main-kalyanim14s-projects.vercel.app", "https://forengwin-2fwcakyx3-kalyanim14s-projects.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
def announce_startup():
    ready = (DATA_DIR / "summary.json").exists()
    state = "ready to serve generated outputs" if ready else "waiting for pipeline outputs"
    print(f"[API] Started; {state}.")


def read_output(name: str):
    path = DATA_DIR / name
    if not path.exists():
        raise HTTPException(404, "Pipeline outputs are missing. Run: python -m pipeline.build_outputs --download")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        print(f"[API] Read {name}.")
        return payload
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Invalid output file {name}: {exc.msg}") from exc


@app.get("/health")
def health():
    return {"status": "ok", "outputs_ready": (DATA_DIR / "summary.json").exists()}


@app.get("/summary")
def get_summary():
    return read_output("summary.json")


@app.get("/daily")
def get_daily():
    return read_output("daily.json")


@app.get("/observations")
def get_observations(date: str | None = Query(default=None, description="UTC calendar date, YYYY-MM-DD")):
    rows = read_output("observations.json")
    if date:
        rows = [row for row in rows if str(row.get("target_time", "")).startswith(date)]
    return rows


@app.get("/horizon")
def get_horizon():
    return read_output("horizon.json")
