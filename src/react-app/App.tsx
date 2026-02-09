
import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Home, 
  Wallet, 
  BarChart3, 
  LogOut, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  X,
  CreditCard,
  Calendar,
  Tag,
  AlignLeft,
  Search,
  Lock,
  Edit,
  Trash2,
  ChevronDown,
  Check,
  Settings
} from "lucide-react";
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts";
import { 
  generateIdentity, 
  encryptIdentity, 
  decryptIdentity, 
  exportPublicKey, 
  signChallenge, 
  encryptData, 
  decryptData,
  UserIdentity,
  serializeIdentity,
  deserializeIdentity
} from "./lib/crypto";

// --- Types ---
type Transaction = {
  id: number;
  transaction_type: "Incoming" | "Outgoing";
  transaction_date: string;
  created_at?: string; // Add created_at
  amount: number;      // Decrypted
  category_name: string; // Decrypted
  notes: string;        // Decrypted
};

type User = {
  id: number;
  username: string;
  current_balance: number; // Decrypted
};

type View = "home" | "transactions" | "statistics" | "settings";

// --- Utils ---
const formatCurrency = (amount: number) => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1_000_000_000_000) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(amount / 1_000_000_000_000) + ' Triliun';
  }
  if (absAmount >= 1_000_000_000) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(amount / 1_000_000_000) + ' Miliar';
  }
  if (absAmount >= 100_000_000) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(amount / 1_000_000) + ' Juta';
  }
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const COLORS = ['#34d399', '#fb7185', '#38bdf8', '#a78bfa', '#fbbf24', '#818cf8'];

// --- Helper Functions ---

// Date key formatting helpers
const formatDateKey = (date: Date): string => {
  return date.getFullYear() + '-' + 
         String(date.getMonth() + 1).padStart(2, '0') + '-' + 
         String(date.getDate()).padStart(2, '0');
};

const formatHourKey = (date: Date): string => {
  return formatDateKey(date) + 'T' + String(date.getHours()).padStart(2, '0');
};

const formatMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Input validation helpers
const sanitizeString = (str: string, maxLength: number = 500): string => {
  return str.trim().slice(0, maxLength);
};

const validateAmount = (amount: number): boolean => {
  return !isNaN(amount) && isFinite(amount) && amount >= 0 && amount <= 1e15;
};

const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true, message: "" };
};

// Decrypt user balance
async function decryptUserBalance(encryptedBalance: string, dataKey: CryptoKey): Promise<number> {
  try {
    const balStr = await decryptData(encryptedBalance, dataKey);
    const balance = parseFloat(balStr);
    return isNaN(balance) ? 0 : balance;
  } catch (e) {
    console.error("Balance decrypt error", e);
    return 0;
  }
}

// Decrypt transactions array
async function decryptTransactions(
  txData: { id: number; transaction_type: string; transaction_date: string; created_at?: string; amount: string; category_name: string; notes: string }[],
  dataKey: CryptoKey
): Promise<Transaction[]> {
  return Promise.all(
    txData.map(async (t) => {
      try {
        return {
          id: t.id,
          transaction_type: t.transaction_type as "Incoming" | "Outgoing",
          transaction_date: t.transaction_date,
          created_at: t.created_at,
          amount: parseFloat(await decryptData(t.amount, dataKey)) || 0,
          category_name: await decryptData(t.category_name, dataKey),
          notes: t.notes ? await decryptData(t.notes, dataKey) : ""
        };
      } catch (e) {
        console.error("Tx decrypt error", e);
        return { 
          id: t.id,
          transaction_type: t.transaction_type as "Incoming" | "Outgoing",
          transaction_date: t.transaction_date,
          created_at: t.created_at,
          amount: 0, 
          category_name: "Decryption Error", 
          notes: "" 
        };
      }
    })
  );
}

// Encrypt transaction data
async function encryptTransactionData(
  amount: number,
  category: string,
  notes: string,
  dataKey: CryptoKey
) {
  return {
    encryptedAmount: await encryptData(amount.toString(), dataKey),
    encryptedCategory: await encryptData(category, dataKey),
    encryptedNotes: await encryptData(notes || "", dataKey)
  };
}

// Truncate notes to word boundary
function truncateNotes(text: string, maxWords: number = 6): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

// --- Components ---

