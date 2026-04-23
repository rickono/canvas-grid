import { startTransition, useRef, useState } from "react";
import { CanvasGrid } from "./canvas-grid";
import {
  GRID_PRESETS,
  createColumnDefs,
  createMarketData,
  type GridPreset,
  type MarketRow,
} from "./data";
import type { BenchmarkResult, CanvasGridApi, CellClickedEvent, PaintMetrics } from "./types";

function number(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function compactDuration(value: number) {
  return `${value.toFixed(value < 10 ? 2 : 1)} ms`;
}

function compactRate(value: number) {
  if (value > 1000000) {
    return `${(value / 1000000).toFixed(2)}M cells/s`;
  }
  if (value > 1000) {
    return `${(value / 1000).toFixed(1)}k cells/s`;
  }
  return `${value.toFixed(0)} cells/s`;
}

function usageSnippet() {
  return `const gridRef = useRef<CanvasGridApi<MarketRow>>(null);

<CanvasGrid<MarketRow>
  ref={gridRef}
  rowData={createMarketData(10000)}
  columnDefs={createColumnDefs("balanced")}
  defaultColDef={{ sortable: true, width: 132 }}
  onGridReady={({ api }) => api.sizeColumnsToFit()}
/>;

gridRef.current?.refreshCells();
gridRef.current?.runBenchmarks({ iterations: 7 });`;
}

function ResultTable({ results }: { results: BenchmarkResult[] }) {
  if (!results.length) {
    return (
      <div className="empty-state">
        Benchmark results land here after you run the suite. The heavy scenarios isolate renderer
        cost from plain canvas paint.
      </div>
    );
  }

  return (
    <div className="results-table">
      <div className="results-table__head">
        <span>Scenario</span>
        <span>Avg</span>
        <span>P95</span>
        <span>Throughput</span>
        <span>Cells</span>
      </div>
      {results.map((result) => (
        <div className="results-table__row" key={result.label}>
          <span>{result.label}</span>
          <span>{compactDuration(result.averageMs)}</span>
          <span>{compactDuration(result.p95Ms)}</span>
          <span>{compactRate(result.cellsPerSecond)}</span>
          <span>{number(result.cellCount)}</span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const defaultPreset = GRID_PRESETS[1];
  const gridApiRef = useRef<CanvasGridApi<MarketRow> | null>(null);
  const [activePreset, setActivePreset] = useState<GridPreset>(defaultPreset);
  const [rowData, setRowData] = useState(() => createMarketData(defaultPreset.rowCount));
  const [columnDefs, setColumnDefs] = useState(() => createColumnDefs(defaultPreset.profile));
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [paintMetrics, setPaintMetrics] = useState<PaintMetrics | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [lastCellClick, setLastCellClick] = useState<CellClickedEvent<MarketRow> | null>(null);

  function applyPreset(preset: GridPreset) {
    setActivePreset(preset);
    setBenchmarkResults([]);
    setLastCellClick(null);

    startTransition(() => {
      setRowData(createMarketData(preset.rowCount));
      setColumnDefs(createColumnDefs(preset.profile));
    });
  }

  function handleRunBenchmarks() {
    if (!gridApiRef.current || isBenchmarking) {
      return;
    }

    setIsBenchmarking(true);
    window.setTimeout(() => {
      const results = gridApiRef.current?.runBenchmarks({
        iterations: activePreset.iterations,
      });

      startTransition(() => {
        setBenchmarkResults(results ?? []);
        setIsBenchmarking(false);
      });
    }, 40);
  }

  return (
    <main className="page-shell">
      <section className="hero panel">
        <div className="hero__copy">
          <span className="eyebrow">React 19 • TypeScript • TanStack Table • Canvas</span>
          <h1>AG-style canvas grid with benchmarkable renderer paths.</h1>
          <p className="hero__lede">
            This app keeps the grid API familiar, uses TanStack Table as the row and column logic
            layer, and paints the viewport into a single canvas so expensive rendering paths are
            measurable instead of implied.
          </p>
          <div className="hero__chips">
            <span>Typed imperative API</span>
            <span>Viewport virtualization</span>
            <span>Renderer microbenchmarks</span>
          </div>
        </div>
        <div className="hero__stats">
          <div className="stat-card">
            <span className="stat-card__label">Rows</span>
            <strong>{number(rowData.length)}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Columns</span>
            <strong>{columnDefs.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Last Paint</span>
            <strong>{paintMetrics ? compactDuration(paintMetrics.durationMs) : "Waiting"}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Visible Cells</span>
            <strong>
              {paintMetrics ? number(paintMetrics.paintedCellCount) : "Measure after first draw"}
            </strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace__left">
          <div className="panel controls">
            <div className="controls__header">
              <div>
                <h2>Presets</h2>
                <p>
                  Switch between realistic data shapes, then run the benchmark suite against the
                  current viewport.
                </p>
              </div>
              <button
                className="button button--primary"
                onClick={handleRunBenchmarks}
                disabled={isBenchmarking}
              >
                {isBenchmarking ? "Benchmarking..." : "Run Benchmarks"}
              </button>
            </div>
            <div className="preset-list">
              {GRID_PRESETS.map((preset) => (
                <button
                  className={`preset-card${
                    activePreset.id === preset.id ? " preset-card--active" : ""
                  }`}
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel grid-panel">
            <div className="grid-panel__header">
              <div>
                <h2>Canvas Grid</h2>
                <p>
                  Header clicks cycle sort state through TanStack Table. Body clicks surface the row
                  payload without mounting per-cell DOM.
                </p>
              </div>
              <button
                className="button button--ghost"
                onClick={() => gridApiRef.current?.sizeColumnsToFit()}
              >
                Size Columns To Fit
              </button>
            </div>
            <CanvasGrid<MarketRow>
              ref={gridApiRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, width: 132 }}
              height={620}
              onGridReady={({ api }) => {
                gridApiRef.current = api;
              }}
              onCellClicked={(event) => setLastCellClick(event)}
              onPaint={(metrics) => setPaintMetrics(metrics)}
            />
          </div>
        </div>

        <div className="workspace__right">
          <div className="panel">
            <h2>Benchmark Results</h2>
            <p className="panel__lede">
              The suite separates plain viewport paint from the costly paths that invoke renderers
              for every visible cell or every cell in the data set.
            </p>
            <ResultTable results={benchmarkResults} />
          </div>

          <div className="panel">
            <h2>API Shape</h2>
            <pre className="code-block">
              <code>{usageSnippet()}</code>
            </pre>
          </div>

          <div className="panel">
            <h2>Last Interaction</h2>
            {lastCellClick ? (
              <div className="interaction">
                <strong>
                  Row {lastCellClick.rowIndex + 1} • {lastCellClick.colDef.headerName}
                </strong>
                <span>{String(lastCellClick.value)}</span>
                <small>
                  {lastCellClick.data.tradeId} • {lastCellClick.data.symbol}
                </small>
              </div>
            ) : (
              <div className="empty-state">
                Click a body cell to inspect the payload flowing through the AG-style event callback.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
