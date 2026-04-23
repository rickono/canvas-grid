import type { Column, ColumnDef, Row } from "@tanstack/react-table";
import type {
  CellDrawSpec,
  ColumnMetric,
  GridColumnDef,
  GridTheme,
  ResolvedColumnDef,
  TextAlign,
} from "./types";

export const DEFAULT_THEME: GridTheme = {
  background: "#fffaf1",
  rowOdd: "#fffaf1",
  rowEven: "#fcf5e8",
  headerBackground: "#f4ecdc",
  headerText: "#172033",
  text: "#172033",
  mutedText: "#6d7485",
  gridLine: "rgba(23, 32, 51, 0.1)",
  border: "rgba(23, 32, 51, 0.14)",
  shadow: "rgba(23, 32, 51, 0.09)",
};

interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CellVisitorParams<TData> {
  row: Row<TData>;
  rowIndex: number;
  column: Column<TData, unknown>;
  columnIndex: number;
  definition: ResolvedColumnDef<TData>;
  metric: ColumnMetric<TData>;
  rect: CellRect;
}

interface IterateCellWindowParams<TData> {
  rows: Row<TData>[];
  columns: Column<TData, unknown>[];
  columnMetrics: ColumnMetric<TData>[];
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  rowHeight: number;
  headerHeight: number;
  overscanRows?: number;
  overscanColumns?: number;
  visitor: (params: CellVisitorParams<TData>) => void;
}

interface ResolveCellSpecParams<TData> {
  row: Row<TData>;
  column: Column<TData, unknown>;
  definition: ResolvedColumnDef<TData>;
  rowIndex: number;
  columnIndex: number;
  callRenderer?: boolean;
}

interface PaintGridParams<TData> {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  rows: Row<TData>[];
  columns: Column<TData, unknown>[];
  columnMetrics: ColumnMetric<TData>[];
  totalWidth: number;
  scrollLeft: number;
  scrollTop: number;
  rowHeight: number;
  headerHeight: number;
  overscanRows?: number;
  overscanColumns?: number;
  callRenderers?: boolean;
  theme?: GridTheme;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function titleCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createAccessor<TData>(definition: ResolvedColumnDef<TData>) {
  if (typeof definition.valueGetter === "function") {
    return (row: TData) =>
      definition.valueGetter?.({
        data: row,
        colDef: definition,
        field: definition.field,
      });
  }

  if (typeof definition.accessorFn === "function") {
    return definition.accessorFn;
  }

  const key = definition.field ?? definition.id;
  return (row: TData) => row[key as keyof TData];
}

function resolveAlign<TData>(definition: GridColumnDef<TData>): TextAlign {
  if (definition.align) {
    return definition.align;
  }

  return definition.type === "numericColumn" || definition.numeric ? "right" : "left";
}

export function resolveColumnDefs<TData>(
  columnDefs: GridColumnDef<TData>[],
  defaultColDef: Partial<GridColumnDef<TData>> = {},
  columnSizing: Record<string, number> = {},
): ResolvedColumnDef<TData>[] {
  return columnDefs.map((columnDef, index) => {
    const merged = { ...defaultColDef, ...columnDef };
    const id = merged.colId ?? merged.field ?? `column_${index}`;
    const minWidth = merged.minWidth ?? 80;
    const maxWidth = merged.maxWidth ?? Number.POSITIVE_INFINITY;
    const preferredWidth = columnSizing[id] ?? merged.width ?? 140;

    return {
      ...merged,
      id,
      headerName: merged.headerName ?? titleCase(merged.field ?? id),
      width: clamp(preferredWidth, minWidth, maxWidth),
      minWidth,
      maxWidth,
      align: resolveAlign(merged),
      sortable: merged.sortable !== false,
    };
  });
}

export function buildTanStackColumns<TData>(
  definitions: ResolvedColumnDef<TData>[],
): ColumnDef<TData, unknown>[] {
  return definitions.map((definition) => {
    const base = {
      id: definition.id,
      header: definition.headerName,
      enableSorting: definition.sortable !== false,
      meta: { definition },
    };

    if (definition.field && typeof definition.valueGetter !== "function") {
      return {
        ...base,
        accessorKey: definition.field,
      } as ColumnDef<TData, unknown>;
    }

    return {
      ...base,
      accessorFn: createAccessor(definition),
    } as ColumnDef<TData, unknown>;
  });
}

export function getColumnDefinition<TData>(
  column: Column<TData, unknown>,
): ResolvedColumnDef<TData> {
  return (column.columnDef.meta as { definition: ResolvedColumnDef<TData> }).definition;
}

export function buildColumnMetrics<TData>(columns: Column<TData, unknown>[]) {
  const metrics: ColumnMetric<TData>[] = [];
  let cursor = 0;

  columns.forEach((column) => {
    const definition = getColumnDefinition(column);
    const width = definition.width;

    metrics.push({
      id: column.id,
      x: cursor,
      width,
      definition,
      column,
    });

    cursor += width;
  });

  return { metrics, totalWidth: cursor };
}

export function getVisibleColumnWindow<TData>(
  columnMetrics: ColumnMetric<TData>[],
  scrollLeft: number,
  viewportWidth: number,
  overscanColumns = 1,
) {
  let start = 0;
  while (
    start < columnMetrics.length &&
    columnMetrics[start].x + columnMetrics[start].width < scrollLeft
  ) {
    start += 1;
  }

  let end = start;
  while (end < columnMetrics.length && columnMetrics[end].x < scrollLeft + viewportWidth) {
    end += 1;
  }

  return {
    start: Math.max(0, start - overscanColumns),
    end: Math.min(columnMetrics.length, end + overscanColumns),
  };
}

export function getVisibleRowWindow(
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  overscanRows = 4,
) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
  const end = Math.min(
    rowCount,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscanRows,
  );

