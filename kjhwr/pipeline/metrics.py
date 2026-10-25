"""Forecast accuracy metrics. All functions expect numeric values in MW."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _errors(actual: pd.Series, forecast: pd.Series) -> np.ndarray:
    paired = pd.DataFrame({"actual": actual, "forecast": forecast}).dropna()
    return (paired["forecast"] - paired["actual"]).to_numpy(dtype=float)


def mae(actual: pd.Series, forecast: pd.Series) -> float | None:
    values = _errors(actual, forecast)
    return float(np.abs(values).mean()) if len(values) else None


def rmse(actual: pd.Series, forecast: pd.Series) -> float | None:
    values = _errors(actual, forecast)
    return float(np.sqrt(np.mean(values**2))) if len(values) else None


def bias(actual: pd.Series, forecast: pd.Series) -> float | None:
    values = _errors(actual, forecast)
    return float(values.mean()) if len(values) else None


def p90_absolute_error(actual: pd.Series, forecast: pd.Series) -> float | None:
    values = _errors(actual, forecast)
    return float(np.quantile(np.abs(values), 0.9)) if len(values) else None


def summary(frame: pd.DataFrame) -> dict[str, float | int | None]:
    actual, forecast = frame["actual_mw"], frame["forecast_mw"]
    return {"count": int(frame[["actual_mw", "forecast_mw"]].dropna().shape[0]), "mae_mw": mae(actual, forecast), "rmse_mw": rmse(actual, forecast), "bias_mw": bias(actual, forecast), "p90_absolute_error_mw": p90_absolute_error(actual, forecast)}


def slices(frame: pd.DataFrame) -> dict[str, dict[str, float | int | None]]:
    work = frame.copy()
    work["date"] = pd.to_datetime(work["target_time"], utc=True).dt.date.astype(str)
    return {date: summary(group) for date, group in work.groupby("date")}
