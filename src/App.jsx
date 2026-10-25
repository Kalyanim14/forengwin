import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  Gauge,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Wind
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || '/api'
const tabs = [
  ['Decision view', LayoutDashboard],
  ['Forecast accuracy', Activity],
  ['Horizon analysis', TrendingUp]
]
const mw = (v) => (v == null ? '-' : `${Math.round(v).toLocaleString()} MW`)
const mwh = (v) => (v == null ? '-' : `${Math.round(v).toLocaleString()} MWh`)
const fmtDay = (d) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${d}T00:00:00Z`))

const average = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

const group = (rows, key) =>
  Object.values(
    rows.reduce(
      (out, row) => ({
        ...out,
        [key(row)]: [...(out[key(row)] || []), row]
      }),
      {}
    )
  )

function Card({ title, value, detail, icon }) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <span className="grid size-9 place-items-center rounded-md bg-muted">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  )
}

function Panel({ title, subtitle, children, action }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function Caption({ children }) {
  return (
    <p className="mx-5 mb-5 rounded-md bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
      <b className="text-foreground">How to read this: </b>
      {children}
    </p>
  )
}

function MiniLine({ series, lines, height = 230 }) {
  const flat = lines
    .flatMap((line) => series.map(line.value))
    .filter(Number.isFinite)
  const max = Math.max(...flat, 1),
    min = Math.min(...flat, 0),
    span = Math.max(max - min, 1)

  const point = (value, index) =>
    `${(index / Math.max(series.length - 1, 1)) * 100},${100 - ((value - min) / span) * 90 - 5}`

  return (
    <div className="px-5 pb-3 pt-5">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-56 w-full overflow-visible rounded bg-muted/25"
      >
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {lines.map((line) => (
          <polyline
            key={line.label}
            fill="none"
            stroke={line.color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            points={series.map((row, i) => point(line.value(row), i)).join(' ')}
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]?.label}</span>
        <span>{series[Math.floor(series.length / 2)]?.label}</span>
        <span>{series.at(-1)?.label}</span>
      </div>
    </div>
  )
}

function Bars({ items, value, label, color = 'bg-primary' }) {
  const max = Math.max(...items.map(value), 1)
  return (
    <div className="flex h-52 items-end gap-1 px-5 pb-6 pt-5">
      {items.map((item, i) => (
        <div
          className="group flex h-full flex-1 flex-col justify-end"
          key={`${label(item)}-${i}`}
          title={`${label(item)}: ${mw(value(item))}`}
        >
          <div
            className={`${color} min-h-1 rounded-t opacity-85`}
            style={{ height: `${(value(item) / max) * 100}%` }}
          />
          <span className="mt-2 truncate text-center text-[9px] text-muted-foreground">
            {label(item)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ObservationTable({ rows, showActual }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="bg-muted/60 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            <th className="px-5 py-3.5">Delivery</th>
            <th className="px-5 py-3.5">Forecast</th>
            {showActual && (
              <>
                <th className="px-5 py-3.5">Actual</th>
                <th className="px-5 py-3.5">Error</th>
              </>
            )}
            <th className="px-5 py-3.5">Published</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row) => (
            <tr
              className="transition-colors hover:bg-primary/[0.035]"
              key={row.target_time}
            >
              <td className="px-5 py-3.5 font-semibold">
                {new Date(row.target_time).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC'
                })}
              </td>
              <td className="px-5 py-3.5">{mw(row.forecast_mw)}</td>
              {showActual && (
                <>
                  <td className="px-5 py-3.5">{mw(row.actual_mw)}</td>
                  <td
                    className={`px-5 py-3.5 font-medium ${
                      row.error_mw > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {mw(row.error_mw)}
                  </td>
                </>
              )}
              <td className="px-5 py-3.5 text-muted-foreground">
                {new Date(row.publish_time).toLocaleString('en-GB', {
                  timeZone: 'UTC'
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-5 text-sm text-muted-foreground">
          No matched forecast and actual records are available.
        </p>
      )}
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState('Decision view'),
    [summary, setSummary] = useState(null),
    [observations, setObservations] = useState([]),
    [horizon, setHorizon] = useState(null)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [day, setDay] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [showActual, setShowActual] = useState(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const responses = await Promise.all([
        fetch(`${API}/summary`),
        fetch(`${API}/observations`),
        fetch(`${API}/horizon`)
      ])
      if (responses.some((response) => !response.ok)) {
        throw new Error('Forecast outputs are not available yet.')
      }
      const [nextSummary, nextRows, nextHorizon] = await Promise.all(
        responses.map((response) => response.json())
      )
      setSummary(nextSummary)
      setObservations(nextRows)
      setHorizon(nextHorizon)
    } catch (reason) {
      setError(`${reason.message} Run the pipeline, then refresh this page.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const dates = useMemo(
    () => [...new Set(observations.map((row) => row.target_time.slice(0, 10)))],
    [observations]
  )

  useEffect(() => {
    if (dates.length && !day) {
      setDay(dates[0])
      setFrom(dates[0])
      setTo(dates.at(-1))
    }
  }, [dates, day])

  const dayRows = observations.filter((row) => row.target_time.startsWith(day)),
    rangeRows = observations.filter(
      (row) =>
        row.target_time.slice(0, 10) >= from &&
        row.target_time.slice(0, 10) <= to
    )

  const metrics = summary?.metrics,
    typicalError = metrics?.p90_absolute_error_mw || 0

  const rangeP90 = useMemo(() => {
    const values = rangeRows
      .map((row) => Math.abs(row.error_mw))
      .sort((a, b) => a - b)
    return values.length ? values[Math.ceil(values.length * 0.9) - 1] : null
  }, [rangeRows])

  const publishTimes = dayRows.map((row) => row.publish_time)
  const primaryPublish = publishTimes.sort().at(-1)

  const totalEnergy = dayRows.reduce(
      (total, row) => total + row.forecast_mw * 0.5,
      0
    ),
    cautiousEnergy = dayRows.reduce(
      (total, row) =>
        total + Math.max(0, row.forecast_mw - typicalError) * 0.5,
      0
    )

  const daySeries = dayRows.map((row) => ({
    ...row,
    label: new Date(row.target_time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }),
    upper: row.forecast_mw + typicalError,
    lower: Math.max(0, row.forecast_mw - typicalError)
  }))

  const histogram = useMemo(() => {
    const errors = rangeRows.map((row) => row.error_mw)
    const min = Math.min(...errors, 0),
      max = Math.max(...errors, 1),
      width = Math.max((max - min) / 8, 1)
    return Array.from({ length: 8 }, (_, i) => {
      const low = min + i * width,
        high = low + width
      return {
        label: `${Math.round(low / 100) / 10}k`,
        count: errors.filter(
          (v) => v >= low && (i === 7 ? v <= high : v < high)
        ).length
      }
    })
  }, [rangeRows])

  const byHour = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => {
        const rows = rangeRows.filter(
          (row) => new Date(row.target_time).getUTCHours() === hour
        )
        return {
          label: String(hour).padStart(2, '0'),
          value: average(rows.map((row) => Math.abs(row.error_mw))) || 0
        }
      }),
    [rangeRows]
  )

  const byDay = useMemo(
    () =>
      group(rangeRows, (row) => row.target_time.slice(0, 10)).map((rows) => ({
        label: rows[0].target_time.slice(0, 10).slice(8),
        value: average(rows.map((row) => Math.abs(row.error_mw))) || 0
      })),
    [rangeRows]
  )

  const windLevels = useMemo(() => {
    const sorted = [...rangeRows.map((row) => row.actual_mw)].sort(
      (a, b) => a - b
    )
    const low = sorted[Math.floor(sorted.length / 3)] || 0,
      high = sorted[Math.floor((sorted.length * 2) / 3)] || 0
    return [
      ['Low', rangeRows.filter((row) => row.actual_mw <= low)],
      [
        'Medium',
        rangeRows.filter((row) => row.actual_mw > low && row.actual_mw <= high)
      ],
      ['High', rangeRows.filter((row) => row.actual_mw > high)]
    ].map(([label, rows]) => ({
      label,
      value: average(rows.map((row) => Math.abs(row.error_mw))) || 0
    }))
  }, [rangeRows])

  const exportRows = () => {
    const data = new Blob([JSON.stringify(dayRows, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `wind-${day}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-muted">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wind size={21} />
            </span>
            <div>
              <h1 className="font-semibold">Gridwise</h1>
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                WIND INTELLIGENCE
              </p>
            </div>
          </div>
          <nav className="flex max-w-full overflow-x-auto rounded-lg bg-muted p-1">
            {tabs.map(([name, Icon]) => (
              <button
                key={name}
                onClick={() => setActive(name)}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active === name
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon size={15} />
                {name}
              </button>
            ))}
          </nav>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        {error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            {error}
          </div>
        )}
        {loading && (
          <p className="text-sm text-muted-foreground">Loading backend data...</p>
        )}
        {!loading && metrics && (
          <>
            {active === 'Decision view' && (
              <>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-primary">
                      DAY-AHEAD DECISION SUPPORT
                    </p>
                    <h2 className="mt-1 text-3xl font-semibold">
                      What wind should I expect tomorrow?
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      The forecast you could have used at the D-1 buying cutoff.
                    </p>
                  </div>
                  <DateSelect value={day} dates={dates} onChange={setDay} />
                </div>
                <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
                  <b>Forecast selected: </b>
                  {primaryPublish ? (
                    <>
                      Using the forecast published at{' '}
                      <b>
                        {new Date(primaryPublish).toLocaleString('en-GB', {
                          timeZone: 'UTC'
                        })}{' '}
                        UTC
                      </b>
                      , the latest available before the day-ahead cutoff.
                    </>
                  ) : (
                    'No selected forecast is available for this day.'
                  )}
                </div>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card
                    title="Expected wind energy"
                    value={mwh(totalEnergy)}
                    detail="Forecast total across the delivery day"
                    icon={<Wind className="text-primary" size={19} />}
                  />
                  <Card
                    title="Peak forecast"
                    value={mw(Math.max(...dayRows.map((r) => r.forecast_mw), 0))}
                    detail="Highest expected half-hour output"
                    icon={<TrendingUp className="text-primary" size={19} />}
                  />
                  <Card
                    title="Lowest forecast"
                    value={mw(Math.min(...dayRows.map((r) => r.forecast_mw), 0))}
                    detail="Lowest expected half-hour output"
                    icon={<Gauge className="text-primary" size={19} />}
                  />
                  <Card
                    title="Cautious-case energy"
                    value={mwh(cautiousEnergy)}
                    detail="Forecast less typical P90 under-delivery"
                    icon={<AlertTriangle className="text-amber-600" size={19} />}
                  />
                </section>
                <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <Panel
                    title="Half-hourly wind forecast"
                    subtitle="Forecast with a typical historical error band"
                  >
                    <MiniLine
                      series={daySeries}
                      lines={[
                        {
                          label: 'Upper band',
                          color: '#93c5fd',
                          value: (r) => r.upper
                        },
                        {
                          label: 'Forecast',
                          color: '#2563eb',
                          value: (r) => r.forecast_mw
                        },
                        {
                          label: 'Lower band',
                          color: '#93c5fd',
                          value: (r) => r.lower
                        },
                        ...(showActual
                          ? [
                              {
                                label: 'Actual',
                                color: '#059669',
                                value: (r) => r.actual_mw
                              }
                            ]
                          : [])
                      ]}
                    />
                    <Caption>
                      The blue line is the decision-time forecast. The pale range is
                      plus or minus the historical P90 error, a practical
                      uncertainty buffer; green is the delivered output when shown.
                    </Caption>
                  </Panel>
                  <Panel
                    title="Decision guidance"
                    subtitle="Use this when estimating thermal generation to buy"
                  >
                    <div className="space-y-4 p-5 text-sm leading-6 text-muted-foreground">
                      <p>
                        Plan around{' '}
                        <b className="text-foreground">{mwh(totalEnergy)}</b> of
                        expected wind energy.
                      </p>
                      <p>
                        For a conservative procurement plan, use the cautious
                        case of{' '}
                        <b className="text-foreground">
                          {mwh(cautiousEnergy)}
                        </b>
                        .
                      </p>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showActual}
                          onChange={(e) => setShowActual(e.target.checked)}
                        />
                        Show actual output for this past day
                      </label>
                    </div>
                  </Panel>
                </div>
                <div className="mt-6">
                  <Panel
                    title="Numbers behind the forecast"
                    subtitle="Every half-hour used in the decision"
                    action={
                      <button
                        onClick={exportRows}
                        className="flex items-center gap-2 text-xs font-semibold text-primary"
                      >
                        <Download size={14} />
                        Export JSON
                      </button>
                    }
                  >
                    <ObservationTable rows={dayRows} showActual={showActual} />
                  </Panel>
                </div>
              </>
            )}

            {active === 'Forecast accuracy' && (
              <>
                <RangeHeader
                  dates={dates}
                  from={from}
                  to={to}
                  setFrom={setFrom}
                  setTo={setTo}
                />
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card
                    title="MAE"
                    value={mw(
                      average(rangeRows.map((row) => Math.abs(row.error_mw)))
                    )}
                    detail="Average size of the forecast miss."
                    icon={<Activity className="text-primary" size={19} />}
                  />
                  <Card
                    title="RMSE"
                    value={mw(
                      Math.sqrt(
                        average(rangeRows.map((r) => r.error_mw ** 2)) || 0
                      )
                    )}
                    detail="Gives bigger misses more importance."
                    icon={<Gauge className="text-primary" size={19} />}
                  />
                  <Card
                    title="Bias"
                    value={mw(average(rangeRows.map((r) => r.error_mw)))}
                    detail="Positive means forecasts run too high."
                    icon={<TrendingUp className="text-primary" size={19} />}
                  />
                  <Card
                    title="P90 absolute error"
                    value={mw(rangeP90)}
                    detail="A bad-day miss to plan a buffer around."
                    icon={<AlertTriangle className="text-amber-600" size={19} />}
                  />
                </section>
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <Panel
                    title="Actual vs forecast"
                    subtitle="All selected half-hour periods"
                  >
                    <MiniLine
                      series={rangeRows.map((r) => ({
                        ...r,
                        label: r.target_time.slice(5, 10)
                      }))}
                      lines={[
                        {
                          label: 'Forecast',
                          color: '#2563eb',
                          value: (r) => r.forecast_mw
                        },
                        {
                          label: 'Actual',
                          color: '#059669',
                          value: (r) => r.actual_mw
                        }
                      ]}
                    />
                    <Caption>
                      When blue and green are close, the forecast was accurate.
                      Blue above green means wind was over-forecast, which can
                      lead to under-procurement.
                    </Caption>
                  </Panel>
                  <Panel
                    title="Error distribution"
                    subtitle="How often errors are small or large"
                  >
                    <Bars
                      items={histogram}
                      value={(x) => x.count}
                      label={(x) => x.label}
                    />
                    <Caption>
                      Bars show the number of periods in each signed error range.
                      More bars on the right mean forecasts tend to overstate
                      wind; more on the left mean they understate it.
                    </Caption>
                  </Panel>
                  <Panel
                    title="Error by hour of day"
                    subtitle="Mean absolute error for each delivery hour"
                  >
                    <Bars
                      items={byHour}
                      value={(x) => x.value}
                      label={(x) => x.label}
                    />
                    <Caption>
                      Taller bars flag the hours when wind is hardest to predict.
                      Those are the periods where buyers may need more buffer.
                    </Caption>
                  </Panel>
                  <Panel
                    title="Error by wind level"
                    subtitle="Mean absolute error by delivered output"
                  >
                    <Bars
                      items={windLevels}
                      value={(x) => x.value}
                      label={(x) => x.label}
                      color="bg-emerald-600"
                    />
                    <Caption>
                      Low, medium and high wind are thirds of the observed output
                      range. This reveals whether calm or windy conditions cause
                      larger misses.
                    </Caption>
                  </Panel>
                </div>
                <div className="mt-6">
                  <Panel
                    title="Daily error"
                    subtitle="Average absolute error by delivery date"
                  >
                    <Bars
                      items={byDay}
                      value={(x) => x.value}
                      label={(x) => x.label}
                    />
                    <Caption>
                      Each bar is one day. Unusually tall bars identify dates worth
                      reviewing before relying on the forecast in similar
                      conditions.
                    </Caption>
                  </Panel>
                </div>
              </>
            )}

            {active === 'Horizon analysis' && (
              <>
                <div className="mb-6">
                  <p className="text-xs font-semibold tracking-wide text-primary">
                    FORECAST LEAD TIME
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold">
                    Does it matter when the forecast was made?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Horizon is the time between publication and delivery.
                  </p>
                </div>
                <section className="grid gap-4 md:grid-cols-2">
                  <Card
                    title="Decision-time MAE"
                    value={mw(horizon?.decision_time_mae_mw)}
                    detail="Error from the D-1 cutoff forecast used for buying."
                    icon={<Clock3 className="text-primary" size={19} />}
                  />
                  <Card
                    title="Later forecast MAE"
                    value={mw(horizon?.fresher_forecast_mae_mw)}
                    detail="Error from revisions published 12 hours or less before delivery."
                    icon={<TrendingUp className="text-emerald-600" size={19} />}
                  />
                </section>
                <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <Panel
                    title="Error versus forecast horizon"
                    subtitle="MAE grouped into six-hour publication-to-delivery windows"
                  >
                    <MiniLine
                      series={(horizon?.series || []).map((r) => ({
                        ...r,
                        label: `${r.horizon_start_hours}h`
                      }))}
                      lines={[
                        {
                          label: 'MAE',
                          color: '#2563eb',
                          value: (r) => r.mae_mw
                        }
                      ]}
                    />
                    <Caption>
                      Moving right means the forecast was made further before
                      delivery. A rising line shows the accuracy cost of making a
                      day-ahead decision rather than waiting for later updates.
                    </Caption>
                  </Panel>
                  <Panel
                    title="Buyer takeaway"
                    subtitle="Why the cutoff logic matters"
                  >
                    <div className="p-5 text-sm leading-6 text-muted-foreground">
                      <p>
                        Decision-time MAE is{' '}
                        <b className="text-foreground">
                          {mw(horizon?.decision_time_mae_mw)}
                        </b>
                        ; later forecasts average{' '}
                        <b className="text-foreground">
                          {mw(horizon?.fresher_forecast_mae_mw)}
                        </b>
                        .
                      </p>
                      <p className="mt-4">
                        {horizon?.decision_time_mae_mw &&
                        horizon?.fresher_forecast_mae_mw ? (
                          <>
                            Forecasts improve by{' '}
                            <b className="text-foreground">
                              {Math.max(
                                0,
                                (1 -
                                  horizon.fresher_forecast_mae_mw /
                                    horizon.decision_time_mae_mw) *
                                  100
                              ).toFixed(0)}
                              %
                            </b>{' '}
                            closer to delivery. Use the decision-time result for
                            day-ahead buying, then plan to adjust as fresher
                            forecasts arrive.
                          </>
                        ) : (
                          'Horizon comparison will appear when output data is available.'
                        )}
                      </p>
                    </div>
                  </Panel>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function DateSelect({ value, dates, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-sm transition focus-within:border-primary/60">
      <CalendarDays className="text-primary" size={16} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium outline-none"
      >
        {dates.map((date) => (
          <option key={date} value={date}>
            {fmtDay(date)}
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground" size={14} />
    </label>
  )
}

function RangeHeader({ dates, from, to, setFrom, setTo }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary">
          FORECAST PERFORMANCE
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          How much can I trust these forecasts?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Quantify the uncertainty in forecasts used for purchasing.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 text-sm shadow-sm">
        <CalendarDays className="ml-1 text-primary" size={16} />
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-transparent font-medium outline-none"
        >
          {dates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">to</span>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-transparent font-medium outline-none"
        >
          {dates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}