"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, DEFAULT_STATE, CashOperation } from "./types";
import { loadState, saveState, clearState } from "./store";
import { exportCSV } from "./csv";

type Screen = "lock" | "setup" | "main" | "settings";

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

  // 初期ロード
  useEffect(() => {
    const saved = loadState();
    setState(saved);
    if (saved.initialized) {
      setScreen("lock");
    } else {
      setScreen("setup");
    }
  }, []);

  // state変化時に保存
  useEffect(() => {
    if (state.initialized) {
      saveState(state);
    }
  }, [state]);

  // スペースキー販売
  const recordSale = useCallback(() => {
    setState((prev) => {
      const newSale = {
        id: prev.sales.length + 1,
        timestamp: new Date().toISOString(),
      };
      return { ...prev, sales: [...prev.sales, newSale] };
    });
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
    if (screen === "main" && mainRef.current) {
      mainRef.current.focus();
    }
  }, [screen]);

  // 金庫計算
  const totalAdd = state.cashOperations
    .filter((o) => o.type === "add")
    .reduce((s, o) => s + o.amount, 0);
  const totalRemove = state.cashOperations
    .filter((o) => o.type === "remove")
    .reduce((s, o) => s + o.amount, 0);
  const salesAmount = state.sales.length * state.drinkPrice;
  const vaultBalance =
    state.initialCash + salesAmount + totalAdd - totalRemove;

  // --- セットアップ ---
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

  // --- ロック解除 ---
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

  // --- 金銭操作 ---
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
    setState((prev) => ({
      ...prev,
      cashOperations: [...prev.cashOperations, op],
    }));
    setCashAmount("");
    setCashNote("");
  }

  // --- リセット ---
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
    setSetupForm({
      password: "",
      passwordConfirm: "",
      drinkPrice: "500",
      initialCash: "5000",
    });
    setSetupError("");
    setScreen("setup");
  }

  // --- 設定画面 ---
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
          <h1 className="text-2xl font-bold text-white text-center mb-6">
            🥤 初期設定
          </h1>
          <div className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-1 block">
                パスワード（4文字以上）
              </label>
              <input
                type="password"
                value={setupForm.password}
                onChange={(e) =>
                  setSetupForm((f) => ({ ...f, password: e.target.value }))
                }
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="パスワード"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">
                パスワード（確認）
              </label>
              <input
                type="password"
                value={setupForm.passwordConfirm}
                onChange={(e) =>
                  setSetupForm((f) => ({
                    ...f,
                    passwordConfirm: e.target.value,
                  }))
                }
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="パスワード（確認）"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">
                ドリンク単価（円）
              </label>
              <input
                type="number"
                value={setupForm.drinkPrice}
                onChange={(e) =>
                  setSetupForm((f) => ({ ...f, drinkPrice: e.target.value }))
                }
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">
                初期金庫金額（釣り銭）（円）
              </label>
              <input
                type="number"
                value={setupForm.initialCash}
                onChange={(e) =>
                  setSetupForm((f) => ({ ...f, initialCash: e.target.value }))
                }
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
            {setupError && (
              <p className="text-red-400 text-sm">{setupError}</p>
            )}
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
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            🥤 ドリンクカウンター
          </h1>
          <p className="text-gray-400 text-center text-sm mb-6">
            パスワードを入力してください
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••"
            autoFocus
          />
          {passwordError && (
            <p className="text-red-400 text-sm text-center mt-2">
              パスワードが違います
            </p>
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
          <h1 className="text-xl font-bold text-white text-center mb-6">
            ⚙️ 設定
          </h1>
          {!settingsUnlocked ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm text-center">
                設定変更にはパスワードが必要です
              </p>
              <input
                type="password"
                value={settingsPassword}
                onChange={(e) => {
                  setSettingsPassword(e.target.value);
                  setSettingsError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSettingsUnlock()}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="パスワード"
                autoFocus
              />
              {settingsError && (
                <p className="text-red-400 text-sm">{settingsError}</p>
              )}
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
                <label className="text-gray-300 text-sm mb-1 block">
                  ドリンク単価（円）
                </label>
                <p className="text-gray-500 text-xs mb-1">
                  現在: ¥{fmt(state.drinkPrice)}
                </p>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
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
            onClick={() => {
              setScreen("main");
              setSettingsUnlocked(false);
              setSettingsPassword("");
              setSettingsError("");
            }}
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
      {/* ヘッダー */}
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

      {/* 販売カウント */}
      <div
        className={`rounded-2xl p-8 text-center mb-4 transition-all duration-150 cursor-pointer select-none ${
          flashSale ? "bg-green-600 scale-105" : "bg-gray-800"
        }`}
        onClick={recordSale}
      >
        <p className="text-gray-400 text-sm mb-1">販売数</p>
        <p className="text-7xl font-black tabular-nums">
          {state.sales.length}
        </p>
        <p className="text-gray-400 text-sm mt-1">個</p>
        <p className="text-gray-500 text-xs mt-3">
          スペースキー または タップで記録
        </p>
      </div>

      {/* 金額カード */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">売上金額</p>
          <p className="text-2xl font-bold text-green-400">
            ¥{fmt(salesAmount)}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            @¥{fmt(state.drinkPrice)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">金庫残高</p>
          <p className="text-2xl font-bold text-yellow-400">
            ¥{fmt(vaultBalance)}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            初期¥{fmt(state.initialCash)}
          </p>
        </div>
      </div>

      {/* 補充・回収 */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">💴 おつり管理</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value.replace(/[^0-9]/g, ""))}
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
            {[...state.cashOperations]
              .reverse()
              .slice(0, 3)
              .map((op) => (
                <div
                  key={op.id}
                  className="flex justify-between text-xs text-gray-400"
                >
                  <span>
                    {op.type === "add" ? "▲補充" : "▼回収"} {op.note}
                  </span>
                  <span>¥{fmt(op.amount)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* アクション */}
      <div className="flex gap-3">
        <button
          onClick={() => exportCSV(state)}
          className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          📥 CSV書き出し
        </button>
        <button
          onClick={() => {
            setShowResetConfirm(true);
            setResetPasswordInput("");
            setResetError(false);
          }}
          className="bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
        >
          🗑 リセット
        </button>
      </div>

      {/* リセット確認モーダル */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-red-400 mb-2">
              ⚠️ 全データをリセット
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              販売履歴・金銭操作ログを全て削除します。
              <br />
              この操作は取り消せません。
              <br />
              パスワードを入力して確認してください。
            </p>
            <input
              type="password"
              value={resetPasswordInput}
              onChange={(e) => {
                setResetPasswordInput(e.target.value);
                setResetError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 mb-2"
              placeholder="パスワード"
              autoFocus
            />
            {resetError && (
              <p className="text-red-400 text-sm mb-2">パスワードが違います</p>
            )}
            <div className="flex gap-2">
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
