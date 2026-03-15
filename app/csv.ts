import { AppState, SaleRecord, CashOperation } from "./types";

export type ImportedData = {
  drinkPrice: number;
  initialCash: number;
  sales: SaleRecord[];
  cashOperations: CashOperation[];
};

export function parseImportCSV(content: string): ImportedData | null {
  const text = content.startsWith("\uFEFF") ? content.slice(1) : content;
  const lines = text.split(/\r?\n/);

  let section = "";
  let drinkPrice = 0;
  let initialCash = 0;
  const sales: SaleRecord[] = [];
  const cashOperations: CashOperation[] = [];
  let opId = 1;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === "=== サマリー ===") { section = "summary"; continue; }
    if (t === "=== 販売ログ ===") { section = "sales"; continue; }
    if (t === "=== 金銭操作ログ ===") { section = "cash"; continue; }

    if (section === "summary") {
      if (t.startsWith("単価,")) drinkPrice = parseInt(t.replace("単価,¥", ""));
      if (t.startsWith("初期金庫金額,")) initialCash = parseInt(t.replace("初期金庫金額,¥", ""));
    }

    if (section === "sales") {
      const idx = t.indexOf(",");
      if (idx === -1) continue;
      const id = parseInt(t.slice(0, idx));
      if (isNaN(id)) continue;
      const ts = parseDateStr(t.slice(idx + 1));
      if (ts) sales.push({ id, timestamp: ts });
    }

    if (section === "cash") {
      const m = t.match(/^(補充|回収),¥(\d+),"([^"]*)",(.+)$/);
      if (m) {
        const ts = parseDateStr(m[4]);
        cashOperations.push({
          id: opId++,
          type: m[1] === "補充" ? "add" : "remove",
          amount: parseInt(m[2]),
          note: m[3],
          timestamp: ts || new Date().toISOString(),
        });
      }
    }
  }

  if (drinkPrice <= 0) return null;
  return { drinkPrice, initialCash, sales, cashOperations };
}

function parseDateStr(s: string): string | null {
  const m = s.trim().match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
}

export function exportCSV(state: AppState): void {
  const rows: string[] = [];

  // ヘッダー
  rows.push("=== サマリー ===");
  rows.push(`単価,¥${state.drinkPrice}`);
  rows.push(`初期金庫金額,¥${state.initialCash}`);
  rows.push(`総販売数,${state.sales.length}個`);
  rows.push(`売上合計,¥${state.sales.length * state.drinkPrice}`);

  const cashInOps = state.cashOperations.filter((o) => o.type === "add");
  const cashOutOps = state.cashOperations.filter((o) => o.type === "remove");
  const totalAdd = cashInOps.reduce((s, o) => s + o.amount, 0);
  const totalRemove = cashOutOps.reduce((s, o) => s + o.amount, 0);
  const vaultBalance =
    state.initialCash +
    state.sales.length * state.drinkPrice +
    totalAdd -
    totalRemove;

  rows.push(`補充合計,¥${totalAdd}`);
  rows.push(`回収合計,¥${totalRemove}`);
  rows.push(`金庫残高,¥${vaultBalance}`);
  rows.push("");

  // 販売ログ
  rows.push("=== 販売ログ ===");
  rows.push("番号,日時");
  state.sales.forEach((s) => {
    const dt = new Date(s.timestamp);
    rows.push(`${s.id},${formatDate(dt)}`);
  });
  rows.push("");

  // 金銭操作ログ
  rows.push("=== 金銭操作ログ ===");
  rows.push("種別,金額,メモ,日時");
  state.cashOperations.forEach((o) => {
    const label = o.type === "add" ? "補充" : "回収";
    const dt = new Date(o.timestamp);
    rows.push(`${label},¥${o.amount},"${o.note}",${formatDate(dt)}`);
  });

  const bom = "\uFEFF";
  const blob = new Blob([bom + rows.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const now = formatDate(new Date()).replace(/[/:]/g, "-").replace(" ", "_");
  a.download = `drinks_${now}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
