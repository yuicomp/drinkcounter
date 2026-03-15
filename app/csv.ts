import { AppState } from "./types";

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
