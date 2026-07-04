import { motion, Variants } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { useOutletContext } from 'react-router-dom';
import { Transaction, User } from '../types';
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

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function HomeView() {
  const { user, transactions, onTransactionClick } = useOutletContext<{ 
    user: User | null; 
    transactions: Transaction[]; 
    onTransactionClick: (t: Transaction) => void;
  }>();

  const recentTransactions = transactions.slice(0, 5);
  const income = transactions.filter(t => t.transaction_type === 'Incoming').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.transaction_type === 'Outgoing').reduce((sum, t) => sum + t.amount, 0);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="p-6 max-w-4xl mx-auto space-y-8 pb-24"
    >
      <motion.div variants={itemVariants}>
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="text-4xl sm:text-5xl font-semibold text-white tracking-tighter mb-2"
        >
          Welcome, <span className="text-neutral-400">{user?.username}</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-neutral-400 mb-8 font-medium"
        >
          Here is your financial overview.
        </motion.p>
      </motion.div>

      <motion.div 
        variants={itemVariants}
        whileHover={{ scale: 1.01, rotateX: 2, rotateY: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative overflow-hidden rounded-3xl bg-[#111111] border border-white/5 shadow-2xl group cursor-default perspective-1000"
      >
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 -mr-4 -mt-4 h-48 w-48 rounded-full bg-white/5 blur-3xl group-hover:bg-white/10 transition-colors duration-500"
        />
        <div className="relative z-10 flex flex-col p-8">
          <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">Total Balance (Decrypted)</p>
          <motion.h2 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className={`font-semibold text-white tracking-tighter mb-8 ${getResponsiveAmountClass(user?.current_balance || 0, 'hero')}`}
          >
            {formatCurrency(user?.current_balance || 0)}
          </motion.h2>
          
          <div className="w-full grid grid-cols-2 gap-3 border-t border-neutral-800 pt-6">
             <motion.div whileHover={{ x: 5 }} className="flex items-center gap-3 overflow-hidden">
               <motion.div 
                 whileHover={{ rotate: 15, scale: 1.1 }}
                 className="flex-shrink-0 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
               >
                 <ArrowDownLeft className="h-5 w-5 md:h-6 md:w-6" />
               </motion.div>
               <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-zinc-500 font-medium uppercase tracking-wider truncate">Income</p>
                  <p className={`font-bold text-emerald-400 ${getResponsiveAmountClass(income, 'grid')} truncate`}>{formatCurrency(income)}</p>
               </div>
             </motion.div>
             <motion.div whileHover={{ x: -5 }} className="flex items-center gap-3 overflow-hidden">
               <motion.div 
                 whileHover={{ rotate: -15, scale: 1.1 }}
                 className="flex-shrink-0 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20"
               >
                 <ArrowUpRight className="h-5 w-5 md:h-6 md:w-6" />
               </motion.div>
               <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-zinc-500 font-medium uppercase tracking-wider truncate">Expenses</p>
                  <p className={`font-bold text-red-400 ${getResponsiveAmountClass(expense, 'grid')} truncate`}>{formatCurrency(expense)}</p>
               </div>
             </motion.div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        
        {recentTransactions.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed border-white/10 bg-[#111111]/50 p-8 text-center text-neutral-500"
          >
            No decrypted transactions found.
          </motion.div>
        ) : (
          <motion.div className="space-y-3" variants={containerVariants}>
            {recentTransactions.map((t) => (
              <motion.div 
                key={t.id}
                variants={itemVariants}
                whileHover={{ scale: 1.02, x: 5, backgroundColor: "#1a1a1a" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onTransactionClick(t)}
                className="group flex items-center justify-between rounded-2xl bg-[#111111] p-5 border border-white/5 cursor-pointer shadow-lg" 
              >
                <div className="flex items-center gap-4">
                  <motion.div 
                    whileHover={{ rotate: t.transaction_type === 'Incoming' ? 15 : -15 }}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-black border border-white/5 ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {t.transaction_type === 'Incoming' ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                  </motion.div>
                  <div>
                    <p className="font-bold text-white text-base mb-0.5">{t.category_name}</p>
                    <p className="text-xs text-zinc-400 font-medium">{dayjs(t.transaction_date).tz('Asia/Jakarta').format('D MMM YYYY, HH:mm')}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                   <p className={`font-bold ${getResponsiveAmountClass(t.amount, 'list')} ${t.transaction_type === 'Incoming' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.transaction_type === 'Incoming' ? '+' : '-'} {formatCurrency(t.amount)}
                   </p>
                   {t.notes && <p className="text-xs text-zinc-500 max-w-[120px] ml-auto truncate">{t.notes}</p>}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
