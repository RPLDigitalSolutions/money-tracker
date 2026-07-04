import { decryptData, encryptData } from "./lib/crypto";
import { Transaction } from "./types";
export const COLORS = ['#34d399', '#fb7185', '#38bdf8', '#a78bfa', '#fbbf24', '#818cf8'];
export const isValidDateInput = (dateStr: string) => {
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (!regex.test(dateStr)) return false;
  const [_, d, m, y] = dateStr.match(regex)!;
  const date = new Date(`${y}-${m}-${d}`);
  return date.getDate() === parseInt(d) && date.getMonth() + 1 === parseInt(m) && date.getFullYear() === parseInt(y);
};
export const isValidTimeInput = (timeStr: string) => {
  if (!timeStr) return true; 
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr);
};
export const parseDateToISO = (dateStr: string) => {
  if (!isValidDateInput(dateStr)) return null;
  const [_, d, m, y] = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/)!;
  return `${y}-${m}-${d}`;
};
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};
export const sanitizeString = (str: string, maxLength: number = 500): string => {
  return str.trim().slice(0, maxLength);
};
export const validateAmount = (amount: number): boolean => {
  return !isNaN(amount) && isFinite(amount) && amount >= 0 && amount <= 1e15;
};
export const getResponsiveAmountClass = (val: number, type: 'hero' | 'grid' | 'list' | 'modal' | 'stats') => {
  const len = val.toString().length + 4 + Math.floor((val.toString().length - 1) / 3); 
  if (type === 'hero') {
    if (len > 20) return "text-xl sm:text-2xl md:text-3xl lg:text-4xl"; 
    if (len > 16) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl"; 
    if (len > 12) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"; 
    return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  }
  if (type === 'stats') {
    if (len > 20) return "text-lg sm:text-lg md:text-xl lg:text-2xl"; 
    if (len > 16) return "text-xl sm:text-xl md:text-2xl lg:text-3xl"; 
    if (len > 12) return "text-2xl sm:text-3xl md:text-3xl lg:text-4xl"; 
    return "text-3xl sm:text-4xl md:text-4xl lg:text-5xl";
  }
  if (type === 'modal') {
    if (len > 20) return "text-xl sm:text-2xl";
    if (len > 16) return "text-2xl sm:text-3xl"; 
    return "text-3xl sm:text-4xl";
  }
  if (type === 'grid') {
    if (len > 18) return "text-[10px] sm:text-xs md:text-sm"; 
    if (len > 14) return "text-xs sm:text-sm md:text-base"; 
    return "text-sm sm:text-base md:text-lg"; 
  }
  if (type === 'list') {
    if (len > 18) return "text-[10px] sm:text-xs";
    if (len > 14) return "text-xs sm:text-sm";
    return "text-sm sm:text-base";
  }
  return "text-base";
};
export const validatePassword = (password: string): { valid: boolean; message: string } => {
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
export async function decryptUserBalance(encryptedBalance: string, dataKey: CryptoKey): Promise<number> {
  try {
    const balStr = await decryptData(encryptedBalance, dataKey);
    const balance = parseFloat(balStr);
    return isNaN(balance) ? 0 : balance;
  } catch (e) {
    console.error(e);
    return 0;
  }
}
export async function decryptTransactions(
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
        console.error(e);
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
export async function encryptTransactionData(
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
