import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { 
  UserIdentity,
  serializeIdentity,
  deserializeIdentity,
  encryptData
} from "./lib/crypto";
import { Transaction, User, TransactionInput } from "./types";
import { decryptUserBalance, decryptTransactions, encryptTransactionData, sanitizeString, validateAmount } from "./utils";
import { Auth } from "./components/Auth";
import { AddTransactionModal } from "./components/AddTransactionModal";
import { TransactionDetailModal } from "./components/TransactionDetailModal";
import { DashboardShell } from "./components/DashboardShell";
let HomeView = lazy(() => import("./views/HomeView"));
let ListView = lazy(() => import("./views/ListView"));
let StatisticsView = lazy(() => import("./views/StatisticsView"));
let SettingsView = lazy(() => import("./views/SettingsView"));
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.category_name))).sort();
  }, [transactions]);
  const fetchData = useCallback(async () => {
    if (!token || !identity) {
      return;
    }
    try {
      const [meRes, txRes] = await Promise.all([
        fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/transactions", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (meRes.status === 401 || txRes.status === 401) {
        setToken(null);
        setIdentity(null);
        localStorage.removeItem("token");
        localStorage.removeItem("identity");
        localStorage.removeItem("encrypted_identity");
        localStorage.removeItem("username");
        return;
      }
      const meData = await meRes.json();
      const txData = await txRes.json();
      const decryptedBalance = await decryptUserBalance(meData.current_balance, identity.dataKey);
      const decryptedTx = await decryptTransactions(txData, identity.dataKey);
      const sortedTx = decryptedTx.sort((a, b) => {
        const dateDiff = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
        if (dateDiff !== 0) return dateDiff;
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdB - createdA;
      });
      setUser({ ...meData, current_balance: decryptedBalance });
      setTransactions(sortedTx);
    } catch (e) {
      console.error(e);
    }
  }, [token, identity]);
  const handleLoginSuccess = useCallback(async (id: UserIdentity, t: string, u: User) => {
    try {
      const serialized = await serializeIdentity(id);
      localStorage.setItem("identity", serialized);
    } catch (e) {
      console.error(e);
    }
    setIdentity(id);
    setToken(t);
    setUser(u);
  }, []);
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem("token");
        const savedIdentity = localStorage.getItem("identity");
        if (savedToken && savedIdentity) {
          const meRes = await fetch("/api/me", { 
            headers: { Authorization: `Bearer ${savedToken}` } 
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            const identity = await deserializeIdentity(savedIdentity);
            const decryptedBalance = await decryptUserBalance(meData.current_balance, identity.dataKey);
            setIdentity(identity);
            setToken(savedToken);
            setUser({ ...meData, current_balance: decryptedBalance });
          } else {
            localStorage.removeItem("token");
            localStorage.removeItem("identity");
            localStorage.removeItem("encrypted_identity");
            localStorage.removeItem("username");
          }
        }
      } catch (e) {
        localStorage.removeItem("identity");
        localStorage.removeItem("token");
      } finally {
        setIsRestoring(false);
      }
    };
    void restoreSession();
  }, []);
  useEffect(() => {
    if (token && identity && !isRestoring) {
      void fetchData();
    }
  }, [token, identity, isRestoring]);
  const handleEditCategory = async (oldCategoryName: string, newCategoryName: string) => {
    if (!newCategoryName.trim() || newCategoryName === oldCategoryName) return;
    const updatedTxs = transactions.map(t => {
      if (t.category_name === oldCategoryName) {
         return { ...t, category_name: newCategoryName };
      }
      return t;
    });
    setTransactions(updatedTxs);
    const txsToUpdate = transactions.filter(t => t.category_name === oldCategoryName);
    const tokenStr = localStorage.getItem("token");
    if (!tokenStr || !identity) return;
    for (const t of txsToUpdate) {
      try {
        const { encryptedAmount, encryptedCategory, encryptedNotes } = await encryptTransactionData(
          t.amount,
          newCategoryName,
          t.notes || "",
          identity.dataKey
        );
        await fetch(`/api/transactions/${t.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenStr}`
          },
          body: JSON.stringify({
            type: t.transaction_type,
            amount: encryptedAmount,
            category: encryptedCategory,
            notes: encryptedNotes,
            date: t.transaction_date,
          })
        });
      } catch(e) {
      }
    }
  };
  const handleDeleteCategory = async (categoryName: string) => {
    const newCategoryName = "Uncategorized";
    const updatedTxs = transactions.map(t => {
      if (t.category_name === categoryName) {
         return { ...t, category_name: newCategoryName };
      }
      return t;
    });
    setTransactions(updatedTxs);
    const txsToUpdate = transactions.filter(t => t.category_name === categoryName);
    const tokenStr = localStorage.getItem("token");
    if (!tokenStr || !identity) return;
    for (const t of txsToUpdate) {
      try {
        const { encryptedAmount, encryptedCategory, encryptedNotes } = await encryptTransactionData(
          t.amount,
          newCategoryName,
          t.notes || "",
          identity.dataKey
        );
        await fetch(`/api/transactions/${t.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenStr}`
          },
          body: JSON.stringify({
            type: t.transaction_type,
            amount: encryptedAmount,
            category: encryptedCategory,
            notes: encryptedNotes,
            date: t.transaction_date,
          })
        });
      } catch(e) {
      }
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("identity");
    setIdentity(null);
    setUser(null);
    setTransactions([]);
    localStorage.removeItem("token");
    localStorage.removeItem("encrypted_identity");
    localStorage.removeItem("username");
  };
  const checkCategoryUsed = (catName: string) => transactions.some(t => t.category_name === catName);
  const handleAddTransaction = async (data: TransactionInput) => {
    if (!token || !identity ) return;
    if (!validateAmount(data.amount)) {
      return;
    }
    const sanitizedCategory = sanitizeString(data.category, 100);
    const sanitizedNotes = data.notes ? sanitizeString(data.notes, 500) : "";
    if (!sanitizedCategory) {
      return;
    }
    try {
      const { encryptedAmount, encryptedCategory, encryptedNotes } = await encryptTransactionData(
        data.amount,
        sanitizedCategory,
        sanitizedNotes,
        identity.dataKey
      );
      const currentBal = user?.current_balance || 0;
      const newBal = data.type === "Incoming" 
        ? currentBal + data.amount 
        : currentBal - data.amount;
      const encryptedNewBalance = await encryptData(newBal.toString(), identity.dataKey);
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
           type: data.type,
           date: data.date,
           amount: encryptedAmount,
           category: encryptedCategory,
           notes: encryptedNotes,
           new_balance: encryptedNewBalance
        }),
      });
      if (res.ok) {
        await fetchData();
        setShowAddModal(false);
      }
    } catch (e) {
    }
  };
  const handleEditTransaction = async (updatedTx: Transaction) => {
    if (!token || !identity) return;
    if (!validateAmount(updatedTx.amount)) {
      return;
    }
    const sanitizedCategory = sanitizeString(updatedTx.category_name, 100);
    const sanitizedNotes = updatedTx.notes ? sanitizeString(updatedTx.notes, 500) : "";
    if (!sanitizedCategory) {
      return;
    }
    try {
      const oldTx = transactions.find(t => t.id === updatedTx.id);
      if (!oldTx) return;
      const currentBal = user?.current_balance || 0;
      let newBal = currentBal;
      if (oldTx.transaction_type === "Incoming") {
        newBal -= oldTx.amount;
      } else {
        newBal += oldTx.amount;
      }
      if (updatedTx.transaction_type === "Incoming") {
        newBal += updatedTx.amount;
      } else {
        newBal -= updatedTx.amount;
      }
      const { encryptedAmount, encryptedCategory, encryptedNotes } = await encryptTransactionData(
        updatedTx.amount,
        sanitizedCategory,
        sanitizedNotes,
        identity.dataKey
      );
      const encryptedNewBalance = await encryptData(newBal.toString(), identity.dataKey);
      const res = await fetch(`/api/transactions/${updatedTx.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: updatedTx.transaction_type,
          date: updatedTx.transaction_date,
          amount: encryptedAmount,
          category: encryptedCategory,
          notes: encryptedNotes,
          new_balance: encryptedNewBalance
        }),
      });
      if (res.ok) {
        await fetchData();
        setSelectedTransaction(null);
      }
    } catch (e) {
    }
  };
  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!token || !identity) return;
    try {
      const currentBal = user?.current_balance || 0;
      let newBal = currentBal;
      if (tx.transaction_type === "Incoming") {
        newBal -= tx.amount; 
      } else {
        newBal += tx.amount; 
      }
      const encryptedNewBalance = await encryptData(newBal.toString(), identity.dataKey);
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          new_balance: encryptedNewBalance
        }),
      });
      if (res.ok) {
        await fetchData();
        setSelectedTransaction(null);
      }
    } catch (e) {
    }
  };
  if (isRestoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-800 border-t-white"></div>
          <p className="text-sm text-zinc-500">Restoring session...</p>
        </div>
      </div>
    );
  }
  if (!token || !identity) {
    return <Auth onLogin={handleLoginSuccess} />;
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route element={
          <DashboardShell onAddTransaction={() => setShowAddModal(true)}>
            <Outlet context={{ user, identity, transactions, onTransactionClick: setSelectedTransaction, onLogout: handleLogout }} />
            <AnimatePresence>
              {showAddModal && (
                <AddTransactionModal 
                  onClose={() => setShowAddModal(false)} 
                  onSubmit={handleAddTransaction} 
                  availableCategories={uniqueCategories}
                  user={user}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
                  isCategoryUsed={checkCategoryUsed}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {selectedTransaction && (
                <TransactionDetailModal
                  transaction={selectedTransaction}
                  onClose={() => setSelectedTransaction(null)}
                  onEdit={handleEditTransaction}
                  onDelete={handleDeleteTransaction}
                  availableCategories={uniqueCategories}
                  user={user}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
                  isCategoryUsed={checkCategoryUsed}
                />
              )}
            </AnimatePresence>
          </DashboardShell>
        }>
          <Route path="/" element={<Suspense fallback={<div className="text-zinc-500 p-8 text-center">Loading...</div>}><HomeView /></Suspense>} />
          <Route path="/transactions" element={<Suspense fallback={<div className="text-zinc-500 p-8 text-center">Loading...</div>}><ListView /></Suspense>} />
          <Route path="/statistics" element={<Suspense fallback={<div className="text-zinc-500 p-8 text-center">Loading...</div>}><StatisticsView /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<div className="text-zinc-500 p-8 text-center">Loading...</div>}><SettingsView /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
