import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, X, CreditCard, Calendar, Tag, AlignLeft, Clock, ChevronDown, Edit, Trash2 } from "lucide-react";
import { Transaction, User } from "../types";
import { formatCurrency, getResponsiveAmountClass, isValidDateInput, isValidTimeInput, parseDateToISO } from "../utils";
import { CategoryDropdown } from "./CategoryDropdown";
export function TransactionDetailModal({ 
  transaction, 
  onClose, 
  onEdit,
  onDelete,
  availableCategories,
  user,
  onEditCategory,
  onDeleteCategory,
  isCategoryUsed
}: { 
  transaction: Transaction; 
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  availableCategories: string[];
  user: User | null;
  onEditCategory?: (oldCat: string, newCat: string) => void;
  onDeleteCategory?: (cat: string) => void;
  isCategoryUsed?: (cat: string) => boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [type, setType] = useState<"Incoming" | "Outgoing">(transaction.transaction_type);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category_name);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState(transaction.notes || "");
  const [date, setDate] = useState(() => {
    const isoDate = transaction.transaction_date.split('T')[0];
    const [y, m, d] = isoDate.split('-');
    return `${d}-${m}-${y}`;
  });
  const [time, setTime] = useState(transaction.transaction_date.includes('T') ? transaction.transaction_date.split('T')[1].substring(0, 5) : "");
  const [error, setError] = useState("");
  useEffect(() => {
    const amountValue = parseFloat(amount || "0");
    let effectiveBalance = user ? user.current_balance : 0;
    if (transaction.transaction_type === "Incoming") {
       effectiveBalance -= transaction.amount;
    } else {
       effectiveBalance += transaction.amount;
    }
    if (type === "Outgoing" && amountValue > effectiveBalance) {
      setError("Amount exceeds available balance");
    } else if (notes.length > 200) {
      setError("Notes must be 200 characters or less");
    } else {
      setError("");
    }
  }, [amount, type, user, notes, transaction]);
  const handleSave = () => {
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
    onEdit({
      ...transaction,
      transaction_type: type,
      amount: amountValue,
      category_name: category,
      notes: notes,
      transaction_date: combinedDateTime
    });
    onClose();
  };
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      onDelete(transaction);
      onClose();
    }
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
          <h3 className="text-lg font-bold text-white">{isEditing ? "Edit Transaction" : "Transaction Details"}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 hover:bg-neutral-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {!isEditing ? (
            <>
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-800/20 border border-neutral-800">
                  <span className={`text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full border ${transaction.transaction_type === 'Incoming' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                    {transaction.transaction_type === 'Incoming' ? 'Income' : 'Expense'}
                  </span>
                  <span className={`font-bold text-white tracking-tight ${getResponsiveAmountClass(transaction.amount, 'modal')}`}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/30 border border-neutral-800">
                    <span className="text-sm text-zinc-500 font-medium">Category</span>
                    <span className="text-sm text-white font-medium">{transaction.category_name}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/30 border border-neutral-800">
                    <span className="text-sm text-zinc-500 font-medium">Date</span>
                    <span className="text-sm text-white font-medium">
                      {new Date(transaction.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/30 border border-neutral-800">
                    <span className="text-sm text-zinc-500 font-medium">Time</span>
                    <span className="text-sm text-white font-medium">
                      {new Date(transaction.transaction_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')}
                    </span>
                  </div>
                  {transaction.notes && (
                    <div className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-800">
                      <span className="text-base text-zinc-500 font-medium block mb-2">Notes</span>
                      <p className="text-base text-zinc-300 leading-relaxed break-words">{transaction.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-800 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-all"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
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
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-black hover:bg-zinc-200 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
