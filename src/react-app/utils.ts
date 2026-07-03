export const COLORS = ['#34d399', '#fb7185', '#38bdf8', '#a78bfa', '#fbbf24', '#818cf8'];

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

export const sanitizeString = (str: string, maxLength: number = 500): string => {
  return str.trim().slice(0, maxLength);
};
