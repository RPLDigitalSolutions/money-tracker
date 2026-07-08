import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Check, Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useOutletContext } from 'react-router-dom';
import { Transaction } from '../types';
import { COLORS, formatCurrency } from '../utils';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);

export default function StatisticsView() {
  const { transactions } = useOutletContext<{ transactions: Transaction[] }>();
  const [timeRange, setTimeRange] = useState<'ALL_TIME' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('ALL_TIME');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);

  
  const filteredTransactions = useMemo(() => {
    const now = dayjs().tz('Asia/Jakarta');
    let startDate: dayjs.Dayjs | null = null;
    let endDate: dayjs.Dayjs | null = null;
    
    if (timeRange === 'DAY') {
      startDate = now.startOf('day');
    } else if (timeRange === 'WEEK') {
      startDate = now.startOf('week');
    } else if (timeRange === 'MONTH') {
      startDate = now.startOf('month');
    } else if (timeRange === 'YEAR') {
      startDate = now.startOf('year');
    } else if (timeRange === 'CUSTOM') {
      if (customRange.start) startDate = dayjs(customRange.start).tz('Asia/Jakarta').startOf('day');
      if (customRange.end) endDate = dayjs(customRange.end).tz('Asia/Jakarta').endOf('day');
    }
    
    if (timeRange === 'ALL_TIME') return transactions;
    
    return transactions.filter(t => {
      const txTime = dayjs(t.transaction_date).tz('Asia/Jakarta').valueOf();
      let isValid = true;
      if (startDate && txTime < startDate.valueOf()) isValid = false;
      if (endDate && txTime > endDate.valueOf()) isValid = false;
      return isValid;
    });
  }, [transactions, timeRange, customRange]);

  
  const trendData = useMemo(() => {
    const now = dayjs().tz('Asia/Jakarta');
    const dataMap: Record<string, { income: number; expense: number; label: string; timestamp: number }> = {};
    
    if (timeRange === 'DAY') {
      for (let i = 0; i <= 23; i++) {
        const hourDate = now.startOf('day').hour(i);
        const hourKey = hourDate.format('YYYY-MM-DD-HH');
        dataMap[hourKey] = { 
          income: 0, 
          expense: 0, 
          label: hourDate.format('HH:mm'),
          timestamp: hourDate.valueOf()
        };
      }
      
      filteredTransactions.forEach(t => {
        const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
        const hourKey = txDate.format('YYYY-MM-DD-HH');
        if (dataMap[hourKey]) {
          if (t.transaction_type === 'Incoming') dataMap[hourKey].income += t.amount;
          else dataMap[hourKey].expense += t.amount;
        }
      });
    } else if (timeRange === 'WEEK') {
      for (let i = 0; i < 7; i++) {
        const dayDate = now.startOf('week').add(i, 'day');
        const dayKey = dayDate.format('YYYY-MM-DD');
        dataMap[dayKey] = { 
          income: 0, 
          expense: 0, 
          label: dayDate.format('ddd, D'),
          timestamp: dayDate.valueOf()
        };
      }
      
      filteredTransactions.forEach(t => {
        const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
        const dayKey = txDate.format('YYYY-MM-DD');
        if (dataMap[dayKey]) {
          if (t.transaction_type === 'Incoming') dataMap[dayKey].income += t.amount;
          else dataMap[dayKey].expense += t.amount;
        }
      });
    } else if (timeRange === 'MONTH') {
      const daysInMonth = now.daysInMonth();
      const startOfMonth = now.startOf('month');
      for (let i = 0; i < daysInMonth; i++) {
        const dayDate = startOfMonth.add(i, 'day');
        const dayKey = dayDate.format('YYYY-MM-DD');
        dataMap[dayKey] = { 
          income: 0, 
          expense: 0, 
          label: dayDate.format('D MMM'),
          timestamp: dayDate.valueOf()
        };
      }
      
      filteredTransactions.forEach(t => {
        const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
        const dayKey = txDate.format('YYYY-MM-DD');
        if (dataMap[dayKey]) {
          if (t.transaction_type === 'Incoming') dataMap[dayKey].income += t.amount;
          else dataMap[dayKey].expense += t.amount;
        }
      });
    } else if (timeRange === 'YEAR') {
      const startOfYear = now.startOf('year');
      for (let i = 0; i < 12; i++) {
        const monthDate = startOfYear.add(i, 'month');
        const monthKey = monthDate.format('YYYY-MM');
        dataMap[monthKey] = { 
          income: 0, 
          expense: 0, 
          label: monthDate.format('MMM YYYY'),
          timestamp: monthDate.valueOf()
        };
      }
      
      filteredTransactions.forEach(t => {
        const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
        const monthKey = txDate.format('YYYY-MM');
        if (dataMap[monthKey]) {
          if (t.transaction_type === 'Incoming') dataMap[monthKey].income += t.amount;
          else dataMap[monthKey].expense += t.amount;
        }
      });
    } else if (timeRange === 'ALL_TIME' || timeRange === 'CUSTOM') {
      let startD = timeRange === 'CUSTOM' && customRange.start ? dayjs(customRange.start).tz('Asia/Jakarta').startOf('day') : null;
      let endD = timeRange === 'CUSTOM' && customRange.end ? dayjs(customRange.end).tz('Asia/Jakarta').endOf('day') : null;
      
      if (!startD || !endD) {
         if (filteredTransactions.length === 0) {
            startD = now;
            endD = now;
         } else {
            const dates = filteredTransactions.map(t => dayjs(t.transaction_date).tz('Asia/Jakarta').valueOf());
            const minDate = dayjs(Math.min(...dates)).tz('Asia/Jakarta');
            const maxDate = timeRange === 'ALL_TIME' ? now : dayjs(Math.max(...dates)).tz('Asia/Jakarta');
            
            if (!startD) startD = minDate;
            if (!endD) endD = maxDate;
            
            if (timeRange === 'ALL_TIME') {
              const initialDiff = endD.diff(startD, 'day');
              if (initialDiff <= 31) {
                startD = startD.subtract(1, 'day');
              } else if (initialDiff <= 365 * 2) {
                startD = startD.subtract(1, 'month');
              } else {
                startD = startD.subtract(1, 'year');
              }
            }
         }
      }
      
      const diffDays = endD.diff(startD, 'day');
      
      if (diffDays <= 31) {
        for (let i = 0; i <= diffDays; i++) {
          const dayDate = startD.add(i, 'day');
          const dayKey = dayDate.format('YYYY-MM-DD');
          dataMap[dayKey] = {
            income: 0,
            expense: 0,
            label: dayDate.format('D MMM'),
            timestamp: dayDate.valueOf()
          };
        }
        
        filteredTransactions.forEach(t => {
          const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
          const dayKey = txDate.format('YYYY-MM-DD');
          if (dataMap[dayKey]) {
            if (t.transaction_type === 'Incoming') dataMap[dayKey].income += t.amount;
            else dataMap[dayKey].expense += t.amount;
          }
        });
      } else if (diffDays <= 365 * 2) {
        const diffMonths = endD.startOf('month').diff(startD.startOf('month'), 'month');
        for (let i = 0; i <= diffMonths; i++) {
          const monthDate = startD.startOf('month').add(i, 'month');
          const monthKey = monthDate.format('YYYY-MM');
          dataMap[monthKey] = {
            income: 0,
            expense: 0,
            label: monthDate.format('MMM YYYY'),
            timestamp: monthDate.valueOf()
          };
        }
        
        filteredTransactions.forEach(t => {
          const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
          const monthKey = txDate.format('YYYY-MM');
          if (dataMap[monthKey]) {
            if (t.transaction_type === 'Incoming') dataMap[monthKey].income += t.amount;
            else dataMap[monthKey].expense += t.amount;
          }
        });
      } else {
        const diffYears = endD.startOf('year').diff(startD.startOf('year'), 'year');
        for (let i = 0; i <= diffYears; i++) {
          const yearDate = startD.startOf('year').add(i, 'year');
          const yearKey = yearDate.format('YYYY');
          dataMap[yearKey] = {
            income: 0,
            expense: 0,
            label: yearDate.format('YYYY'),
            timestamp: yearDate.valueOf()
          };
        }
        
        filteredTransactions.forEach(t => {
          const txDate = dayjs(t.transaction_date).tz('Asia/Jakarta');
          const yearKey = txDate.format('YYYY');
          if (dataMap[yearKey]) {
            if (t.transaction_type === 'Incoming') dataMap[yearKey].income += t.amount;
            else dataMap[yearKey].expense += t.amount;
          }
        });
      }
    }
    
    const entries = Object.entries(dataMap).map(([key, data]) => ({
      key,
      label: data.label,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
      balance: 0, 
      timestamp: data.timestamp
    }));
    
    let runningBalance = 0;
    entries.forEach(entry => {
      runningBalance += entry.net;
      entry.balance = runningBalance;
    });

    let cutoffTime = now.valueOf();
    if (filteredTransactions.length > 0) {
      const maxTxTime = Math.max(...filteredTransactions.map(t => dayjs(t.transaction_date).tz('Asia/Jakarta').valueOf()));
      if (maxTxTime > cutoffTime) {
        cutoffTime = maxTxTime;
      }
    }

    return entries.map(entry => {
      if (entry.timestamp > cutoffTime) {
        return { ...entry, income: null as any, expense: null as any, balance: null as any };
      }
      return entry;
    });
  }, [filteredTransactions, timeRange]);

  const expenseCategoryData = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.transaction_type === 'Outgoing');
    const byCategory: Record<string, number> = {};
    expenses.forEach(t => {
      byCategory[t.category_name] = (byCategory[t.category_name] || 0) + t.amount;
    });
    return Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredTransactions]);

  const incomeCategoryData = useMemo(() => {
    const incomes = filteredTransactions.filter(t => t.transaction_type === 'Incoming');
    const byCategory: Record<string, number> = {};
    incomes.forEach(t => {
      byCategory[t.category_name] = (byCategory[t.category_name] || 0) + t.amount;
    });
    return Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredTransactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-6 max-w-4xl mx-auto pb-32 space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-zinc-400 mt-1">Track your financial performance</p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="relative">
            <button
              onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
              className="flex items-center gap-2 bg-neutral-800/50 hover:bg-neutral-800 px-4 py-2 rounded-xl text-white font-medium border border-neutral-700/50 transition-colors shadow-sm"
            >
              {timeRange === 'ALL_TIME' && 'All Time'}
              {timeRange === 'DAY' && 'Today'}
              {timeRange === 'WEEK' && 'This Week'}
              {timeRange === 'MONTH' && 'This Month'}
              {timeRange === 'YEAR' && 'This Year'}
              {timeRange === 'CUSTOM' && 'Custom Range'}
              <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isTimeRangeOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isTimeRangeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsTimeRangeOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-800 bg-[#09090b] shadow-2xl z-20 overflow-hidden ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-100">
                  {(['ALL_TIME', 'DAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => { 
                        setTimeRange(range); 
                        setIsTimeRangeOpen(false); 
                      }}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                        timeRange === range ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {range === 'ALL_TIME' && 'All Time'}
                      {range === 'DAY' && 'Today'}
                      {range === 'WEEK' && 'This Week'}
                      {range === 'MONTH' && 'This Month'}
                      {range === 'YEAR' && 'This Year'}
                      {range === 'CUSTOM' && 'Custom Range'}
                      {timeRange === range && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {timeRange === 'CUSTOM' && (
            <div className="flex flex-col sm:flex-row items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 bg-[#09090b] p-2 rounded-2xl border border-neutral-800 shadow-xl w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <input 
                  type="date" 
                  value={customRange.start}
                  onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="pr-10 pl-3 py-2 bg-[#1a1a1a] hover:bg-white/5 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark] transition-all cursor-pointer w-full sm:w-auto relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
              <span className="text-zinc-600 text-sm font-medium hidden sm:block px-1">to</span>
              <div className="relative w-full sm:w-auto">
                <input 
                  type="date" 
                  value={customRange.end}
                  onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="pr-10 pl-3 py-2 bg-[#1a1a1a] hover:bg-white/5 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark] transition-all cursor-pointer w-full sm:w-auto relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        
        <div className="rounded-3xl border border-white/5 bg-[#111111] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full blur-[80px] opacity-20 pointer-events-none bg-blue-500"></div>
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-6 relative z-10">Net Balance</h3>
          {trendData.length > 0 ? (
            <div className="w-full h-[250px] relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                  <XAxis dataKey="label" scale="point" stroke="#27272a" tick={{fill: '#71717a', fontSize: 10, dy: 10}} textAnchor="end" height={60} minTickGap={30} padding={{ left: 0, right: 0 }} angle={-45} axisLine={false} tickLine={false} />
                  <YAxis stroke="#27272a" tick={{fill: '#71717a', fontSize: 10}} width={45} tickFormatter={(val: any) => new Intl.NumberFormat('id-ID', { notation: 'compact', compactDisplay: 'short' }).format(val)} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '20px', fontWeight: '600', padding: 0 }} itemStyle={{ color: '#3b82f6' }} labelStyle={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }} cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '4 4' }} formatter={(val: any) => [formatCurrency(val as number), ""]} />
                  <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }} isAnimationActive={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-zinc-500 relative z-10">No transaction data available</div>
          )}
        </div>

        
        <div className="rounded-3xl border border-white/5 bg-[#111111] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full blur-[80px] opacity-20 pointer-events-none bg-[#00C805]"></div>
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-6 relative z-10">Total Income</h3>
          {trendData.length > 0 ? (
            <div className="w-full h-[250px] relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                  <XAxis dataKey="label" scale="point" stroke="#27272a" tick={{fill: '#71717a', fontSize: 10, dy: 10}} textAnchor="end" height={60} minTickGap={30} padding={{ left: 0, right: 0 }} angle={-45} axisLine={false} tickLine={false} />
                  <YAxis stroke="#27272a" tick={{fill: '#71717a', fontSize: 10}} width={45} tickFormatter={(val: any) => new Intl.NumberFormat('id-ID', { notation: 'compact', compactDisplay: 'short' }).format(val)} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '20px', fontWeight: '600', padding: 0 }} itemStyle={{ color: '#00C805' }} labelStyle={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }} cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '4 4' }} formatter={(val: any) => [formatCurrency(val as number), ""]} />
                  <Line type="monotone" dataKey="income" stroke="#00C805" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#00C805", strokeWidth: 0 }} isAnimationActive={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-zinc-500 relative z-10">No transaction data available</div>
          )}
        </div>

        
        <div className="rounded-3xl border border-white/5 bg-[#111111] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full blur-[80px] opacity-20 pointer-events-none bg-[#FF5000]"></div>
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-6 relative z-10">Total Expenses</h3>
          {trendData.length > 0 ? (
            <div className="w-full h-[250px] relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
                  <XAxis dataKey="label" scale="point" stroke="#27272a" tick={{fill: '#71717a', fontSize: 10, dy: 10}} textAnchor="end" height={60} minTickGap={30} padding={{ left: 0, right: 0 }} angle={-45} axisLine={false} tickLine={false} />
                  <YAxis stroke="#27272a" tick={{fill: '#71717a', fontSize: 10}} width={45} tickFormatter={(val: any) => new Intl.NumberFormat('id-ID', { notation: 'compact', compactDisplay: 'short' }).format(val)} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '20px', fontWeight: '600', padding: 0 }} itemStyle={{ color: '#FF5000' }} labelStyle={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }} cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '4 4' }} formatter={(val: any) => [formatCurrency(val as number), ""]} />
                  <Line type="monotone" dataKey="expense" stroke="#FF5000" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#FF5000", strokeWidth: 0 }} isAnimationActive={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-zinc-500 relative z-10">No transaction data available</div>
          )}
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/5 bg-[#111111] p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-6">Income by Category</h3>
          {incomeCategoryData.length > 0 ? (
            <div className="flex flex-col space-y-4">
              {incomeCategoryData.map((data, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-white font-medium">{data.name}</span>
                  </div>
                  <span className="text-neutral-400 font-semibold">{formatCurrency(data.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-zinc-600">No income data available</div>
          )}
        </div>

        <div className="rounded-3xl border border-white/5 bg-[#111111] p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-6">Expenses by Category</h3>
          {expenseCategoryData.length > 0 ? (
            <div className="flex flex-col space-y-4">
              {expenseCategoryData.map((data, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-white font-medium">{data.name}</span>
                  </div>
                  <span className="text-neutral-400 font-semibold">{formatCurrency(data.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-zinc-600">No expenses data available</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
