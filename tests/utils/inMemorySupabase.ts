type TableName =
  | "AuctionSession"
  | "Player"
  | "Team"
  | "Transaction"
  | "AuctionActionHistory";

type GenericRow = Record<string, unknown>;

type DatabaseState = {
  AuctionSession: GenericRow[];
  Player: GenericRow[];
  Team: GenericRow[];
  Transaction: GenericRow[];
  AuctionActionHistory: GenericRow[];
};

type QueryFilter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "neq"; column: string; value: unknown }
  | { kind: "in"; column: string; values: unknown[] };

type OrderSpec = {
  column: string;
  ascending: boolean;
};

type SelectOptions = {
  count?: "exact";
  head?: boolean;
};

function cloneRow<T>(value: T): T {
  return structuredClone(value);
}

function createDefaultState(): DatabaseState {
  return {
    AuctionSession: [],
    Player: [],
    Team: [],
    Transaction: [],
    AuctionActionHistory: [],
  };
}

function applyProjection(row: GenericRow, columns: string): GenericRow {
  const normalized = columns.trim();
  if (
    !normalized ||
    normalized === "*" ||
    normalized.includes("(") ||
    normalized.includes(":")
  ) {
    return cloneRow(row);
  }

  const keys = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const projected: GenericRow = {};
  for (const key of keys) {
    projected[key] = row[key];
  }
  return projected;
}

class InMemoryQueryBuilder {
  private action: "select" | "update" | "insert" | "delete" = "select";
  private selectColumns = "*";
  private selectOptions: SelectOptions = {};
  private returningColumns: string | null = null;
  private filters: QueryFilter[] = [];
  private orderSpecs: OrderSpec[] = [];
  private rowLimit: number | null = null;
  private payload: GenericRow | GenericRow[] | null = null;

  constructor(
    private readonly state: DatabaseState,
    private readonly table: TableName,
  ) {}

  select(columns = "*", options?: SelectOptions) {
    if (
      this.action === "insert" ||
      this.action === "update" ||
      this.action === "delete"
    ) {
      this.returningColumns = columns;
      return this;
    }

    this.action = "select";
    this.selectColumns = columns;
    this.selectOptions = options ?? {};
    return this;
  }

  insert(payload: GenericRow | GenericRow[]) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: GenericRow) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    this.payload = null;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ kind: "neq", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ kind: "in", column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderSpecs.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  limit(limit: number) {
    this.rowLimit = limit;
    return this;
  }

  maybeSingle() {
    return this.execute({ single: "maybe" });
  }

  single() {
    return this.execute({ single: "strict" });
  }

  // biome-ignore lint/suspicious/noThenProperty: This builder intentionally mimics Supabase's thenable query interface.
  then<
    TResult1 = {
      data: unknown;
      error: unknown;
      count?: number;
    },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: unknown;
          count?: number;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute({ single: "none" }).then(onfulfilled, onrejected);
  }

  private execute(options: { single: "none" | "maybe" | "strict" }) {
    switch (this.action) {
      case "select":
        return Promise.resolve(this.executeSelect(options.single));
      case "insert":
        return Promise.resolve(this.executeInsert(options.single));
      case "update":
        return Promise.resolve(this.executeUpdate(options.single));
      case "delete":
        return Promise.resolve(this.executeDelete(options.single));
      default:
        return Promise.resolve({ data: null, error: null });
    }
  }

  private getTableRows() {
    return this.state[this.table];
  }

  private filterRows(rows: GenericRow[]) {
    return rows.filter((row) => {
      for (const filter of this.filters) {
        if (filter.kind === "eq" && row[filter.column] !== filter.value) {
          return false;
        }
        if (filter.kind === "neq" && row[filter.column] === filter.value) {
          return false;
        }
        if (
          filter.kind === "in" &&
          !filter.values.includes(row[filter.column])
        ) {
          return false;
        }
      }
      return true;
    });
  }

  private sortRows(rows: GenericRow[]) {
    let sorted = [...rows];
    for (const orderSpec of this.orderSpecs) {
      sorted = sorted.sort((a, b) => {
        const av = a[orderSpec.column];
        const bv = b[orderSpec.column];

        if (av === bv) return 0;

        if (av === undefined || av === null)
          return orderSpec.ascending ? 1 : -1;
        if (bv === undefined || bv === null)
          return orderSpec.ascending ? -1 : 1;

        if (typeof av === "number" && typeof bv === "number") {
          return orderSpec.ascending ? av - bv : bv - av;
        }

        const as = String(av);
        const bs = String(bv);
        return orderSpec.ascending
          ? as.localeCompare(bs)
          : bs.localeCompare(as);
      });
    }

    if (typeof this.rowLimit === "number") {
      sorted = sorted.slice(0, this.rowLimit);
    }

    return sorted;
  }

  private projectRows(rows: GenericRow[], columns: string) {
    return rows.map((row) => applyProjection(row, columns));
  }

  private asSingleResult(rows: GenericRow[], mode: "maybe" | "strict") {
    if (rows.length === 0) {
      if (mode === "strict") {
        return {
          data: null,
          error: { message: "Expected a single row but found none" },
        };
      }

      return { data: null, error: null };
    }

    if (rows.length > 1) {
      return {
        data: null,
        error: { message: "Expected a single row but found multiple" },
      };
    }

    return {
      data: cloneRow(rows[0]),
      error: null,
    };
  }

  private executeSelect(mode: "none" | "maybe" | "strict") {
    const matched = this.sortRows(this.filterRows(this.getTableRows()));

    if (this.selectOptions.head) {
      return {
        data: null,
        error: null,
        count: matched.length,
      };
    }

    const projected = this.projectRows(matched, this.selectColumns);

    if (mode === "none") {
      return {
        data: projected.map((row) => cloneRow(row)),
        error: null,
      };
    }

    return this.asSingleResult(projected, mode);
  }

  private executeInsert(mode: "none" | "maybe" | "strict") {
    const rows = this.getTableRows();
    const input = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted = input.map((entry) => cloneRow(entry ?? {}));

    for (const row of inserted) {
      rows.push(row);
    }

    if (!this.returningColumns) {
      return {
        data: null,
        error: null,
      };
    }

    const projected = this.projectRows(inserted, this.returningColumns);
    if (mode === "none") {
      return { data: projected, error: null };
    }

    return this.asSingleResult(projected, mode);
  }

  private executeUpdate(mode: "none" | "maybe" | "strict") {
    const rows = this.getTableRows();
    const payload = (this.payload ?? {}) as GenericRow;

    const matched = this.filterRows(rows);

    for (const row of matched) {
      Object.assign(row, payload);
      if ("updatedAt" in row && !("updatedAt" in payload)) {
        row.updatedAt = new Date().toISOString();
      }
    }

    if (!this.returningColumns) {
      return {
        data: null,
        error: null,
      };
    }

    const projected = this.projectRows(matched, this.returningColumns);

    if (mode === "none") {
      return { data: projected, error: null };
    }

    return this.asSingleResult(projected, mode);
  }

  private executeDelete(mode: "none" | "maybe" | "strict") {
    const rows = this.getTableRows();
    const remaining: GenericRow[] = [];
    const removed: GenericRow[] = [];

    for (const row of rows) {
      const shouldDelete = this.filterRows([row]).length > 0;
      if (shouldDelete) {
        removed.push(row);
      } else {
        remaining.push(row);
      }
    }

    this.state[this.table] = remaining;

    if (!this.returningColumns) {
      return {
        data: null,
        error: null,
      };
    }

    const projected = this.projectRows(removed, this.returningColumns);

    if (mode === "none") {
      return { data: projected, error: null };
    }

    return this.asSingleResult(projected, mode);
  }
}

