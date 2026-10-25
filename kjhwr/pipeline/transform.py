"""Select decision-time wind forecasts and join them to actual generation."""
from __future__ import annotations

from datetime import time
import pandas as pd

DEFAULT_CUTOFF_TIME = time(23, 30)


def _require_column(frame: pd.DataFrame, candidates: tuple[str, ...], label: str) -> str:
    for name in candidates:
        if name in frame.columns:
            return name
    raise ValueError(f"{label} needs one of: {', '.join(candidates)}; received {list(frame.columns)}")


def select_decision_time_forecast(
    forecasts: pd.DataFrame, cutoff_time: time = DEFAULT_CUTOFF_TIME
) -> pd.DataFrame:
    """Keep the latest forecast published on/before 23:30 UTC on target day D-1.

    Each target timestamp is evaluated independently. Rows without an eligible
    revision are omitted, preventing later information leaking into backtests.
    """
    work = prepare_forecasts(forecasts)
    target_day = work["target_time"].dt.normalize()
    work["cutoff_time"] = target_day - pd.Timedelta(days=1) + pd.Timedelta(
        hours=cutoff_time.hour, minutes=cutoff_time.minute, seconds=cutoff_time.second
    )
    eligible = work.loc[work["publish_time"] <= work["cutoff_time"]].dropna(subset=["forecast_mw"])
    selected = eligible.sort_values(["target_time", "publish_time"]).drop_duplicates("target_time", keep="last")
    return selected[["target_time", "publish_time", "cutoff_time", "forecast_mw"]].sort_values("target_time").reset_index(drop=True)


def prepare_forecasts(forecasts: pd.DataFrame) -> pd.DataFrame:
    """Normalize WINDFOR revisions to target_time / publish_time / forecast_mw."""
    target_col = _require_column(forecasts, ("startTime", "targetTime", "forecastTime"), "forecast")
    publish_col = _require_column(forecasts, ("publishTime", "publishedAt"), "forecast")
    value_col = _require_column(forecasts, ("generation", "forecast", "forecastMW"), "forecast")
    work = forecasts.copy()
    work["target_time"] = pd.to_datetime(work[target_col], utc=True)
    work["publish_time"] = pd.to_datetime(work[publish_col], utc=True)
    work["forecast_mw"] = pd.to_numeric(work[value_col], errors="coerce")
    return work[["target_time", "publish_time", "forecast_mw"]].dropna().drop_duplicates()


def prepare_actuals(actuals: pd.DataFrame) -> pd.DataFrame:
    """Normalize FUELHH wind rows to target_time / actual_mw."""
    work = actuals.copy()
    if "fuelType" in work and not work.empty:
        work = work.loc[work["fuelType"].astype(str).str.upper().eq("WIND")]
    target_col = _require_column(work, ("startTime", "halfHourEndTime", "timestamp"), "actuals")
    value_col = _require_column(work, ("generation", "actual", "actualMW"), "actuals")
    result = pd.DataFrame({
        "target_time": pd.to_datetime(work[target_col], utc=True),
        "actual_mw": pd.to_numeric(work[value_col], errors="coerce"),
    }).dropna()
    return result.groupby("target_time", as_index=False)["actual_mw"].sum().sort_values("target_time")


def build_observations(actuals: pd.DataFrame, forecasts: pd.DataFrame) -> pd.DataFrame:
    """Return matched forecast/actual rows and signed error (forecast - actual), in MW."""
    selected = select_decision_time_forecast(forecasts)
    joined = selected.merge(prepare_actuals(actuals), on="target_time", how="inner")
    joined["error_mw"] = joined["forecast_mw"] - joined["actual_mw"]
    return joined.sort_values("target_time").reset_index(drop=True)
