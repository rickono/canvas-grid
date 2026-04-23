import type { Column, Row } from "@tanstack/react-table";
import {
  DEFAULT_THEME,
  drawCellContent,
  getColumnDefinition,
  getVisibleColumnWindow,
  getVisibleRowWindow,
  paintGrid,
  resolveCellSpec,
} from "./grid-core";
import type { BenchmarkResult, ColumnMetric, GridTheme } from "./types";

interface Stats {
  averageMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

interface RunGridBenchmarksParams<TData> {
  rows: Row<TData>[];
  columns: Column<TData, unknown>[];
  columnMetrics: ColumnMetric<TData>[];
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  rowHeight: number;
  headerHeight: number;
  overscanRows?: number;
  overscanColumns?: number;
  iterations?: number;
  theme?: GridTheme;
}

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, sample) => sum + sample, 0);
  const averageMs = total / samples.length;
  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];

  return {
    averageMs,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    p95Ms,
  };
}

function runScenario(
  label: string,
  cellCount: number,
  iterations: number,
  runner: () => void,
): BenchmarkResult {
  const warmupCount = Math.min(2, Math.max(1, iterations - 1));
  for (let warmupIndex = 0; warmupIndex < warmupCount; warmupIndex += 1) {
    runner();
  }

  const samples: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = performance.now();
    runner();
    samples.push(performance.now() - startedAt);
  }

  const summary = stats(samples);
  return {
    label,
    cellCount,
    cellsPerSecond: cellCount / Math.max(summary.averageMs / 1000, 0.0001),
    ...summary,
  };
}

function drawAllCells<TData>({
  context,
  rows,
  columns,
  columnMetrics,
  rowHeight,
  theme,
}: {
  context: CanvasRenderingContext2D;
  rows: Row<TData>[];
  columns: Column<TData, unknown>[];
  columnMetrics: ColumnMetric<TData>[];
  rowHeight: number;
  theme: GridTheme;
}) {
  const rect = { x: 8, y: 8, width: 120, height: rowHeight };

  context.clearRect(0, 0, 512, 256);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const definition = getColumnDefinition(column);
      const spec = resolveCellSpec({
        row,
        column,
        definition,
        rowIndex,
        columnIndex,
        callRenderer: true,
      });

      rect.x = 8 + (columnIndex % 4) * 126;
      rect.y = 8 + (rowIndex % 6) * (rowHeight + 4);
      rect.width = Math.min(120, columnMetrics[columnIndex].width - 4);

      context.fillStyle = rowIndex % 2 === 0 ? theme.rowEven : theme.rowOdd;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      drawCellContent(context, spec, rect, theme);
    }
  }
}

export function runGridBenchmarks<TData>({
  rows,
  columns,
  columnMetrics,
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
  rowHeight,
  headerHeight,
  overscanRows = 4,
  overscanColumns = 1,
  iterations = 6,
  theme = DEFAULT_THEME,
}: RunGridBenchmarksParams<TData>): BenchmarkResult[] {
  const scratchCanvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  scratchCanvas.width = Math.max(1, Math.floor(viewportWidth * dpr));
  scratchCanvas.height = Math.max(1, Math.floor(viewportHeight * dpr));
  const context = scratchCanvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is not available.");
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const visibleRows = getVisibleRowWindow(
    rows.length,
    scrollTop,
    Math.max(0, viewportHeight - headerHeight),
    rowHeight,
    overscanRows,
  );
  const visibleColumns = getVisibleColumnWindow(
    columnMetrics,
    scrollLeft,
    viewportWidth,
    overscanColumns,
  );

  const visibleCellCount =
    (visibleRows.end - visibleRows.start) * (visibleColumns.end - visibleColumns.start);
  const totalCellCount = rows.length * columns.length;
  const totalWidth = columnMetrics.length
    ? columnMetrics[columnMetrics.length - 1].x + columnMetrics[columnMetrics.length - 1].width
    : viewportWidth;

  return [
    runScenario("Visible paint: values only", visibleCellCount, iterations, () => {
      paintGrid({
        context,
        width: viewportWidth,
        height: viewportHeight,
        rows,
        columns,
        columnMetrics,
        totalWidth,
        scrollLeft,
        scrollTop,
        rowHeight,
        headerHeight,
        overscanRows,
        overscanColumns,
        callRenderers: false,
        theme,
      });
    }),
    runScenario("Visible paint: invoke renderers", visibleCellCount, iterations, () => {
      paintGrid({
        context,
        width: viewportWidth,
        height: viewportHeight,
        rows,
        columns,
        columnMetrics,
        totalWidth,
        scrollLeft,
        scrollTop,
        rowHeight,
        headerHeight,
        overscanRows,
        overscanColumns,
        callRenderers: true,
        theme,
      });
    }),
    runScenario("Call cell renderers for every cell", totalCellCount, iterations, () => {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
          const column = columns[columnIndex];
          resolveCellSpec({
            row,
            column,
            definition: getColumnDefinition(column),
            rowIndex,
            columnIndex,
            callRenderer: true,
          });
        }
      }
    }),
    runScenario("Renderer + layout pass for every cell", totalCellCount, iterations, () => {
      let layoutChecksum = 0;

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const y = headerHeight + rowIndex * rowHeight;

        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
          const column = columns[columnIndex];
          const metric = columnMetrics[columnIndex];
          const spec = resolveCellSpec({
            row,
            column,
            definition: getColumnDefinition(column),
            rowIndex,
            columnIndex,
            callRenderer: true,
          });

          layoutChecksum += metric.x + y + metric.width + String(spec.text ?? "").length;
        }
      }

      if (layoutChecksum === Number.NEGATIVE_INFINITY) {
        throw new Error("Impossible checksum guard.");
      }
    }),
    runScenario("Scratch canvas draw for every cell", totalCellCount, iterations, () => {
      drawAllCells({
        context,
        rows,
        columns,
        columnMetrics,
        rowHeight,
        theme,
      });
    }),
  ];
}
