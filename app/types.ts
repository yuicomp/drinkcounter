export type SaleRecord = {
  id: number;
  timestamp: string; // ISO string
};

export type CashOperation = {
  id: number;
  type: "add" | "remove"; // 補充 | 回収
  amount: number;
  note: string;
  timestamp: string;
};

export type AppState = {
  initialized: boolean;
  password: string;
  drinkPrice: number;
  initialCash: number;
  sales: SaleRecord[];
  cashOperations: CashOperation[];
};

export const DEFAULT_STATE: AppState = {
  initialized: false,
  password: "",
  drinkPrice: 500,
  initialCash: 0,
  sales: [],
  cashOperations: [],
};
