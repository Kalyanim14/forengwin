"""Download raw Elexon FUELHH actuals and WINDFOR forecast revisions."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import requests
import pandas as pd

API_BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"


def fetch_dataset(dataset: str, start: str, end: str, *, fuel_type: str | None = None) -> list[dict[str, Any]]:
    """Fetch a dataset and return its data rows, accepting BMRS wrapper or list JSON."""
    print(f"[Pipeline] Downloading {dataset} data...")
    # These datasets use different API window parameters. Supplying generic
    # `from` / `to` makes Elexon fall back to its current-data default.
    if dataset == "FUELHH":
        params: dict[str, str] = {
            "settlementDateFrom": start[:10],
            "settlementDateTo": end[:10],
            "format": "json",
        }
    elif dataset == "WINDFOR":
        params = {"publishDateTimeFrom": start, "publishDateTimeTo": end, "format": "json"}
    else:
        params = {"from": start, "to": end, "format": "json"}
    if fuel_type:
        params["fuelType"] = fuel_type
    response = requests.get(f"{API_BASE}/{dataset}", params=params, timeout=60)
    response.raise_for_status()
    payload = response.json()
    rows = payload.get("data", payload) if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError(f"Unexpected {dataset} response shape: {type(rows).__name__}")
    print(f"[Pipeline] Downloaded {dataset} data ({len(rows):,} records).")
    return rows


def write_raw(rows: list[dict[str, Any]], filename: str, raw_dir: Path = RAW_DIR) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / filename
    path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"[Pipeline] Saved raw data: {path.name}")
    return path


def ingest_month(year: int = 2026, month: int = 1, raw_dir: Path = RAW_DIR) -> tuple[Path, Path]:
    """Download one month in API-safe seven-day batches."""
    print(f"[Pipeline] Starting raw-data ingestion for {year}-{month:02d}.")
    start = pd.Timestamp(year=year, month=month, day=1, tz="UTC")
    month_end = start + pd.DateOffset(months=1)
    actuals: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    window_start = start
    batch = 1
    while window_start < month_end:
        window_end = min(window_start + pd.Timedelta(days=7), month_end)
        # FUELHH uses inclusive dates; WINDFOR uses a datetime publication window.
        fuel_end = window_end - pd.Timedelta(days=1)
        forecast_end = window_end - pd.Timedelta(seconds=1)
        print(f"[Pipeline] Downloading batch {batch}: {window_start.date()} to {fuel_end.date()}.")
        actuals.extend(fetch_dataset("FUELHH", window_start.isoformat(), fuel_end.isoformat(), fuel_type="WIND"))
        forecasts.extend(fetch_dataset("WINDFOR", window_start.isoformat(), forecast_end.isoformat()))
        window_start, batch = window_end, batch + 1
    label = start.strftime("%Y-%m")
    paths = (
        write_raw(actuals, f"fuelhh_wind_{label}.json", raw_dir),
        write_raw(forecasts, f"windfor_{label}.json", raw_dir),
    )
    print("[Pipeline] Raw-data ingestion complete.")
    return paths


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download monthly raw wind data from Elexon BMRS.")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--month", type=int, default=1)
    args = parser.parse_args()
    paths = ingest_month(args.year, args.month)
    print("\n".join(str(path) for path in paths))