  return { start, end };
}

export function iterateCellWindow<TData>({
  rows,
  columns,
  columnMetrics,
  scrollLeft,
  scrollTop,
  viewportWidth,
  viewportHeight,
  rowHeight,
  headerHeight,
  overscanRows = 4,
  overscanColumns = 1,
  visitor,
}: IterateCellWindowParams<TData>) {
  const rowWindow = getVisibleRowWindow(
    rows.length,
    scrollTop,
    Math.max(0, viewportHeight - headerHeight),
    rowHeight,
    overscanRows,
  );
  const columnWindow = getVisibleColumnWindow(
    columnMetrics,
    scrollLeft,
    viewportWidth,
    overscanColumns,
  );

  for (let rowIndex = rowWindow.start; rowIndex < rowWindow.end; rowIndex += 1) {
    const row = rows[rowIndex];
    const y = headerHeight + rowIndex * rowHeight - scrollTop;

    for (
      let columnIndex = columnWindow.start;
      columnIndex < columnWindow.end;
      columnIndex += 1
    ) {
      const metric = columnMetrics[columnIndex];
      const column = columns[columnIndex];
      const definition = getColumnDefinition(column);

      visitor({
        row,
        rowIndex,
        column,
        columnIndex,
        definition,
        metric,
        rect: {
          x: metric.x - scrollLeft,
          y,
          width: metric.width,
          height: rowHeight,
        },
      });
    }
  }

  return {
    rowWindow,
    columnWindow,
  };
}

function normalizeCellSpec<TData>(
  output: CellDrawSpec | string | number | null | undefined,
  definition: ResolvedColumnDef<TData>,
  fallbackValue: unknown,
): Required<Pick<CellDrawSpec, "type" | "text" | "align">> & CellDrawSpec {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return {
      type: output.type ?? "text",
      text: output.text ?? (fallbackValue == null ? "" : String(fallbackValue)),
      align: output.align ?? definition.align,
      fillStyle: output.fillStyle,
      backgroundColor: output.backgroundColor,
      strokeStyle: output.strokeStyle,
      font: output.font,
      values: output.values,
      intensity: output.intensity,
      positiveColor: output.positiveColor,
      negativeColor: output.negativeColor,
    };
  }

  return {
    type: "text",
    text: output == null ? "" : String(output),
    align: definition.align,
  };
}

export function resolveCellSpec<TData>({
  row,
  column,
  definition,
  rowIndex,
  columnIndex,
  callRenderer = true,
}: ResolveCellSpecParams<TData>) {
  const value = row.getValue(column.id);
  const formatterParams = {
    value,
    data: row.original,
    rowIndex,
    column,
    colDef: definition,
  };
  const formattedValue =
    typeof definition.valueFormatter === "function"
      ? definition.valueFormatter(formatterParams)
      : value;

  if (callRenderer && typeof definition.cellRenderer === "function") {
    return normalizeCellSpec(
      definition.cellRenderer({
        ...formatterParams,
        columnIndex,
        formattedValue,
      }),
      definition,
      formattedValue,
    );
  }

  return normalizeCellSpec(formattedValue as string | number | null | undefined, definition, value);
}

