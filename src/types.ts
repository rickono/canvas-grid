import type { Column, Row, SortingState } from "@tanstack/react-table";

export type TextAlign = "left" | "right" | "center";
export type CellDrawType = "text" | "badge" | "heat" | "sparkbars";

export interface ValueGetterParams<TData> {
  data: TData;
  colDef: GridColumnDef<TData>;
  field?: keyof TData & string;
}

export interface ValueFormatterParams<TData> {
  value: unknown;
  data: TData;
  rowIndex: number;
  column: Column<TData, unknown>;
  colDef: ResolvedColumnDef<TData>;
}

export interface CellRendererParams<TData> extends ValueFormatterParams<TData> {
  columnIndex: number;
  formattedValue: unknown;
}

export interface CellDrawSpec {
  type?: CellDrawType;
  text?: string | number;
  align?: TextAlign;
  fillStyle?: string;
  backgroundColor?: string;
  strokeStyle?: string;
  font?: string;
  values?: number[];
  intensity?: number;
  positiveColor?: string;
  negativeColor?: string;
}

export type CellRenderer<TData> = (
  params: CellRendererParams<TData>,
) => CellDrawSpec | string | number | null | undefined;

export interface GridColumnDef<TData> {
  field?: keyof TData & string;
  colId?: string;
  headerName?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  align?: TextAlign;
  type?: "numericColumn" | string;
  numeric?: boolean;
  accessorFn?: (row: TData) => unknown;
  valueGetter?: (params: ValueGetterParams<TData>) => unknown;
  valueFormatter?: (params: ValueFormatterParams<TData>) => string | number;
  cellRenderer?: CellRenderer<TData>;
}

export interface ResolvedColumnDef<TData> extends GridColumnDef<TData> {
  id: string;
  headerName: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  align: TextAlign;
  sortable: boolean;
}

export interface ColumnMetric<TData> {
  id: string;
  x: number;
  width: number;
  definition: ResolvedColumnDef<TData>;
  column: Column<TData, unknown>;
}

export interface PaintMetrics {
  durationMs: number;
  paintedCellCount: number;
  renderCalls: number;
  visibleRowCount: number;
  visibleColumnCount: number;
  totalWidth: number;
  totalHeight: number;
}

export interface BenchmarkResult {
  label: string;
  cellCount: number;
  cellsPerSecond: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

export interface ColumnState {
  colId: string;
  width?: number;
  sort?: "asc" | "desc" | null;
}

export interface VisibleColumnState {
  colId: string;
  headerName: string;
  width: number;
}

export interface GridNode<TData> {
  id: string;
  rowIndex: number;
  data: TData;
}

export interface CanvasGridApi<TData> {
  setRowData(nextRows: TData[]): void;
  setColumnDefs(nextColumnDefs: GridColumnDef<TData>[]): void;
  setGridOption(key: "rowData", value: TData[]): void;
  setGridOption(key: "columnDefs", value: GridColumnDef<TData>[]): void;
  setGridOption(key: "rowHeight", value: number): void;
  setGridOption(key: string, value: unknown): void;
  refreshCells(): void;
  sizeColumnsToFit(): void;
  applyColumnState(params: { state: ColumnState[] }): void;
  getDisplayedRowCount(): number;
  getVisibleColumns(): VisibleColumnState[];
  getLastPaintMetrics(): PaintMetrics | null;
  forEachNode(callback: (node: GridNode<TData>) => void): void;
  runBenchmarks(options?: { iterations?: number }): BenchmarkResult[];
}

export interface CanvasGridColumnApi {
  getAllDisplayedColumns(): VisibleColumnState[];
}

export interface GridReadyEvent<TData> {
  api: CanvasGridApi<TData>;
  columnApi: CanvasGridColumnApi;
}

export interface CellClickedEvent<TData> {
  rowIndex: number;
  column: Column<TData, unknown>;
  data: TData;
  value: unknown;
  colDef: ResolvedColumnDef<TData>;
}

export interface GridTheme {
  background: string;
  rowOdd: string;
  rowEven: string;
  headerBackground: string;
  headerText: string;
  text: string;
  mutedText: string;
  gridLine: string;
  border: string;
  shadow: string;
}

export interface RuntimeGridState<TData> {
  rows: Row<TData>[];
  visibleColumns: Column<TData, unknown>[];
  columnMetrics: ColumnMetric<TData>[];
  totalWidth: number;
  rowHeight: number;
  headerHeight: number;
  overscanRows: number;
  overscanColumns: number;
  resolvedColumnDefs: ResolvedColumnDef<TData>[];
  theme: GridTheme;
}

export interface CanvasGridProps<TData> {
  rowData: TData[];
  columnDefs: GridColumnDef<TData>[];
  defaultColDef?: Partial<GridColumnDef<TData>>;
  rowHeight?: number;
  headerHeight?: number;
  overscanRows?: number;
  overscanColumns?: number;
  theme?: GridTheme;
  height?: number;
  onGridReady?: (event: GridReadyEvent<TData>) => void;
  onCellClicked?: (event: CellClickedEvent<TData>) => void;
  onSortChanged?: (sorting: SortingState) => void;
  onPaint?: (metrics: PaintMetrics) => void;
}
