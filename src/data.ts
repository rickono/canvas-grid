import type { CellRendererParams, GridColumnDef } from "./types";

const REGIONS = ["Americas", "EMEA", "APAC"] as const;
const DESKS = ["Delta One", "Flow Credit", "Macro", "Volatility", "Rates"] as const;
const TRADERS = [
  "A. Flores",
  "M. Stone",
  "K. Shah",
  "N. Rivera",
  "L. Chen",
  "T. Evans",
  "D. Park",
] as const;
const SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "TSLA",
  "AMZN",
  "META",
  "AMD",
  "NFLX",
  "CRM",
] as const;
const SIDES = ["Buy", "Sell"] as const;
const STATUSES = ["Open", "Working", "Hedged", "Review", "Closed"] as const;

export type Region = (typeof REGIONS)[number];
export type Desk = (typeof DESKS)[number];
export type Trader = (typeof TRADERS)[number];
export type Symbol = (typeof SYMBOLS)[number];
export type Side = (typeof SIDES)[number];
export type TradeStatus = (typeof STATUSES)[number];
export type GridProfile = "compact" | "balanced" | "stress";

export interface MarketRow {
  id: number;
  tradeId: string;
  trader: Trader;
  region: Region;
  desk: Desk;
  symbol: Symbol;
  side: Side;
  quantity: number;
  price: number;
  pnl: number;
  pnlPct: number;
  volatility: number;
  latencyMs: number;
  notional: number;
  status: TradeStatus;
  updatedAt: string;
  bucket: string;
  sparkline: number[];
}