function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawTextCell(
  context: CanvasRenderingContext2D,
  spec: CellDrawSpec,
  rect: CellRect,
  theme: GridTheme,
) {
  const horizontalPadding = 10;
  const textAlign = spec.align === "right" ? "right" : spec.align === "center" ? "center" : "left";
  const textX =
    textAlign === "right"
      ? rect.x + rect.width - horizontalPadding
      : textAlign === "center"
        ? rect.x + rect.width / 2
        : rect.x + horizontalPadding;
  const textY = rect.y + rect.height / 2 + 2;

  context.save();
  context.beginPath();
  context.rect(rect.x + 2, rect.y + 1, rect.width - 4, rect.height - 2);
  context.clip();
  context.font = spec.font ?? '500 12px "Space Grotesk", sans-serif';
  context.textAlign = textAlign;
  context.textBaseline = "middle";
  context.fillStyle = spec.fillStyle ?? theme.text;
  context.fillText(String(spec.text ?? ""), textX, textY);
  context.restore();
}

function drawBadge(
  context: CanvasRenderingContext2D,
  spec: CellDrawSpec,
  rect: CellRect,
  theme: GridTheme,
) {
  const text = String(spec.text ?? "");
  context.save();
  context.font = spec.font ?? '600 11px "Space Grotesk", sans-serif';
  const badgeWidth = Math.min(rect.width - 12, context.measureText(text).width + 18);
  const badgeHeight = Math.min(22, rect.height - 8);
  const x = rect.x + 8;
  const y = rect.y + (rect.height - badgeHeight) / 2;

  roundRectPath(context, x, y, badgeWidth, badgeHeight, 999);
  context.fillStyle = spec.backgroundColor ?? "#ebeef2";
  context.fill();
  if (spec.strokeStyle) {
    context.strokeStyle = spec.strokeStyle;
    context.lineWidth = 1;
    context.stroke();
  }

  context.fillStyle = spec.fillStyle ?? theme.text;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(text, x + 10, y + badgeHeight / 2 + 0.5);
  context.restore();
}

function drawHeatCell(context: CanvasRenderingContext2D, spec: CellDrawSpec, rect: CellRect) {
  const intensity = Math.max(0, Math.min(1, spec.intensity ?? 0));
  const width = Math.max(8, (rect.width - 12) * intensity);
  const height = Math.max(8, rect.height - 12);

  context.save();
  roundRectPath(context, rect.x + 6, rect.y + 6, width, height, 8);
  context.fillStyle = `rgba(241, 143, 1, ${0.1 + intensity * 0.2})`;
  context.fill();
  context.restore();
}

function drawSparkbars(context: CanvasRenderingContext2D, spec: CellDrawSpec, rect: CellRect) {
  const values = Array.isArray(spec.values) ? spec.values : [];
  if (!values.length) {
    return;
  }

  const chartWidth = Math.max(0, Math.min(rect.width - 64, rect.width - 14));
  const chartHeight = Math.max(0, rect.height - 12);
  const x = rect.x + 8;
  const y = rect.y + 6;
  const zeroLine = y + chartHeight / 2;
  const barWidth = Math.max(3, chartWidth / values.length - 2);
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);

  context.save();
  context.strokeStyle = "rgba(23, 32, 51, 0.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, zeroLine + 0.5);
  context.lineTo(x + chartWidth, zeroLine + 0.5);
  context.stroke();

  values.forEach((value, index) => {
    const scaled = (Math.abs(value) / max) * (chartHeight / 2 - 2);
    const barX = x + index * (barWidth + 2);
    const barY = value >= 0 ? zeroLine - scaled : zeroLine;
    const barHeight = Math.max(2, scaled);
    context.fillStyle =
      value >= 0 ? spec.positiveColor ?? "#0c7a43" : spec.negativeColor ?? "#c55f14";
    context.fillRect(barX, barY, barWidth, barHeight);
  });

  context.restore();
}

