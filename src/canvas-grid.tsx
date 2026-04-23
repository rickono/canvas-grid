import {
  forwardRef,
  startTransition,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type MouseEvent,
  type ReactElement,
  type UIEvent,
  type WheelEvent,
} from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { runGridBenchmarks } from "./benchmark";
import {
  DEFAULT_THEME,
  buildColumnMetrics,
  buildTanStackColumns,
  paintGrid,
  resolveColumnDefs,
} from "./grid-core";
import type {
  CanvasGridApi,
  CanvasGridColumnApi,
  CanvasGridProps,
  GridColumnDef,
  PaintMetrics,
  ResolvedColumnDef,
  RuntimeGridState,
} from "./types";

function cycleSorting(currentSorting: SortingState, columnId: string): SortingState {
  const existing = currentSorting.find((entry) => entry.id === columnId);
  if (!existing) {
    return [{ id: columnId, desc: false }];
  }
  if (!existing.desc) {
    return [{ id: columnId, desc: true }];
  }
  return [];
}

function fitColumnsToWidth<TData>(
  definitions: ResolvedColumnDef<TData>[],
  viewportWidth: number,
) {
  if (!viewportWidth || !definitions.length) {
    return {};
  }

  const total = definitions.reduce((sum, definition) => sum + definition.width, 0);
  if (!total) {
    return {};
  }

  const ratio = viewportWidth / total;
  const sizing: Record<string, number> = {};
  let remainder = viewportWidth;

  definitions.forEach((definition, index) => {
    const raw = Math.floor(definition.width * ratio);
    const width = Math.max(definition.minWidth, Math.min(definition.maxWidth, raw));
    sizing[definition.id] = width;
    remainder -= width;

    if (index === definitions.length - 1 && remainder !== 0) {
      sizing[definition.id] = Math.max(
        definition.minWidth,
        Math.min(definition.maxWidth, sizing[definition.id] + remainder),
      );
    }
  });

  return sizing;
}

function ensureContext(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.floor(width * dpr));
  const nextHeight = Math.max(1, Math.floor(height * dpr));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is not available.");
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function clampScroll(value: number, max: number) {
  return Math.max(0, Math.min(value, Math.max(0, max)));
}

