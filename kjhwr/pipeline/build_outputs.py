"""Build API-ready JSON output from downloaded January 2026 raw data."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import pandas as pd

from pipeline.ingest import RAW_DIR, ingest_month
from pipeline.metrics import mae, slices, summary
from pipeline.transform import build_observations, prepare_actuals, prepare_forecasts

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


def _read(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Raw input not found: {path}. Run ingest.py first (or use --download).")
    print(f"[Pipeline] Reading raw file: {path.name}")
    frame = pd.read_json(path)
    print(f"[Pipeline] Read {len(frame):,} records from {path.name}.")
    return frame


def build(year: int = 2026, month: int = 1, *, download: bool = False) -> dict[str, object]:
    print(f"[Pipeline] Starting output build for {year}-{month:02d}.")
    label = f"{year}-{month:02d}"
    actual_path, forecast_path = RAW_DIR / f"fuelhh_wind_{label}.json", RAW_DIR / f"windfor_{label}.json"
    if download:
        actual_path, forecast_path = ingest_month(year, month)
    actuals, forecasts = _read(actual_path), _read(forecast_path)
    print("[Pipeline] Selecting the latest forecast available by the D-1 cutoff.")
    observations = build_observations(actuals, forecasts)
    print(f"[Pipeline] Joined selected forecasts to actuals ({len(observations):,} matched periods).")
    serializable = observations.copy()
    for column in ("target_time", "publish_time", "cutoff_time"):
        serializable[column] = serializable[column].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    print("[Pipeline] Calculating forecast-error metrics.")
    overview = {"period": label, "units": "MW", "cutoff": "D-1 23:30 UTC", "metrics": summary(observations)}
    all_revisions = prepare_forecasts(forecasts).merge(prepare_actuals(actuals), on="target_time", how="inner")
    all_revisions["error_mw"] = all_revisions["forecast_mw"] - all_revisions["actual_mw"]
    all_revisions["horizon_hours"] = (all_revisions["target_time"] - all_revisions["publish_time"]).dt.total_seconds() / 3600
    valid_revisions = all_revisions.loc[all_revisions["horizon_hours"].between(0, 72)].copy()
    valid_revisions["horizon_start_hours"] = valid_revisions["horizon_hours"].floordiv(6).mul(6).astype(int)
    horizon_series = []
    for start_hour, group in valid_revisions.groupby("horizon_start_hours"):
        horizon_series.append({"horizon_start_hours": int(start_hour), "horizon_end_hours": int(start_hour + 6), "count": int(len(group)), "mae_mw": float(group["error_mw"].abs().mean())})
    fresher = valid_revisions.loc[valid_revisions["horizon_hours"] <= 12]
    horizon = {"decision_time_mae_mw": overview["metrics"]["mae_mw"], "fresher_forecast_mae_mw": mae(fresher["actual_mw"], fresher["forecast_mw"]), "series": horizon_series}
    DATA_DIR.mkdir(exist_ok=True)
    (DATA_DIR / "summary.json").write_text(json.dumps(overview, indent=2), encoding="utf-8")
    (DATA_DIR / "daily.json").write_text(json.dumps(slices(observations), indent=2), encoding="utf-8")
    (DATA_DIR / "observations.json").write_text(serializable.to_json(orient="records"), encoding="utf-8")
    (DATA_DIR / "horizon.json").write_text(json.dumps(horizon, indent=2), encoding="utf-8")
    print("[Pipeline] Wrote summary.json, daily.json, observations.json, and horizon.json.")
    print("[Pipeline] Output build complete.")
    return overview


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create JSON API outputs from raw wind data.")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--month", type=int, default=1)
    parser.add_argument("--download", action="store_true", help="download raw inputs before building")
    args = parser.parse_args()
    print(json.dumps(build(args.year, args.month, download=args.download), indent=2))
