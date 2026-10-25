from datetime import time
import pandas as pd
from pipeline.transform import build_observations, select_decision_time_forecast


def test_selects_latest_revision_at_or_before_d1_cutoff():
    forecasts = pd.DataFrame({
        "startTime": ["2026-01-02T00:00:00Z"] * 3,
        "publishTime": ["2025-12-31T12:00:00Z", "2026-01-01T22:00:00Z", "2026-01-01T23:31:00Z"],
        "generation": [100, 120, 140],
    })
    result = select_decision_time_forecast(forecasts, time(23, 30))
    assert result.loc[0, "forecast_mw"] == 120
    assert result.loc[0, "publish_time"] == pd.Timestamp("2026-01-01T22:00:00Z")


def test_join_filters_actuals_to_wind_and_calculates_error():
    actuals = pd.DataFrame({"startTime": ["2026-01-02T00:00:00Z", "2026-01-02T00:00:00Z"], "fuelType": ["WIND", "GAS"], "generation": [90, 999]})
    forecasts = pd.DataFrame({"startTime": ["2026-01-02T00:00:00Z"], "publishTime": ["2026-01-01T22:00:00Z"], "generation": [100]})
    result = build_observations(actuals, forecasts)
    assert result.loc[0, "actual_mw"] == 90
    assert result.loc[0, "error_mw"] == 10
