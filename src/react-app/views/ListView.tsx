import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { useOutletContext } from 'react-router-dom';
import { Transaction } from '../types';
import { formatCurrency } from '../utils';

dayjs.extend(utc);
dayjs.extend(timezone);

function getResponsiveAmountClass(amount: number, context: 'hero' | 'grid' | 'list') {
  const str = amount.toString();
  if (context === 'hero') {
    if (str.length > 10) return "text-2xl sm:text-3xl md:text-4xl";
    if (str.length > 8) return "text-3xl sm:text-4xl md:text-5xl";
    return "text-4xl sm:text-5xl md:text-6xl";
  }
  if (context === 'grid') {
    if (str.length > 10) return "text-[10px] md:text-xs";
    if (str.length > 8) return "text-xs md:text-sm";
    return "text-sm md:text-base";
  }
  if (context === 'list') {
    if (str.length > 10) return "text-xs sm:text-sm";
    if (str.length > 8) return "text-sm sm:text-base";
    return "text-base sm:text-lg";
  }
  return "";
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

const groupVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { staggerChildren: 0.05, type: 'spring', stiffness: 200, damping: 20 } 
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10, scale: 0.95 },
  show: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function ListView() {
  const { transactions, onTransactionClick } = useOutletContext<{ 
    transactions: Transaction[]; 
    onTransactionClick: (t: Transaction) => void;
  }>();

  const [searchTerm, setSearchTerm] = useState("");
  
  const filtered = transactions.filter(t => 
    t.category_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const groupedByDay = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    
    filtered.forEach(t => {
      const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
      const dayKey = txDate.format('YYYY-MM-DD');
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(t);
    });
    
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dayKey, txs]) => ({
        dayKey,
        dayLabel: dayjs(dayKey).tz('Asia/Jakarta').format('dddd, D MMMM YYYY'),
        transactions: txs.sort((a, b) => dayjs(b.transaction_date).valueOf() - dayjs(a.transaction_date).valueOf())
      }));
  }, [filtered]);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="p-6 max-w-4xl mx-auto min-h-full pb-24"
    >
      <motion.div variants={itemVariants} className="mb-6 sticky top-0 z-10 bg-black/80 backdrop-blur-xl py-4 -mt-4 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white mb-4">All Transactions</h2>
        <div className="relative group">
          <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-white transition-colors" />
          <motion.input 
            whileFocus={{ scale: 1.01 }}
            type="text" 
            placeholder="Search transactions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-md pb-3 pt-3 pl-10 pr-4 text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all shadow-inner"
          />
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {groupedByDay.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring' }}
            className="text-center text-zinc-500 py-12"
          >
            No transactions found.
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-8 pb-8" variants={containerVariants}>
            {groupedByDay.map(({ dayKey, dayLabel, transactions }) => (
              <motion.div key={dayKey} variants={groupVariants}>
                <motion.h3 
                  variants={itemVariants}
                  className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-1"
                >
                  {dayLabel}
                </motion.h3>
                <motion.div className="space-y-3">
                  {transactions.map((t) => (
                    <motion.button
                      key={t.id}
                      variants={itemVariants}
                      whileHover={{ scale: 1.02, x: 5, backgroundColor: "#27272a", borderColor: "#3f3f46" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onTransactionClick(t)}
                      className="w-full flex items-center justify-between rounded-2xl border border-transparent bg-zinc-900 p-4 transition-colors cursor-pointer text-left shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <motion.div 
                          whileHover={{ rotate: t.transaction_type === 'Incoming' ? 15 : -15 }}
                          className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/50 ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {t.transaction_type === 'Incoming' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </motion.div>
                        <div>
                          <h4 className="font-semibold text-white">{t.category_name}</h4>
                          <p className="text-xs text-zinc-400 font-medium">{dayjs(t.transaction_date).tz('Asia/Jakarta').format('HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${getResponsiveAmountClass(t.amount, 'list')} ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.transaction_type === 'Incoming' ? '+' : '-'} {formatCurrency(t.amount)}
                        </p>
                        {t.notes && <p className="text-xs text-zinc-500 max-w-[100px] ml-auto truncate">{t.notes}</p>}
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
