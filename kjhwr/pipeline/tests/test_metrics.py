import pandas as pd
from pipeline.metrics import bias, mae, p90_absolute_error, rmse, summary


def test_metrics_are_calculated_in_mw():
    actual, forecast = pd.Series([100, 100]), pd.Series([110, 80])
    assert mae(actual, forecast) == 15
    assert round(rmse(actual, forecast), 6) == round((250) ** 0.5, 6)
    assert bias(actual, forecast) == -5
    assert p90_absolute_error(actual, forecast) == 19


def test_summary_ignores_missing_pairs():
    frame = pd.DataFrame({"actual_mw": [100, None], "forecast_mw": [110, 50]})
    assert summary(frame)["count"] == 1
