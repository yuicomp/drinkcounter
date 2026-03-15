"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, DEFAULT_STATE, CashOperation } from "./types";
import { loadState, saveState, clearState } from "./store";
import { exportCSV } from "./csv";

type Screen = "lock" | "setup" | "main" | "settings";

function numericOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

// 表示/非表示トグル付きパスワード入力
function PasswordInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "パスワード",
  className = "",
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={`w-full bg-gray-700 text-white rounded-lg px-4 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white select-none"
        tabIndex={-1}
      >
        {show ? "隠す" : "表示"}
      </button>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [screen, setScreen] = useState<Screen>("lock");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [flashSale, setFlashSale] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetError, setResetError] = useState(false);
  const [setupForm, setSetupForm] = useState({
    password: "",
    passwordConfirm: "",
    drinkPrice: "500",
    initialCash: "5000",
  });
  const [setupError, setSetupError] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadState();
    setState(saved);
    setScreen(saved.initialized ? "lock" : "setup");
  }, []);

  useEffect(() => {
    if (state.initialized) saveState(state);
  }, [state]);

  const recordSale = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sales: [
        ...prev.sales,
        { id: prev.sales.length + 1, timestamp: new Date().toISOString() },
      ],
    }));
    setFlashSale(true);
    setTimeout(() => setFlashSale(false), 300);
  }, []);

  useEffect(() => {
    if (screen !== "main") return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        recordSale();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, recordSale]);

  useEffect(() => {
    if (screen === "main") mainRef.current?.focus();
  }, [screen]);

  const totalAdd = state.cashOperations
    .filter((o) => o.type === "add")
    .reduce((s, o) => s + o.amount, 0);
  const totalRemove = state.cashOperations
    .filter((o) => o.type === "remove")
    .reduce((s, o) => s + o.amount, 0);
  const salesAmount = state.sales.length * state.drinkPrice;
  const vaultBalance = state.initialCash + salesAmount + totalAdd - totalRemove;

  function handleSetup() {
    const { password, passwordConfirm, drinkPrice, initialCash } = setupForm;
    if (password.length < 4) {
      setSetupError("パスワードは4文字以上で設定してください");
      return;
    }
    if (password !== passwordConfirm) {
      setSetupError("パスワードが一致しません");
      return;
    }
    const price = parseInt(drinkPrice);
    const cash = parseInt(initialCash);
    if (isNaN(price) || price <= 0) {
      setSetupError("単価を正しく入力してください");
      return;
    }
    if (isNaN(cash) || cash < 0) {
      setSetupError("初期金庫金額を正しく入力してください");
      return;
    }
    const newState: AppState = {
      initialized: true,
      password,
      drinkPrice: price,
      initialCash: cash,
      sales: [],
      cashOperations: [],
    };
    saveState(newState);
    setState(newState);
    setScreen("main");
  }

  function handleUnlock() {
    if (passwordInput === state.password) {
      setPasswordError(false);
      setPasswordInput("");
      setScreen("main");
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
  }

  function handleCashOp(type: "add" | "remove") {
    const amount = parseInt(cashAmount);
    if (isNaN(amount) || amount <= 0) return;
    const op: CashOperation = {
      id: Date.now(),
      type,
      amount,
      note: cashNote || (type === "add" ? "補充" : "回収"),
      timestamp: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, cashOperations: [...prev.cashOperations, op] }));
    setCashAmount("");
    setCashNote("");
  }

  function handleReset() {
    if (resetPasswordInput !== state.password) {
      setResetError(true);
      setResetPasswordInput("");
      return;
    }
    clearState();
    setState(DEFAULT_STATE);
    setShowResetConfirm(false);
    setResetPasswordInput("");
    setResetError(false);
    setSetupForm({ password: "", passwordConfirm: "", drinkPrice: "500", initialCash: "5000" });
    setSetupError("");
    setScreen("setup");
  }

  function handleSettingsUnlock() {
    if (settingsPassword === state.password) {
      setSettingsUnlocked(true);
      setSettingsError("");
      setNewPrice(String(state.drinkPrice));
    } else {
      setSettingsError("パスワードが違います");
    }
    setSettingsPassword("");
  }

  function handlePriceUpdate() {
    const price = parseInt(newPrice);
    if (isNaN(price) || price <= 0) return;
    setState((prev) => ({ ...prev, drinkPrice: price }));
    setScreen("main");
    setSettingsUnlocked(false);
  }

  const fmt = (n: number) => n.toLocaleString("ja-JP");

  // ==================== RENDER ====================

  if (screen === "setup") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-bold text-white text-center mb-6">🥤 初期設定</h1>
          <div className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-1 block">パスワード（4文字以上）</label>
              <PasswordInput
                value={setupForm.password}
                onChange={(v) => setSetupForm((f) => ({ ...f, password: v }))}
                placeholder="パスワード"
                autoFocus
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">パスワード（確認）</label>
              <PasswordInput
                value={setupForm.passwordConfirm}
                onChange={(v) => setSetupForm((f) => ({ ...f, passwordConfirm: v }))}
                placeholder="パスワード（確認）"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">ドリンク単価（円）</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={setupForm.drinkPrice}
                onChange={(e) =>
                  setSetupForm((f) => ({ ...f, drinkPrice: numericOnly(e.target.value) }))
                }
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">初期金庫金額（釣り銭）（円）</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={setupForm.initialCash}
                onChange={(e) =>
                  setSetupForm((f) => ({ ...f, initialCash: numericOnly(e.target.value) }))
                }
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {setupError && <p className="text-red-400 text-sm">{setupError}</p>}
            <button
              onClick={handleSetup}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
            >
              開始する
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "lock") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <h1 className="text-2xl font-bold text-white text-center mb-2">🥤 ドリンクカウンター</h1>
          <p className="text-gray-400 text-center text-sm mb-6">パスワードを入力してください</p>
          <PasswordInput
            value={passwordInput}
            onChange={(v) => { setPasswordInput(v); setPasswordError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="パスワード"
            className="text-center tracking-widest text-xl py-3"
            autoFocus
          />
          {passwordError && (
            <p className="text-red-400 text-sm text-center mt-2">パスワードが違います</p>
          )}
          <button
            onClick={handleUnlock}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
          >
            ロック解除
          </button>
        </div>
      </div>
    );
  }

  if (screen === "settings") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <h1 className="text-xl font-bold text-white text-center mb-6">⚙️ 設定</h1>
          {!settingsUnlocked ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm text-center">設定変更にはパスワードが必要です</p>
              <PasswordInput
                value={settingsPassword}
                onChange={(v) => { setSettingsPassword(v); setSettingsError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSettingsUnlock()}
                autoFocus
              />
              {settingsError && <p className="text-red-400 text-sm">{settingsError}</p>}
              <button
                onClick={handleSettingsUnlock}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors"
              >
                確認
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm mb-1 block">ドリンク単価（円）</label>
                <p className="text-gray-500 text-xs mb-1">現在: ¥{fmt(state.drinkPrice)}</p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newPrice}
                  onChange={(e) => setNewPrice(numericOnly(e.target.value))}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <button
                onClick={handlePriceUpdate}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition-colors"
              >
                保存
              </button>
            </div>
          )}
          <button
            onClick={() => { setScreen("main"); setSettingsUnlocked(false); setSettingsPassword(""); setSettingsError(""); }}
            className="w-full mt-3 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 rounded-lg transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // メイン画面
  return (
    <div
      ref={mainRef}
      tabIndex={0}
      className="min-h-screen bg-gray-900 text-white p-4 outline-none"
      onClick={() => mainRef.current?.focus()}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🥤 ドリンクカウンター</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setScreen("settings")}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm transition-colors"
          >
            ⚙️ 設定
          </button>
          <button
            onClick={() => setScreen("lock")}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm transition-colors"
          >
            🔒 ロック
          </button>
        </div>
      </div>

      <div
        className={`rounded-2xl p-8 text-center mb-4 transition-all duration-150 cursor-pointer select-none ${
          flashSale ? "bg-green-600 scale-105" : "bg-gray-800"
        }`}
        onClick={recordSale}
      >
        <p className="text-gray-400 text-sm mb-1">販売数</p>
        <p className="text-7xl font-black tabular-nums">{state.sales.length}</p>
        <p className="text-gray-400 text-sm mt-1">個</p>
        <p className="text-gray-500 text-xs mt-3">スペースキー または タップで記録</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">売上金額</p>
          <p className="text-2xl font-bold text-green-400">¥{fmt(salesAmount)}</p>
          <p className="text-gray-500 text-xs mt-1">@¥{fmt(state.drinkPrice)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">金庫残高</p>
          <p className="text-2xl font-bold text-yellow-400">¥{fmt(vaultBalance)}</p>
          <p className="text-gray-500 text-xs mt-1">初期¥{fmt(state.initialCash)}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">💴 おつり管理</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={cashAmount}
            onChange={(e) => setCashAmount(numericOnly(e.target.value))}
            className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="金額（円）"
            onKeyDown={(e) => e.key === "Space" && e.stopPropagation()}
          />
          <input
            type="text"
            value={cashNote}
            onChange={(e) => setCashNote(e.target.value)}
            className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="メモ（任意）"
            onKeyDown={(e) => e.key === "Space" && e.stopPropagation()}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleCashOp("add")}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
          >
            ＋ 補充
          </button>
          <button
            onClick={() => handleCashOp("remove")}
            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
          >
            － 回収
          </button>
        </div>
        {state.cashOperations.length > 0 && (
          <div className="mt-3 space-y-1">
            {[...state.cashOperations].reverse().slice(0, 3).map((op) => (
              <div key={op.id} className="flex justify-between text-xs text-gray-400">
                <span>{op.type === "add" ? "▲補充" : "▼回収"} {op.note}</span>
                <span>¥{fmt(op.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => exportCSV(state)}
          className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          📥 CSV書き出し
        </button>
        <button
          onClick={() => { setShowResetConfirm(true); setResetPasswordInput(""); setResetError(false); }}
          className="bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
        >
          🗑 リセット
        </button>
      </div>

      {/* 時間帯別集計 */}
      {state.sales.length > 0 && (() => {
        const byHour: Record<number, number> = {};
        state.sales.forEach((s) => {
          const h = new Date(s.timestamp).getHours();
          byHour[h] = (byHour[h] ?? 0) + 1;
        });
        const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b);
        return (
          <div className="bg-gray-800 rounded-xl p-4 mt-4">
            <h2 className="text-sm font-bold text-gray-300 mb-2">🕐 時間帯別</h2>
            <div className="space-y-1">
              {hours.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-12 shrink-0">{h}時台</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(byHour[h] / state.sales.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-white text-xs font-bold w-8 text-right shrink-0">
                    {byHour[h]}本
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 全販売ログ */}
      {state.sales.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 mt-4 mb-4">
          <h2 className="text-sm font-bold text-gray-300 mb-2">
            📋 全ログ（{state.sales.length}件）
          </h2>
          <div className="h-40 overflow-y-auto space-y-1 pr-1">
            {[...state.sales].reverse().map((s) => {
              const d = new Date(s.timestamp);
              const pad = (n: number) => String(n).padStart(2, "0");
              const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
              return (
                <div key={s.id} className="flex justify-between text-xs text-gray-400 py-0.5 border-b border-gray-700">
                  <span className="text-gray-500">#{s.id}</span>
                  <span>{time}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-red-400 mb-2">⚠️ 全データをリセット</h2>
            <p className="text-gray-400 text-sm mb-4">
              販売履歴・金銭操作ログを全て削除します。<br />
              この操作は取り消せません。<br />
              パスワードを入力して確認してください。
            </p>
            <PasswordInput
              value={resetPasswordInput}
              onChange={(v) => { setResetPasswordInput(v); setResetError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
              autoFocus
              className="mb-2"
            />
            {resetError && <p className="text-red-400 text-sm mb-2">パスワードが違います</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg transition-colors"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