export interface GridPreset {
  id: GridProfile;
  label: string;
  rowCount: number;
  profile: GridProfile;
  description: string;
  iterations: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const STATUS_COLORS: Record<TradeStatus, string> = {
  Open: "#f6d6ae",
  Working: "#c7e7ff",
  Hedged: "#b8e7c8",
  Review: "#f2c9f6",
  Closed: "#d8dbdf",
};

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function choose<const TList extends readonly string[]>(
  list: TList,
  index: number,
  salt: number,
): TList[number] {
  return list[Math.floor(seeded(index, salt) * list.length) % list.length];
}

function signedCurrency(value: number) {
  const formatted = currencyFormatter.format(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function buildSparkline(index: number) {
  return Array.from({ length: 10 }, (_, bar) => {
    const swing = seeded(index, bar + 11) * 1.8 - 0.9;
    return Math.round(swing * 100);
  });
}

function formatTimestamp(index: number) {
  const hour = 8 + Math.floor(seeded(index, 16) * 9);
  const minute = Math.floor(seeded(index, 18) * 60);
  const second = Math.floor(seeded(index, 19) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}:${String(second).padStart(2, "0")}`;
}

export function createMarketData(rowCount: number): MarketRow[] {
  return Array.from({ length: rowCount }, (_, index) => {
    const quantity = 25 + Math.floor(seeded(index, 3) * 9000);
    const price = 18 + seeded(index, 4) * 640;
    const pnl = (seeded(index, 5) - 0.48) * 160000;
    const volatility = 12 + seeded(index, 6) * 58;
    const latencyMs = 4 + Math.floor(seeded(index, 7) * 120);
    const notional = quantity * price;
    const pnlPct = (pnl / Math.max(1, notional)) * 100;

    return {
      id: index + 1,
      tradeId: `TRD-${String(index + 1).padStart(6, "0")}`,
      trader: choose(TRADERS, index, 1),
      region: choose(REGIONS, index, 2),
      desk: choose(DESKS, index, 8),
      symbol: choose(SYMBOLS, index, 9),
      side: choose(SIDES, index, 10),
      quantity,
      price,
      pnl,
      pnlPct,
      volatility,
      latencyMs,
      notional,
      status: choose(STATUSES, index, 12),
      updatedAt: formatTimestamp(index),
      bucket: `B${1 + (index % 8)}`,
      sparkline: buildSparkline(index),
    };
  });
}

function tradeIdRenderer({ value }: CellRendererParams<MarketRow>) {
  return {
    text: String(value),
    fillStyle: "#172033",
    font: '600 12px "IBM Plex Mono", monospace',
  };
}

function quantityRenderer({ value }: CellRendererParams<MarketRow>) {
  return {
    text: integerFormatter.format(Number(value)),
    fillStyle: "#172033",
    font: '500 12px "IBM Plex Mono", monospace',
    align: "right" as const,
  };
}

function priceRenderer({ value }: CellRendererParams<MarketRow>) {
  return {
    text: currencyFormatter.format(Number(value)),
    fillStyle: "#172033",
    font: '500 12px "IBM Plex Mono", monospace',
    align: "right" as const,
  };
}

function pnlRenderer({ value }: CellRendererParams<MarketRow>) {
  const numericValue = Number(value);
  return {
    text: signedCurrency(numericValue),
    fillStyle: numericValue >= 0 ? "#0c7a43" : "#b42318",
    font: '600 12px "IBM Plex Mono", monospace',
    align: "right" as const,
  };
}

function percentRenderer({ value }: CellRendererParams<MarketRow>) {
  const numericValue = Number(value);
  return {
    text: `${numericValue >= 0 ? "+" : ""}${percentFormatter.format(numericValue)}%`,
    fillStyle: numericValue >= 0 ? "#0c7a43" : "#b42318",
    font: '600 12px "IBM Plex Mono", monospace',
    align: "right" as const,
  };
}

function statusRenderer({ value }: CellRendererParams<MarketRow>) {
  const status = value as TradeStatus;
  return {
    type: "badge" as const,
    text: status,
    fillStyle: "#172033",
    backgroundColor: STATUS_COLORS[status] ?? "#e6e8eb",
    strokeStyle: "rgba(23, 32, 51, 0.16)",
  };
}

function latencyRenderer({ value }: CellRendererParams<MarketRow>) {
  const numericValue = Number(value);
  return {
    type: "heat" as const,
    text: `${numericValue} ms`,
    intensity: Math.min(1, numericValue / 120),
    fillStyle: numericValue < 35 ? "#0c7a43" : numericValue < 80 ? "#172033" : "#b42318",
    align: "right" as const,
  };
}

function sparklineRenderer({ data }: CellRendererParams<MarketRow>) {
  return {
    type: "sparkbars" as const,
    values: data.sparkline,
    positiveColor: "#0c7a43",
    negativeColor: "#c55f14",
    text: `${data.sparkline[data.sparkline.length - 1]} bps`,
    fillStyle: "#172033",
  };
}

export function createColumnDefs(profile: GridProfile = "balanced"): GridColumnDef<MarketRow>[] {
  const base: GridColumnDef<MarketRow>[] = [
    {
      field: "tradeId",
      headerName: "Trade ID",
      width: 112,
      sortable: true,
      cellRenderer: tradeIdRenderer,
    },
    { field: "trader", headerName: "Trader", width: 132, sortable: true },
    { field: "region", headerName: "Region", width: 108, sortable: true },
    { field: "desk", headerName: "Desk", width: 136, sortable: true },
    { field: "symbol", headerName: "Symbol", width: 108, sortable: true },
    { field: "side", headerName: "Side", width: 82, sortable: true },
    {
      field: "quantity",
      headerName: "Qty",
      width: 110,
      sortable: true,
      align: "right",
      cellRenderer: quantityRenderer,
    },
    {
      field: "price",
      headerName: "Price",
      width: 118,
      sortable: true,
      align: "right",
      cellRenderer: priceRenderer,
    },
    {
      colId: "notional",
      headerName: "Notional",
      width: 132,
      sortable: true,
      align: "right",
      valueGetter: ({ data }) => data.notional,
      valueFormatter: ({ value }) => currencyFormatter.format(Number(value)),
    },
    {
      field: "pnl",
      headerName: "P&L",
      width: 126,
      sortable: true,
      align: "right",
      cellRenderer: pnlRenderer,
    },
    {
      field: "pnlPct",
      headerName: "P&L %",
      width: 112,
      sortable: true,
      align: "right",
      cellRenderer: percentRenderer,
    },
  ];

  if (profile === "compact") {
    return base;
  }

  const heavy: GridColumnDef<MarketRow>[] = [
    {
      field: "status",
      headerName: "Status",
      width: 112,
      sortable: true,
      cellRenderer: statusRenderer,
    },
    {
      field: "latencyMs",
      headerName: "Latency",
      width: 116,
      sortable: true,
      align: "right",
      cellRenderer: latencyRenderer,
    },
    {
      field: "volatility",
      headerName: "Vol",
      width: 104,
      sortable: true,
      align: "right",
      valueFormatter: ({ value }) => `${decimalFormatter.format(Number(value))}%`,
    },
    { field: "bucket", headerName: "Bucket", width: 96, sortable: true },
    { field: "updatedAt", headerName: "Updated", width: 104, sortable: true },
    {
      field: "sparkline",
      headerName: "Micro Trend",
      width: 164,
      sortable: false,
      cellRenderer: sparklineRenderer,
    },
  ];

  if (profile === "balanced") {
    return [...base, ...heavy];
  }

  return [
    ...base,
    ...heavy,
    {
      colId: "stressScore",
      headerName: "Stress",
      width: 118,
      sortable: true,
      align: "right",
      valueGetter: ({ data }) => data.latencyMs * (data.volatility / 18),
      valueFormatter: ({ value }) => decimalFormatter.format(Number(value)),
    },
    {
      colId: "inventoryTurn",
      headerName: "Turn",
      width: 108,
      sortable: true,
      align: "right",
      valueGetter: ({ data }) => data.quantity / Math.max(1, data.volatility),
      valueFormatter: ({ value }) => decimalFormatter.format(Number(value)),
    },
  ];
}

export const GRID_PRESETS: GridPreset[] = [
  {
    id: "compact",
    label: "2k compact",
    rowCount: 2000,
    profile: "compact",
    description: "Fast baseline with mostly formatted text cells.",
    iterations: 10,
  },
  {
    id: "balanced",
    label: "10k balanced",
    rowCount: 10000,
    profile: "balanced",
    description: "A realistic mixed workload with badges and sparklines.",
    iterations: 7,
  },
  {
    id: "stress",
    label: "50k stress",
    rowCount: 50000,
    profile: "stress",
    description: "Stress pass for renderer-heavy scenarios across a large body.",
    iterations: 4,
  },
];