function Auth({ onLogin }: { onLogin: (identity: UserIdentity, token: string, user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate username
    const sanitizedUsername = sanitizeString(username, 50);
    if (sanitizedUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    try {
      setLoading(true);
      // 1. Generate Keys locally
      const identity = await generateIdentity();
      
      // 2. Encrypt Keys with Password
      const encryptedIdentity = await encryptIdentity(identity, password);
      
      // 3. Export Public Key for Server
      // Note: We only need the verify key for server
      // But our type is CryptoKeyPair.
      const publicKeyJson = await exportPublicKey(identity.authKeys.publicKey);
      
      // 4. Encrypt Initial Balance (0)
      const encryptedBalance = await encryptData("0", identity.dataKey);

      // 5. Send to Server
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: sanitizedUsername,
          encrypted_private_key: encryptedIdentity,
          public_key: JSON.parse(publicKeyJson),
          initial_balance: encryptedBalance
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      
      setIsLogin(true);
      setError("Account created! Please login.");
      // Optional: Auto login? Let's force them to login to verify keys.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // Validate username
    const sanitizedUsername = sanitizeString(username, 50);
    if (sanitizedUsername.length < 3) {
      setError("Invalid username");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    try {
      setLoading(true);
      
      // 1. Request Challenge & Encrypted Keys
      const res1 = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sanitizedUsername })
      });
      
      const data1 = await res1.json();
      if (!res1.ok) throw new Error(data1.error || "User not found");
      
      const { encrypted_private_key, nonce, server_signature } = data1;
      
      // 2. Decrypt Keys (Proof of Ownership of Password)
      // If this fails, password is wrong.
      const identity = await decryptIdentity(encrypted_private_key, password);
      
      // 3. Sign Challenge (Proof of Ownership of Private Key)
      const signature = await signChallenge(identity.authKeys.privateKey, nonce);
      
      // 4. Verify with Server
      const res2 = await fetch("/api/auth/verify", {
        method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           username: sanitizedUsername,
           nonce,
           signature,
           server_signature
         })
      });
      
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || "Verification failed");
      
      // 5. Success - Get User Data & Decrypt Balance
      // We need to fetch user data now to get encrypted balance
      const meRes = await fetch("/api/me", { 
          headers: { Authorization: `Bearer ${data2.token}` } 
      });
      const meData = await meRes.json();
      
      // Decrypt Balance
      const decryptedBalance = await decryptUserBalance(meData.current_balance, identity.dataKey);
      
      // Save to LocalStorage for persistence on refresh
      localStorage.setItem("encrypted_identity", JSON.stringify(encrypted_private_key));
      localStorage.setItem("username", sanitizedUsername);
      localStorage.setItem("token", data2.token);

      onLogin(identity, data2.token, { ...meData, current_balance: decryptedBalance });
      
    } catch (e) {
      console.error(e);
      setError("Login Failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-neutral-950">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
      </div>

      <div className="w-full max-w-md space-y-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl p-8 shadow-2xl relative z-10">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800 border border-neutral-700 shadow-inner mb-6">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
            {isLogin ? "Secure Login" : "Create Vault"}
          </h2>
          <p className="text-sm text-zinc-400">
            {isLogin ? "Client-side decryption required" : "Your data is encrypted before leaving your device"}
          </p>
        </div>
        
        <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); void (isLogin ? handleLogin() : handleRegister()); }}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1 mb-1.5 block">Username</label>
              <input
                type="text"
                required
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-white placeholder-zinc-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
               <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1 mb-1.5 block">Password</label>
              <input
                type="password"
                required
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-white placeholder-zinc-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {!isLogin && (
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1 mb-1.5 block">Confirm Password</label>
                <input
                  type="password"
                  required
                  className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-white placeholder-zinc-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 text-center border border-red-500/20">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-xl bg-white py-3.5 px-4 text-sm font-bold text-black shadow-lg hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 transition-all transform active:scale-[0.98]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
            ) : (isLogin ? "Unlock Vault" : "Create Encrypted Account")}
          </button>
        </form>
        
        <div className="text-center pt-2">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-sm text-zinc-500 hover:text-white transition-colors underline decoration-zinc-700 underline-offset-4"
          >
            {isLogin ? "Need a vault? Create one" : "Already have key? Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

type TransactionInput = {
  type: "Incoming" | "Outgoing";
  amount: number;
  category: string;
  notes: string;
  date: string;
};

function AddTransactionModal({ 
  onClose, 
  onSubmit, 
  availableCategories,
  user
}: { 
  onClose: () => void; 
  onSubmit: (data: TransactionInput) => void;
  availableCategories: string[];
  user: User | null;
}) {
  const [type, setType] = useState<"Incoming" | "Outgoing">("Outgoing");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [isNewCategory, setIsNewCategory] = useState(availableCategories.length === 0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState("");

  // Real-time validation
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
    
    onSubmit({ type, amount: amountValue, category, notes, date });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
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
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-hidden rounded-xl border border-neutral-800 bg-[#09090b] shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100 flex flex-col ring-1 ring-white/5">
                      <div className="overflow-y-auto scrollbar-none py-1 px-1 space-y-0.5 max-h-[200px]">
                        {availableCategories.map(c => (
                          <button
                             key={c}
                             type="button"
                             onClick={() => { setCategory(c); setIsDropdownOpen(false); }}
                             className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-sm transition-all group ${
                               category === c 
                                 ? 'bg-neutral-800 text-white font-medium' 
                                 : 'text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200'
                             }`}
                          >
                            <span>{c}</span>
                            {category === c && <Check className="h-4 w-4 text-emerald-500" />}
                          </button>
                        ))}
                      </div>
                      <div className="p-1.5 border-t border-white/5 bg-neutral-900/50 backdrop-blur-sm">
                        <button
                            type="button"
                            onClick={() => { setIsNewCategory(true); setCategory(""); setIsDropdownOpen(false); }}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-black font-semibold bg-white hover:bg-zinc-200 transition-all text-xs shadow-md"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New Category
                        </button>
                      </div>
                    </div>
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
                type="date"
                required
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all [color-scheme:dark]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="relative">
              <AlignLeft className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <textarea
                rows={3}
                placeholder="Notes (optional, encrypted)"
                maxLength={200}
                className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all resize-none"
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
      </div>
    </div>
  );
}

function TransactionDetailModal({ 
  transaction, 
  onClose, 
  onEdit,
  onDelete,
  availableCategories,
  user
}: { 
  transaction: Transaction; 
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  availableCategories: string[];
  user: User | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [type, setType] = useState<"Incoming" | "Outgoing">(transaction.transaction_type);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category_name);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState(transaction.notes || "");
  const [date, setDate] = useState(transaction.transaction_date);
  const [error, setError] = useState("");

  // Real-time validation
  useEffect(() => {
    const amountValue = parseFloat(amount || "0");
    
    // Calculate effective balance available for this transaction
    let effectiveBalance = user ? user.current_balance : 0;
    
    // Revert original transaction effect
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
    
    onEdit({
      ...transaction,
      transaction_type: type,
      amount: amountValue,
      category_name: category,
      notes: notes,
      transaction_date: date
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">{isEditing ? "Edit Transaction" : "Transaction Details"}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 hover:bg-neutral-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {!isEditing ? (
            <>
              {/* View Mode */}
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-800/20 border border-neutral-800">
                  <span className={`text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full border ${transaction.transaction_type === 'Incoming' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                    {transaction.transaction_type === 'Incoming' ? 'Income' : 'Expense'}
                  </span>
                  <span className="font-bold text-3xl text-white tracking-tight">
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

                  {transaction.notes && (
                    <div className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-800">
                      <span className="text-sm text-zinc-500 font-medium block mb-2">Notes</span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{transaction.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
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
              {/* Edit Mode */}
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
                        <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                        <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-hidden rounded-xl border border-neutral-800 bg-[#09090b] shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100 flex flex-col ring-1 ring-white/5">
                          <div className="overflow-y-auto scrollbar-none py-1 px-1 space-y-0.5 max-h-[200px]">
                            {availableCategories.map(c => (
                              <button
                                 key={c}
                                 type="button"
                                 onClick={() => { setCategory(c); setIsDropdownOpen(false); }}
                                 className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-sm transition-all group ${
                                   category === c 
                                     ? 'bg-neutral-800 text-white font-medium' 
                                     : 'text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200'
                                 }`}
                              >
                                <span>{c}</span>
                                {category === c && <Check className="h-4 w-4 text-emerald-500" />}
                              </button>
                            ))}
                          </div>
                          <div className="p-1.5 border-t border-white/5 bg-neutral-900/50 backdrop-blur-sm">
                            <button
                                type="button"
                                onClick={() => { setIsNewCategory(true); setCategory(""); setIsDropdownOpen(false); }}
                                className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-black font-semibold bg-white hover:bg-zinc-200 transition-all text-xs shadow-md"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New Category
                            </button>
                          </div>
                        </div>
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
                    type="date"
                    required
                    className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all [color-scheme:dark]"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <AlignLeft className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
                  <textarea
                    rows={3}
                    placeholder="Notes (optional, encrypted)"
                    maxLength={200}
                    className="block w-full rounded-xl border border-neutral-700 bg-neutral-800/50 pl-11 pr-4 py-3 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all resize-none"
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

              {/* Save/Cancel Buttons */}
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
      </div>
    </div>
  );
}

function DashboardShell({ 
  onAddTransaction,
  children,
  currentView,
  setCurrentView
}: { 
  onAddTransaction: () => void,
  children: React.ReactNode,
  currentView: View,
  setCurrentView: (v: View) => void
}) {
  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden selection:bg-zinc-700 selection:text-white">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="flex-none flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/5 z-20">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Money Tracker</h1>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pb-44 scrollbar-none">
          {children}
        </main>

        {/* Floating Dock */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-zinc-900/90 backdrop-blur-xl p-2 shadow-2xl shadow-black/80 ring-1 ring-white/5">
            <button 
              onClick={() => setCurrentView("home")}
              className={`p-3.5 rounded-2xl transition-all duration-300 ${
                currentView === 'home' 
                ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/5' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <Home className="h-6 w-6" />
            </button>
            <button 
              onClick={() => setCurrentView("transactions")}
              className={`p-3.5 rounded-2xl transition-all duration-300 ${
                currentView === 'transactions' 
                ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/5' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <Wallet className="h-6 w-6" />
            </button>

            <button 
              onClick={() => setCurrentView("statistics")}
              className={`p-3.5 rounded-2xl transition-all duration-300 ${
                currentView === 'statistics' 
                ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/5' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="h-6 w-6" />
            </button>
            <button 
              onClick={() => setCurrentView("settings")}
              className={`p-3.5 rounded-2xl transition-all duration-300 ${
                currentView === 'settings' 
                ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/5' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <Settings className="h-6 w-6" />
            </button>

            <div className="w-px h-8 bg-white/10 mx-1"></div>

            <button 
              onClick={() => onAddTransaction()}
              className="p-3.5 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-300"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Views ---

function HomeView({ 
  user, 
  transactions, 
  onTransactionClick 
}: { 
  user: User | null; 
  transactions: Transaction[]; 
  onTransactionClick: (t: Transaction) => void;
}) {
  const recentTransactions = transactions.slice(0, 5);
  const income = transactions.filter(t => t.transaction_type === 'Incoming').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.transaction_type === 'Outgoing').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <h2 className="text-5xl font-bold text-white tracking-tight mb-2">Welcome, <span className="text-zinc-400">{user?.username}</span></h2>
      <p className="text-zinc-500 mb-8">Here is your financial overview.</p>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl group">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 h-48 w-48 rounded-full bg-zinc-700 opacity-20 blur-3xl group-hover:opacity-30 transition-opacity duration-500"></div>
        <div className="relative z-10 flex flex-col p-8">
          <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-2">Total Balance (Decrypted)</p>
          <h2 className="text-5xl font-bold text-white tracking-tight mb-8">
            {formatCurrency(user?.current_balance || 0)}
          </h2>
          
          <div className="w-full grid grid-cols-2 gap-4 border-t border-neutral-800 pt-6">
             <div className="flex items-center gap-4">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                 <ArrowDownLeft className="h-6 w-6" />
               </div>
               <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Income</p>
                  <p className="font-bold text-emerald-400 text-lg">{formatCurrency(income)}</p>
               </div>
             </div>
             <div className="flex items-center gap-4">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
                 <ArrowUpRight className="h-6 w-6" />
               </div>
               <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Expenses</p>
                  <p className="font-bold text-red-400 text-lg">{formatCurrency(expense)}</p>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-bold text-white">Recent Activity</h3>
        </div>
        
        {recentTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/50 p-8 text-center text-zinc-500">
            No decrypted transactions found.
          </div>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((t, i) => (
              <div 
                key={t.id} 
                onClick={() => onTransactionClick(t)}
                className="group flex items-center justify-between rounded-2xl bg-neutral-900/80 p-5 transition-all hover:bg-neutral-800 border border-transparent hover:border-neutral-700 cursor-pointer" 
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-950 border border-neutral-800 ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.transaction_type === 'Incoming' ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="font-bold text-white text-base mb-0.5">{t.category_name}</p>
                    <p className="text-xs text-zinc-400 font-medium">{new Date(t.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className={`font-bold text-base ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.transaction_type === 'Incoming' ? '+' : '-'} {formatCurrency(t.amount)}
                   </p>
                   {t.notes && <p className="text-xs text-zinc-400 max-w-[120px] ml-auto">{truncateNotes(t.notes, 5)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionsView({ 
  transactions, 
  onTransactionClick 
}: { 
  transactions: Transaction[]; 
  onTransactionClick: (transaction: Transaction) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filtered = transactions.filter(t => 
    t.category_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by month (newest first)
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    
    filtered.forEach(t => {
      const date = new Date(t.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(t);
    });
    
    // Sort months newest first, and transactions within each month
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, txs]) => ({
        monthKey,
        monthLabel: new Date(monthKey + '-01').toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }),
        transactions: txs.sort((a, b) => {
          const dateDiff = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
          if (dateDiff !== 0) return dateDiff;
          // Fallback to created_at descending if dates are same
          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return createdB - createdA;
        })
      }));
  }, [filtered]);

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-full animate-in slide-in-from-right-10 duration-500 pb-24">
      <div className="mb-6 sticky top-0 z-10 bg-black/90 backdrop-blur-md py-4 -mt-4 border-b border-white/5">
        <h2 className="text-2xl font-bold text-white mb-4">All Transactions</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900 pb-3 pt-3 pl-10 pr-4 text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      {groupedByMonth.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">No transactions found.</div>
      ) : (
        <div className="space-y-8 pb-8">
          {groupedByMonth.map(({ monthKey, monthLabel, transactions }) => (
            <div key={monthKey}>
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-1">
                {monthLabel}
              </h3>
              <div className="space-y-3">
                {transactions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTransactionClick(t)}
                    className="w-full flex items-center justify-between rounded-2xl border border-transparent bg-zinc-900 p-4 transition-all hover:bg-zinc-800 hover:border-zinc-700 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/50 ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.transaction_type === 'Incoming' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{t.category_name}</h4>
                        <p className="text-xs text-zinc-400 font-medium">{new Date(t.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.transaction_type === 'Incoming' ? '+' : '-'} {formatCurrency(t.amount)}
                      </p>
                      {t.notes && <p className="text-xs text-zinc-400 max-w-[120px] ml-auto">{truncateNotes(t.notes, 5)}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatisticsView({ transactions }: { transactions: Transaction[] }) {
  const [timeRange, setTimeRange] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);

  const getJakartaDate = (date: Date = new Date()) => {
    // Treat the date as Jakarta time (UTC+7)
    // 1. Get the local time string in Jakarta
    const jakartaString = date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    // 2. Parse it back to a Date object (browser will treat it as local, which is fine for extracting components)
    return new Date(jakartaString);
  };


  // Filter transactions based on time range
  const filteredTransactions = useMemo(() => {
    // Current time in Jakarta
    const now = getJakartaDate();
    let startDate: Date;
    
    if (timeRange === 'DAY') {
      // Today from 00:00 Jakarta time
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'WEEK') {
      // This week from Monday
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
      startDate.setDate(startDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'MONTH') {
      // This month from 1st
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // YEAR
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
    }
    
    return transactions.filter(t => {
      // Use standard transaction date or created_at if available
      const txDate = new Date(t.created_at || t.transaction_date);
      // Convert txDate to Jakarta "local" Date object for comparison
      const txDateJakarta = getJakartaDate(txDate);
      return txDateJakarta >= startDate;
    });
  }, [transactions, timeRange]);

  // Prep data for line chart - group by selected time range
  const trendData = useMemo(() => {
    const now = getJakartaDate(); // Now in Jakarta
    const dataMap: Record<string, { income: number; expense: number; label: string; timestamp: number }> = {};
    
    if (timeRange === 'DAY') {
      // Today from 00:00 to 23:59, group by hour
      for (let i = 0; i <= 23; i++) {
        const hourDate = new Date(now);
        hourDate.setHours(i, 0, 0, 0);
        const hourKey = formatHourKey(hourDate);
        
        dataMap[hourKey] = { 
          income: 0, 
          expense: 0, 
          label: hourDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), // e.g. 13:00
          timestamp: hourDate.getTime()
        };
      }
      
      filteredTransactions.forEach(t => {
        const date = new Date(t.created_at || t.transaction_date); 
        const jakartaDate = getJakartaDate(date);
        const hourKey = formatHourKey(jakartaDate);

        if (dataMap[hourKey]) {
          if (t.transaction_type === 'Incoming') {
            dataMap[hourKey].income += t.amount;
          } else {
            dataMap[hourKey].expense += t.amount;
          }
        }
      });
    } else if (timeRange === 'WEEK') {
      const startOfWeek = new Date(now);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        dayDate.setHours(0, 0, 0, 0);
        const dayKey = formatDateKey(dayDate);
                       
        dataMap[dayKey] = { 
          income: 0, 
          expense: 0, 
          label: dayDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
          timestamp: dayDate.getTime()
        };
      }
      
      filteredTransactions.forEach(t => {
        const date = new Date(t.created_at || t.transaction_date);
        const jakartaDate = getJakartaDate(date);
        const dayKey = formatDateKey(jakartaDate);

        if (dataMap[dayKey]) {
          if (t.transaction_type === 'Incoming') {
            dataMap[dayKey].income += t.amount;
          } else {
            dataMap[dayKey].expense += t.amount;
          }
        }
      });
    } else if (timeRange === 'MONTH') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(now.getFullYear(), now.getMonth(), i);
        dayDate.setHours(0, 0, 0, 0);
        const dayKey = formatDateKey(dayDate);
        
        dataMap[dayKey] = { 
          income: 0, 
          expense: 0, 
          label: dayDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
          timestamp: dayDate.getTime()
        };
      }
      
      filteredTransactions.forEach(t => {
        const date = new Date(t.created_at || t.transaction_date);
        const jakartaDate = getJakartaDate(date);
        const dayKey = formatDateKey(jakartaDate);

        if (dataMap[dayKey]) {
          if (t.transaction_type === 'Incoming') {
            dataMap[dayKey].income += t.amount;
          } else {
            dataMap[dayKey].expense += t.amount;
          }
        }
      });
    } else {
      // YEAR
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(now.getFullYear(), i, 1);
        monthDate.setHours(0, 0, 0, 0);
        const monthKey = formatMonthKey(monthDate);
        
        dataMap[monthKey] = { 
          income: 0, 
          expense: 0, 
          label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          timestamp: monthDate.getTime()
        };
      }
      
      filteredTransactions.forEach(t => {
        const date = new Date(t.created_at || t.transaction_date);
        const jakartaDate = getJakartaDate(date);
        const monthKey = formatMonthKey(jakartaDate);

        if (dataMap[monthKey]) {
          if (t.transaction_type === 'Incoming') {
            dataMap[monthKey].income += t.amount;
          } else {
            dataMap[monthKey].expense += t.amount;
          }
        }
      });
    }
    
    // Convert to array
    const entries = Object.entries(dataMap).map(([key, data]) => ({
      key,
      label: data.label,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
      balance: 0, 
      timestamp: data.timestamp
    }));
    
    // Calculate running balance
    let runningBalance = 0;
    entries.forEach(entry => {
      runningBalance += entry.net;
      entry.balance = runningBalance;
    });

    // Mask future data points - compare against Jakarta Now timestamp
    const nowTime = now.getTime(); // 'now' is already getJakartaDate()
    return entries.map(entry => {
      // Compare timestamps derived from Jakarta dates
      if (entry.timestamp > nowTime) {
        return { ...entry, income: null, expense: null, balance: null };
      }
      return entry;
    });
  }, [filteredTransactions, timeRange]);

  const expenseData = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.transaction_type === 'Outgoing');
    const byCategory: Record<string, number> = {};
    expenses.forEach(t => {
      byCategory[t.category_name] = (byCategory[t.category_name] || 0) + t.amount;
    });
    return Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredTransactions]);

  const totalIncome = useMemo(() => 
    filteredTransactions.filter(t => t.transaction_type === 'Incoming').reduce((s, t) => s + t.amount, 0), 
    [filteredTransactions]
  );
  
  const totalExpense = useMemo(() => 
    filteredTransactions.filter(t => t.transaction_type === 'Outgoing').reduce((s, t) => s + t.amount, 0), 
    [filteredTransactions]
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right-10 duration-500 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Financial Statistics</h2>
        
        {/* Time Range Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
            className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            {timeRange}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isTimeRangeOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl z-50 overflow-hidden">
              {(['DAY', 'WEEK', 'MONTH', 'YEAR'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range);
                    setIsTimeRangeOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                    timeRange === range 
                      ? 'bg-neutral-800 text-white font-semibold' 
                      : 'text-zinc-400 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  {range}
                  {timeRange === range && (
                    <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend Line Chart */}
      <div className="rounded-3xl border border-neutral-800 bg-[#09090b] p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-6">Transaction Trends</h3>
        
        {trendData.length > 0 ? (
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="label" 
                  stroke="#71717a" 
                  tick={{fill: '#a1a1aa', fontSize: 11, dy: 10}} 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={timeRange === 'DAY' ? 2 : timeRange === 'MONTH' ? 2 : timeRange === 'YEAR' ? 0 : 0}
                />
                <YAxis stroke="#71717a" tick={{fill: '#a1a1aa'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(val) => [formatCurrency(val as number), "Balance"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#60a5fa" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[450px] flex items-center justify-center text-zinc-500">
            No transaction data available
          </div>
        )}
      </div>

      {/* Income & Expense Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-neutral-800 bg-[#09090b] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <ArrowDownLeft className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Total Income</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-400 tracking-tight">{formatCurrency(totalIncome)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-[#09090b] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 rounded-full bg-red-500/10 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <ArrowUpRight className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Total Expenses</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-red-400 tracking-tight">{formatCurrency(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Category Pie Chart */}
      <div className="rounded-3xl border border-neutral-800 bg-[#09090b] p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Expenses by Category</h3>
        {expenseData.length > 0 ? (
          <div className="w-full h-80 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {expenseData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                   itemStyle={{ color: '#fff' }}
                   formatter={(val) => formatCurrency(val as number)}
                />
                <Legend iconType="circle" wrapperStyle={{ color: '#a1a1aa' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-zinc-600">
            No expense data available
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView({ user, identity, onLogout }: { user: User | null; identity: UserIdentity | null; onLogout: () => void }) {
  const [username, setUsername] = useState(user?.username || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  const [usernameStatus, setUsernameStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username === user?.username) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username })
      });
      
      const data = await res.json();
      if (res.ok) {
        setUsernameStatus("Username updated successfully. Please restart.");
        localStorage.setItem("username", username);
      } else {
        setUsernameStatus(data.error || "Failed to update username");
      }
    } catch {
      setUsernameStatus("Error updating username");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity) return;
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus("New passwords do not match");
      return;
    }
    
    setLoading(true);
    try {
      const newEncryptedIdentity = await encryptIdentity(identity, newPassword);
      
      const token = localStorage.getItem("token");
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ encrypted_private_key: newEncryptedIdentity })
      });
      
      if (res.ok) {
        setPasswordStatus("Password updated! Please remember it.");
        localStorage.setItem("encrypted_identity", JSON.stringify(newEncryptedIdentity));
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setPasswordStatus("Failed to update password");
      }
    } catch (e) {
      console.error(e);
      setPasswordStatus("Error updating password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-10 duration-500 pb-24">
      <h2 className="text-4xl font-bold text-white tracking-tight mb-8">Settings</h2>

      {/* Main Settings Card */}
      <div className="rounded-3xl border border-neutral-800 bg-[#09090b] p-8 shadow-xl relative overflow-hidden space-y-10">
        
        {/* Profile Section */}
        <div className="space-y-6">
           <form onSubmit={handleUpdateUsername} className="space-y-4">
              <div className="space-y-1">
                 <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Display Name</label>
                 <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3.5 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all shadow-sm"
                />
              </div>
              {usernameStatus && (
                <p className={`text-sm font-medium ${usernameStatus.includes("success") ? "text-emerald-400" : "text-red-400"}`}>
                  {usernameStatus}
                </p>
              )}
              <button 
                type="submit" 
                disabled={loading || username === user?.username}
                className="w-full rounded-xl bg-white py-3 font-bold text-black shadow-lg shadow-white/10 disabled:opacity-50 hover:bg-zinc-200 transition-all active:scale-[0.98]"
              >
                Save Display Name
              </button>
           </form>
        </div>

        <div className="h-px bg-neutral-800 w-full"></div>

        {/* Security Section */}
        <div className="space-y-6">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">New Password</label>
                    <input 
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Confirm Password</label>
                    <input 
                       type="password"
                       required
                       value={confirmNewPassword}
                       onChange={(e) => setConfirmNewPassword(e.target.value)}
                       className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all"
                     />
                  </div>
              </div>
              
              {passwordStatus && (
                <p className={`text-sm font-medium ${passwordStatus.includes("updated") ? "text-emerald-400" : "text-red-400"}`}>
                  {passwordStatus}
                </p>
              )}
              <button 
                type="submit" 
                disabled={loading || !newPassword}
                className="w-full rounded-xl bg-white py-3 font-bold text-black disabled:opacity-50 hover:bg-zinc-200 transition-all shadow-sm active:scale-[0.98]"
              >
                Update Password
              </button>
            </form>
        </div>

        <div className="h-px bg-neutral-800 w-full"></div>

        {/* Danger Zone */}
        <div className="space-y-6 pt-2">
            <button 
              onClick={onLogout} 
              className="w-full group flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-3.5 text-red-400 font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-lg shadow-red-900/10"
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              Delete Vault
            </button>
        </div>

      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  // Application State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [currentView, setCurrentView] = useState<View>("home");

  // Compute unique categories from existing transactions
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.category_name))).sort();
  }, [transactions]);

  // Fetch and Decrypt Data
  const fetchData = useCallback(async () => {
    if (!token || !identity) {
      console.log("fetchData skipped: missing token or identity");
      return;
    }
    
    console.log("fetchData: Starting data fetch...");
    
    try {
      const [meRes, txRes] = await Promise.all([
        fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/transactions", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (meRes.status === 401 || txRes.status === 401) {
        console.log("fetchData: Got 401, clearing session");
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

      // Decrypt using helper functions
      const decryptedBalance = await decryptUserBalance(meData.current_balance, identity.dataKey);
      const decryptedTx = await decryptTransactions(txData, identity.dataKey);

      setUser({ ...meData, current_balance: decryptedBalance });
      setTransactions(decryptedTx);
      
      console.log("fetchData: Success, data loaded");

    } catch (e) {
      console.error("fetchData error:", e);
    }
  }, [token, identity]);

  const handleLoginSuccess = useCallback(async (id: UserIdentity, t: string, u: User) => {
    // Persist session to localStorage (not sessionStorage)
    try {
      const serialized = await serializeIdentity(id);
      localStorage.setItem("identity", serialized);
      console.log("Identity saved to localStorage");
    } catch (e) {
      console.error("Failed to serialize identity", e);
    }
    
    // Set states AFTER saving to localStorage
    setIdentity(id);
    setToken(t);
    setUser(u);
  }, []);

  // Restore login from localStorage on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem("token");
        const savedIdentity = localStorage.getItem("identity");
        
        if (savedToken && savedIdentity) {
          // Verify token is still valid & restore session
          const meRes = await fetch("/api/me", { 
            headers: { Authorization: `Bearer ${savedToken}` } 
          });
          
          if (meRes.ok) {
            const meData = await meRes.json();
            const identity = await deserializeIdentity(savedIdentity);
            
            // Decrypt balance
            const decryptedBalance = await decryptUserBalance(meData.current_balance, identity.dataKey);
            
            // Set all states together
            setIdentity(identity);
            setToken(savedToken);
            setUser({ ...meData, current_balance: decryptedBalance });
            console.log("Session restored successfully");
          } else {
            // Token expired, clear everything
            console.log("Token expired, clearing storage");
            localStorage.removeItem("token");
            localStorage.removeItem("identity");
            localStorage.removeItem("encrypted_identity");
            localStorage.removeItem("username");
          }
        } else {
          console.log("No saved session found");
        }
      } catch (e) {
        console.error("Session restore failed:", e);
        localStorage.removeItem("identity");
        localStorage.removeItem("token");
      } finally {
        setIsRestoring(false);
      }
    };
    
    void restoreSession();
  }, []);

  // Initial Fetch when logged in (skip during restore)
  useEffect(() => {
    if (token && identity && !isRestoring) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, identity, isRestoring]);

  const handleLogout = () => {
    setToken(null);
    setIdentity(null);
    setUser(null);
    setTransactions([]);
    localStorage.removeItem("token");
    localStorage.removeItem("identity");
    localStorage.removeItem("encrypted_identity");
    localStorage.removeItem("username");
  };

  const handleAddTransaction = async (data: TransactionInput) => {
    if (!token || !identity ) return;
    
    // Validate input data
    if (!validateAmount(data.amount)) {
      console.error("Invalid amount");
      return;
    }
    
    const sanitizedCategory = sanitizeString(data.category, 100);
    const sanitizedNotes = data.notes ? sanitizeString(data.notes, 500) : "";
    
    if (!sanitizedCategory) {
      console.error("Category is required");
      return;
    }
    
    try {
      // 1. Encrypt Fields
      const { encryptedAmount, encryptedCategory, encryptedNotes } = await encryptTransactionData(
        data.amount,
        sanitizedCategory,
        sanitizedNotes,
        identity.dataKey
      );
      
      // 2. Calc New Balance
      const currentBal = user?.current_balance || 0;
      const newBal = data.type === "Incoming" 
        ? currentBal + data.amount 
        : currentBal - data.amount;
      
      const encryptedNewBalance = await encryptData(newBal.toString(), identity.dataKey);

      // 3. Send
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
        setCurrentView("home");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditTransaction = async (updatedTx: Transaction) => {
    if (!token || !identity) return;
    
    // Validate input data
    if (!validateAmount(updatedTx.amount)) {
      console.error("Invalid amount");
      return;
    }
    
    const sanitizedCategory = sanitizeString(updatedTx.category_name, 100);
    const sanitizedNotes = updatedTx.notes ? sanitizeString(updatedTx.notes, 500) : "";
    
    if (!sanitizedCategory) {
      console.error("Category is required");
      return;
    }
    
    try {
      // Find the old transaction to calculate balance difference
      const oldTx = transactions.find(t => t.id === updatedTx.id);
      if (!oldTx) return;

      // Calculate balance adjustment
      const currentBal = user?.current_balance || 0;
      
      // Reverse old transaction
      let newBal = currentBal;
      if (oldTx.transaction_type === "Incoming") {
        newBal -= oldTx.amount;
      } else {
        newBal += oldTx.amount;
      }
      
      // Apply new transaction
      if (updatedTx.transaction_type === "Incoming") {
        newBal += updatedTx.amount;
      } else {
        newBal -= updatedTx.amount;
      }

      // Encrypt fields
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
      console.error(e);
    }
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!token || !identity) return;
    try {
      // Calculate new balance (reverse the transaction)
      const currentBal = user?.current_balance || 0;
      let newBal = currentBal;
      
      if (tx.transaction_type === "Incoming") {
        newBal -= tx.amount; // Remove income
      } else {
        newBal += tx.amount; // Reverse expense
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
      console.error(e);
    }
  };

  // Show loading screen while restoring session
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
    <>
      <DashboardShell 
        onAddTransaction={() => setShowAddModal(true)}
        currentView={currentView}
        setCurrentView={setCurrentView}
      >
        {currentView === 'home' && (
          <HomeView 
            user={user} 
            transactions={transactions} 
            onTransactionClick={(tx) => setSelectedTransaction(tx)} 
          />
        )}
        {currentView === 'transactions' && (
          <TransactionsView 
            transactions={transactions} 
            onTransactionClick={(tx) => setSelectedTransaction(tx)}
          />
        )}
        {currentView === 'statistics' && <StatisticsView transactions={transactions} />}
        {currentView === 'settings' && <SettingsView user={user} identity={identity} onLogout={handleLogout} />}
      </DashboardShell>

      {showAddModal && (
        <AddTransactionModal 
          onClose={() => setShowAddModal(false)} 
          onSubmit={handleAddTransaction} 
          availableCategories={uniqueCategories}
          user={user}
        />
      )}

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          availableCategories={uniqueCategories}
          user={user}
        />
      )}
    </>
  );
}