export function drawCellContent(
  context: CanvasRenderingContext2D,
  spec: CellDrawSpec,
  rect: CellRect,
  theme: GridTheme,
) {
  if (spec.type === "heat") {
    drawHeatCell(context, spec, rect);
  }

  if (spec.type === "badge") {
    drawBadge(context, spec, rect, theme);
    return;
  }

  if (spec.type === "sparkbars") {
    drawSparkbars(context, spec, rect);
  }

  drawTextCell(context, spec, rect, theme);
}

function drawHeaderCell<TData>(
  context: CanvasRenderingContext2D,
  metric: ColumnMetric<TData>,
  scrollLeft: number,
  headerHeight: number,
  theme: GridTheme,
) {
  const column = metric.column;
  const definition = metric.definition;
  const x = metric.x - scrollLeft;
  const sorted = column.getIsSorted();

  context.save();
  context.fillStyle = theme.headerBackground;
  context.fillRect(x, 0, metric.width, headerHeight);
  context.strokeStyle = theme.gridLine;
  context.strokeRect(x + 0.5, 0.5, metric.width, headerHeight - 1);
  context.fillStyle = theme.headerText;
  context.font = '600 12px "Space Grotesk", sans-serif';
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(definition.headerName, x + 10, headerHeight / 2 + 1);

  if (sorted) {
    context.font = '700 11px "IBM Plex Mono", monospace';
    context.textAlign = "right";
    context.fillStyle = theme.mutedText;
    context.fillText(sorted === "asc" ? "ASC" : "DESC", x + metric.width - 10, headerHeight / 2 + 1);
  }

  context.restore();
}

export function paintGrid<TData>({
  context,
  width,
  height,
  rows,
  columns,
  columnMetrics,
  totalWidth,
  scrollLeft,
  scrollTop,
  rowHeight,
  headerHeight,
  overscanRows = 4,
  overscanColumns = 1,
  callRenderers = true,
  theme = DEFAULT_THEME,
}: PaintGridParams<TData>) {
  const startedAt = performance.now();
  let paintedCellCount = 0;
  let renderCalls = 0;

  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = theme.headerBackground;
  context.fillRect(0, 0, width, headerHeight);

  const { start: columnStart, end: columnEnd } = getVisibleColumnWindow(
    columnMetrics,
    scrollLeft,
    width,
    overscanColumns,
  );

  for (let index = columnStart; index < columnEnd; index += 1) {
    drawHeaderCell(context, columnMetrics[index], scrollLeft, headerHeight, theme);
  }

  context.save();
  context.beginPath();
  context.rect(0, headerHeight, width, Math.max(0, height - headerHeight));
  context.clip();

  const { rowWindow, columnWindow } = iterateCellWindow({
    rows,
    columns,
    columnMetrics,
    scrollLeft,
    scrollTop,
    viewportWidth: width,
    viewportHeight: height,
    rowHeight,
    headerHeight,
    overscanRows,
    overscanColumns,
    visitor({ row, rowIndex, column, columnIndex, definition, rect }) {
      paintedCellCount += 1;
      if (callRenderers && typeof definition.cellRenderer === "function") {
        renderCalls += 1;
      }

      context.fillStyle = rowIndex % 2 === 0 ? theme.rowEven : theme.rowOdd;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeStyle = theme.gridLine;
      context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height);

      const spec = resolveCellSpec({
        row,
        column,
        definition,
        rowIndex,
        columnIndex,
        callRenderer: callRenderers,
      });

      drawCellContent(context, spec, rect, theme);
    },
  });

  context.restore();

  context.fillStyle = theme.headerBackground;
  context.fillRect(0, 0, width, headerHeight);

  for (let index = columnStart; index < columnEnd; index += 1) {
    drawHeaderCell(context, columnMetrics[index], scrollLeft, headerHeight, theme);
  }

  context.strokeStyle = theme.border;
  context.strokeRect(0.5, 0.5, width - 1, height - 1);

  if (scrollLeft > 1) {
    context.fillStyle = theme.shadow;
    context.fillRect(0, 0, 8, height);
  }

  context.restore();

  return {
    durationMs: performance.now() - startedAt,
    paintedCellCount,
    renderCalls,
    visibleRowCount: rowWindow.end - rowWindow.start,
    visibleColumnCount: columnWindow.end - columnWindow.start,
    totalWidth,
    totalHeight: headerHeight + rows.length * rowHeight,
  };
}