export type InMemorySupabaseClient = {
  from: (table: TableName) => InMemoryQueryBuilder;
  state: DatabaseState;
};

export function createInMemorySupabase(
  initialState?: Partial<DatabaseState>,
): InMemorySupabaseClient {
  const state: DatabaseState = {
    ...createDefaultState(),
    ...initialState,
    AuctionSession: cloneRow(initialState?.AuctionSession ?? []),
    Player: cloneRow(initialState?.Player ?? []),
    Team: cloneRow(initialState?.Team ?? []),
    Transaction: cloneRow(initialState?.Transaction ?? []),
    AuctionActionHistory: cloneRow(initialState?.AuctionActionHistory ?? []),
  };

  return {
    state,
    from(table: TableName) {
      return new InMemoryQueryBuilder(state, table);
    },
  };
}

export function buildActiveSession(overrides?: Partial<GenericRow>) {
  return {
    id: "session-1",
    name: "IUFL 2026",
    isActive: true,
    totalPoints: 1000,
    unsoldIterationRound: 1,
    unsoldIterationAnchorPlayerId: null,
    restartAckRequired: false,
    isAuctionEnded: false,
    auctionEndReason: null,
    endedAt: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

export function buildPlayer(overrides?: Partial<GenericRow>) {
  return {
    id: `player-${Math.random().toString(16).slice(2)}`,
    name: "Test Player",
    position1: "GK",
    position2: null,
    year: null,
    imageUrl: null,
    basePrice: 10,
    status: "UNSOLD",
    teamId: null,
    sessionId: "session-1",
    whatsappNumber: null,
    stream: "",
    importOrder: 0,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

export function buildTeam(overrides?: Partial<GenericRow>) {
  return {
    id: `team-${Math.random().toString(16).slice(2)}`,
    name: "Test Team",
    shortCode: "TST",
    domain: "example.com",
    pointsTotal: 1000,
    pointsSpent: 0,
    sessionId: "session-1",
    createdAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

export function buildTransaction(overrides?: Partial<GenericRow>) {
  return {
    id: `tx-${Math.random().toString(16).slice(2)}`,
    playerId: "player-1",
    teamId: "team-1",
    amount: 10,
    sessionId: "session-1",
    createdAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

export function buildActionHistory(overrides?: Partial<GenericRow>) {
  return {
    id: `hist-${Math.random().toString(16).slice(2)}`,
    sessionId: "session-1",
    fromPlayerId: "player-1",
    toPlayerId: "player-2",
    actionType: "PASS",
    transactionId: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}
