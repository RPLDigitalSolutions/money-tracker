import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, X, CreditCard, Calendar, Tag, AlignLeft, Clock, ChevronDown } from "lucide-react";
import { User, TransactionInput } from "../types";
import { isValidDateInput, isValidTimeInput, parseDateToISO } from "../utils";
import { CategoryDropdown } from "./CategoryDropdown";
export function AddTransactionModal({ 
  onClose, 
  onSubmit, 
  availableCategories,
  user,
  onEditCategory,
  onDeleteCategory,
  isCategoryUsed
}: { 
  onClose: () => void; 
  onSubmit: (data: TransactionInput) => void;
  availableCategories: string[];
  user: User | null;
  onEditCategory?: (oldCat: string, newCat: string) => void;
  onDeleteCategory?: (cat: string) => void;
  isCategoryUsed?: (cat: string) => boolean;
}) {
  const [type, setType] = useState<"Incoming" | "Outgoing">("Outgoing");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [isNewCategory, setIsNewCategory] = useState(availableCategories.length === 0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  });
  const [time, setTime] = useState(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  });
  const [error, setError] = useState("");
  useEffect(() => {
    const amountValue = parseFloat(amount || "0");
    if (type === "Outgoing" && user && amountValue > user.current_balance) {
      setError("Amount exceeds current balance");
    } else if (notes.length > 200) {
      setError("Notes must be 200 characters or less");
    } else {
      setError("");
    }
  }, [amount, type, user, notes]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amountValue = parseFloat(amount);
    if (type === "Outgoing" && user && amountValue > user.current_balance) {
      setError("Amount exceeds current balance");
      return;
    }
    if (notes.length > 200) {
      setError("Notes must be 200 characters or less");
      return;
    }
    if (!isValidDateInput(date)) {
      setError("Invalid date format (DD-MM-YYYY)");
      return;
    }
    if (time && !isValidTimeInput(time)) {
      setError("Invalid time format (HH:mm)");
      return;
    }
    const isoDate = parseDateToISO(date);
    const combinedDateTime = time ? `${isoDate}T${time}` : `${isoDate}T00:00`;
    onSubmit({ type, amount: amountValue, category, notes, date: combinedDateTime });
  };
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">Add Transaction</h3>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 hover:bg-neutral-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
           <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType("Incoming")}
              className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all ${
                type === "Incoming" 
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" 
                  : "border-neutral-800 bg-neutral-800/10 text-zinc-500 hover:bg-neutral-800 hover:text-zinc-300"
              }`}
            >
              <ArrowDownLeft className="mb-2 h-6 w-6" />
              <span className="font-medium">Income</span>
            </button>
            <button
              type="button"
              onClick={() => setType("Outgoing")}
              className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all ${
                type === "Outgoing" 
                  ? "border-red-500/50 bg-red-500/10 text-red-400" 
                  : "border-neutral-800 bg-neutral-800/10 text-zinc-500 hover:bg-neutral-800 hover:text-zinc-300"
              }`}
            >
              <ArrowUpRight className="mb-2 h-6 w-6" />
              <span className="font-medium">Expense</span>
            </button>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <CreditCard className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                type="number"
                required
                min="0"
                placeholder="Amount"
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="relative z-20">
              <Tag className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500 z-10" />
              {!isNewCategory && availableCategories.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="block w-full text-left rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-10 py-3 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all hover:bg-neutral-800"
                  >
                    {category || <span className="text-zinc-500">Select Category</span>}
                  </button>
                  <ChevronDown className={`absolute right-4 top-3.5 h-5 w-5 text-zinc-500 pointer-events-none transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  {isDropdownOpen && (
                    <>
                    <CategoryDropdown 
                      availableCategories={availableCategories}
                      category={category}
                      setCategory={setCategory}
                      isDropdownOpen={isDropdownOpen}
                      setIsDropdownOpen={setIsDropdownOpen}
                      setIsNewCategory={setIsNewCategory}
                      onEditCategory={onEditCategory}
                      onDeleteCategory={onDeleteCategory}
                      isCategoryUsed={isCategoryUsed}
                    />
                    </>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="New Category Name"
                    className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    autoFocus={isNewCategory}
                  />
                  {availableCategories.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setIsNewCategory(false)}
                      className="px-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                required
                placeholder="DD-MM-YYYY"
                maxLength={10}
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                placeholder="HH:mm"
                maxLength={5}
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="relative">
              <AlignLeft className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <textarea
                rows={3}
                placeholder="Notes (optional, encrypted)"
                maxLength={200}
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-lg text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-zinc-500 mt-1 ml-1">{notes.length}/200</p>
            </div>
          </div>
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-black shadow-lg hover:bg-zinc-200 transition-all transform active:scale-[0.98]"
            >
              Encrypt & Save
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
