# Canvas Grid Bench

A React 19 + TypeScript canvas grid prototype with an AG Grid-inspired API and TanStack Table as the row, column, and sorting logic layer.

## Run It

Use a current Node version supported by Vite, then install and start the app:

```bash
cd /Users/rick/dev/canvas-grid
npm install
npm run dev
```

Open `http://localhost:4173`.

Do not serve the repo root with `python3 -m http.server`; Vite is required in development so TypeScript, TSX, React Fast Refresh, and CSS imports are transformed before the browser sees them.

Useful scripts:

```bash
npm run typecheck
npm run build
npm run build:pages
npm run preview
```

`npm run build` is the normal local production build. `npm run build:pages` produces the GitHub Pages version with the repository base path baked in.

## What It Includes

- React 19, Vite, and TypeScript with strict compiler settings
- `CanvasGrid<TData>`, a reusable typed React component
- An imperative AG-style API: `setRowData`, `setColumnDefs`, `setGridOption`, `refreshCells`, `sizeColumnsToFit`, `applyColumnState`, `forEachNode`, and `runBenchmarks`
- TanStack Table for row models, accessors, and sorting
- Canvas viewport rendering with row and column virtualization
- Benchmark scenarios for value-only paint, renderer-heavy viewport paint, full-table renderer invocation, renderer plus layout work, and scratch-canvas drawing

## Structure

- `src/canvas-grid.tsx`: the typed grid component and imperative API wiring
- `src/grid-core.ts`: TanStack column adapters, viewport math, cell resolution, and canvas painting
- `src/benchmark.ts`: benchmark scenarios and timing aggregation
- `src/data.ts`: synthetic market data and AG-style column definitions
- `src/App.tsx`: demo UI, presets, benchmark panel, and interaction inspector
- `src/index.ts`: public exports for reusing the grid component

## Deploy To GitHub Pages

This repo is configured for GitHub Pages project-site deployment at:

- [https://rickono.github.io/canvas-grid/](https://rickono.github.io/canvas-grid/)

To enable it in GitHub:

1. Open the repository settings for Pages.
2. Under Build and deployment, set Source to `GitHub Actions`.
3. Push to `main` and wait for the `Deploy to GitHub Pages` workflow to finish.

For a local Pages-style build check, run:

```bash
npm run build:pages
```

## Example

```tsx
import { useRef } from "react";
import {
  CanvasGrid,
  createColumnDefs,
  createMarketData,
  type CanvasGridApi,
  type MarketRow,
} from "./src";

export function Example() {
  const gridRef = useRef<CanvasGridApi<MarketRow> | null>(null);

  return (
    <CanvasGrid<MarketRow>
      ref={gridRef}
      rowData={createMarketData(10000)}
      columnDefs={createColumnDefs("balanced")}
      defaultColDef={{ sortable: true, width: 132 }}
      onGridReady={({ api }) => api.sizeColumnsToFit()}
    />
  );
}
```