function CanvasGridInner<TData extends RowData>(
  {
    rowData,
    columnDefs,
    defaultColDef = {},
    rowHeight = 34,
    headerHeight = 42,
    overscanRows = 6,
    overscanColumns = 1,
    theme = DEFAULT_THEME,
    height = 560,
    onGridReady,
    onCellClicked,
    onSortChanged,
    onPaint,
  }: CanvasGridProps<TData>,
  ref: ForwardedRef<CanvasGridApi<TData>>,
) {
  const [internalRows, setInternalRows] = useState<TData[]>(() => rowData);
  const [internalColumns, setInternalColumns] = useState<GridColumnDef<TData>[]>(() => columnDefs);
  const [rowHeightState, setRowHeightState] = useState(rowHeight);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: 0, height });
  const scrollStateRef = useRef({ left: 0, top: 0 });
  const frameRef = useRef<number>(0);
  const readyRef = useRef(false);
  const lastPaintRef = useRef<PaintMetrics | null>(null);
  const stateRef = useRef<RuntimeGridState<TData> | null>(null);
  const apiRef = useRef<CanvasGridApi<TData> | null>(null);
  const columnApiRef = useRef<CanvasGridColumnApi | null>(null);
  const callbacksRef = useRef({
    onCellClicked,
    onGridReady,
    onPaint,
    onSortChanged,
  });

  callbacksRef.current = {
    onCellClicked,
    onGridReady,
    onPaint,
    onSortChanged,
  };

  function syncScrollFromElement(element: HTMLDivElement) {
    scrollStateRef.current = {
      left: element.scrollLeft,
      top: element.scrollTop,
    };
  }

  useEffect(() => {
    startTransition(() => {
      setInternalRows(rowData);
    });
  }, [rowData]);

  useEffect(() => {
    startTransition(() => {
      setInternalColumns(columnDefs);
    });
  }, [columnDefs]);

  useEffect(() => {
    setRowHeightState(rowHeight);
  }, [rowHeight]);

  const resolvedColumnDefs = resolveColumnDefs(internalColumns, defaultColDef, columnSizing);
  const tanStackColumns = buildTanStackColumns(resolvedColumnDefs);

  const table = useReactTable<TData>({
    data: internalRows,
    columns: tanStackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const { metrics: columnMetrics, totalWidth } = buildColumnMetrics(visibleColumns);

  stateRef.current = {
    rows,
    visibleColumns,
    columnMetrics,
    totalWidth,
    rowHeight: rowHeightState,
    headerHeight,
    overscanRows,
    overscanColumns,
    resolvedColumnDefs,
    theme,
  };

  function getState() {
    if (!stateRef.current) {
      throw new Error("CanvasGrid is not ready yet.");
    }
    return stateRef.current;
  }

  function paint() {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) {
      return;
    }

    const width = sizeRef.current.width || canvas.clientWidth || 1;
    const actualHeight = sizeRef.current.height || canvas.clientHeight || height;
    const context = ensureContext(canvas, width, actualHeight);
    const state = getState();

    const metrics = paintGrid({
      context,
      width,
      height: actualHeight,
      rows: state.rows,
      columns: state.visibleColumns,
      columnMetrics: state.columnMetrics,
      totalWidth: state.totalWidth,
      scrollLeft: scrollStateRef.current.left,
      scrollTop: scrollStateRef.current.top,
      rowHeight: state.rowHeight,
      headerHeight: state.headerHeight,
      overscanRows: state.overscanRows,
      overscanColumns: state.overscanColumns,
      theme: state.theme,
    });

    lastPaintRef.current = metrics;
    callbacksRef.current.onPaint?.(metrics);
  }

  function schedulePaint() {
    if (frameRef.current) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      paint();
    });
  }

  function paintAfterScroll(element: HTMLDivElement) {
    syncScrollFromElement(element);

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    paint();
  }

  if (!apiRef.current) {
    apiRef.current = {
      setRowData(nextRows) {
        startTransition(() => {
          setInternalRows(Array.isArray(nextRows) ? nextRows : []);
        });
      },
      setColumnDefs(nextColumnDefs) {
        startTransition(() => {
          setInternalColumns(Array.isArray(nextColumnDefs) ? nextColumnDefs : []);
        });
      },
      setGridOption(key: string, value: unknown) {
        if (key === "rowData") {
          this.setRowData(Array.isArray(value) ? (value as TData[]) : []);
          return;
        }
        if (key === "columnDefs") {
          this.setColumnDefs(Array.isArray(value) ? (value as GridColumnDef<TData>[]) : []);
          return;
        }
        if (key === "rowHeight" && typeof value === "number") {
          setRowHeightState(value);
        }
      },
      refreshCells() {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
        }
        paint();
      },
      sizeColumnsToFit() {
        const viewportWidth = sizeRef.current.width;
        setColumnSizing(fitColumnsToWidth(getState().resolvedColumnDefs, viewportWidth));
      },
      applyColumnState({ state }) {
        const nextSizing: Record<string, number> = {};
        let nextSorting: SortingState | null = null;

        state.forEach((entry) => {
          if (typeof entry.width === "number") {
            nextSizing[entry.colId] = entry.width;
          }
          if (entry.sort === "asc" || entry.sort === "desc") {
            nextSorting = [{ id: entry.colId, desc: entry.sort === "desc" }];
          }
        });

        if (Object.keys(nextSizing).length) {
          setColumnSizing((current) => ({ ...current, ...nextSizing }));
        }
        if (nextSorting) {
          setSorting(nextSorting);
        }
      },
      getDisplayedRowCount() {
        return getState().rows.length;
      },
      getVisibleColumns() {
        return getState().columnMetrics.map((metric) => ({
          colId: metric.id,
          headerName: metric.definition.headerName,
          width: metric.width,
        }));
      },
      getLastPaintMetrics() {
        return lastPaintRef.current;
      },
      forEachNode(callback) {
        getState().rows.forEach((row, rowIndex) => {
          callback({
            id: row.id,
            rowIndex,
            data: row.original,
          });
        });
      },
      runBenchmarks(options = {}) {
        const state = getState();
        return runGridBenchmarks({
          rows: state.rows,
          columns: state.visibleColumns,
          columnMetrics: state.columnMetrics,
          viewportWidth: sizeRef.current.width,
          viewportHeight: sizeRef.current.height,
          scrollLeft: scrollStateRef.current.left,
          scrollTop: scrollStateRef.current.top,
          rowHeight: state.rowHeight,
          headerHeight: state.headerHeight,
          overscanRows: state.overscanRows,
          overscanColumns: state.overscanColumns,
          theme: state.theme,
          iterations: options.iterations ?? 6,
        });
      },
    };

    columnApiRef.current = {
      getAllDisplayedColumns() {
        return apiRef.current?.getVisibleColumns() ?? [];
      },
    };
  }

  useImperativeHandle(ref, () => apiRef.current as CanvasGridApi<TData>, []);

  useLayoutEffect(() => {
    const element = shellRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      sizeRef.current = {
        width: element.clientWidth,
        height,
      };
      schedulePaint();
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [height]);

  useEffect(() => {
    schedulePaint();
  }, [
    internalRows,
    internalColumns,
    sorting,
    rowHeightState,
    headerHeight,
    overscanRows,
    overscanColumns,
    columnSizing,
    theme,
  ]);

  useEffect(() => {
    if (!readyRef.current && apiRef.current && columnApiRef.current) {
      readyRef.current = true;
      callbacksRef.current.onGridReady?.({
        api: apiRef.current,
        columnApi: columnApiRef.current,
      });
    }
  }, []);

  useEffect(() => {
    callbacksRef.current.onSortChanged?.(sorting);
  }, [sorting]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    paintAfterScroll(event.currentTarget);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const target = scrollRef.current;
    if (!target) {
      return;
    }

    const nextLeft = clampScroll(
      target.scrollLeft + event.deltaX,
      target.scrollWidth - target.clientWidth,
    );
    const nextTop = clampScroll(
      target.scrollTop + event.deltaY,
      target.scrollHeight - target.clientHeight,
    );

    if (nextLeft === target.scrollLeft && nextTop === target.scrollTop) {
      return;
    }

    event.preventDefault();
    target.scrollLeft = nextLeft;
    target.scrollTop = nextTop;
    paintAfterScroll(target);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const scrollElement = scrollRef.current;
    const state = stateRef.current;
    if (!scrollElement || !state) {
      return;
    }

    const bounds = scrollElement.getBoundingClientRect();
    const viewportX = event.clientX - bounds.left;
    const viewportY = event.clientY - bounds.top;
    const contentX = viewportX + scrollStateRef.current.left;

    const clickedMetric = state.columnMetrics.find(
      (metric) => contentX >= metric.x && contentX <= metric.x + metric.width,
    );

    if (!clickedMetric) {
      return;
    }

    if (viewportY <= state.headerHeight) {
      if (clickedMetric.column.getCanSort()) {
        setSorting((current) => cycleSorting(current, clickedMetric.column.id));
      }
      return;
    }

    const bodyOffset = scrollStateRef.current.top + viewportY - state.headerHeight;
    const rowIndex = Math.floor(bodyOffset / state.rowHeight);
    const row = state.rows[rowIndex];
    if (!row) {
      return;
    }

    callbacksRef.current.onCellClicked?.({
      rowIndex,
      column: clickedMetric.column,
      data: row.original,
      value: row.getValue(clickedMetric.column.id),
      colDef: clickedMetric.definition,
    });
  }

  const totalHeight = headerHeight + rows.length * rowHeightState;

  return (
    <div className="canvas-grid" ref={shellRef} style={{ height }}>
      <canvas className="canvas-grid__canvas" ref={canvasRef} />
      <div
        className="canvas-grid__scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onClick={handleClick}
        tabIndex={0}
      >
        <div
          className="canvas-grid__spacer"
          style={{
            width: Math.max(totalWidth, sizeRef.current.width || 0),
            height: Math.max(totalHeight, sizeRef.current.height || 0),
          }}
        />
      </div>
    </div>
  );
}

export const CanvasGrid = forwardRef(CanvasGridInner) as <TData extends RowData>(
  props: CanvasGridProps<TData> & {
    ref?: ForwardedRef<CanvasGridApi<TData>>;
  },
) => ReactElement;
