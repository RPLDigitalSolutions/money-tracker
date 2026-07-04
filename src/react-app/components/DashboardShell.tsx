import { NavLink } from "react-router-dom";
import { Home, Wallet, BarChart3, Plus, Settings } from "lucide-react";
import React from "react";
export function DashboardShell({ onAddTransaction, children }: { onAddTransaction: () => void, children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden selection:bg-zinc-700 selection:text-white">
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="flex-none flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/5 z-20">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Money Tracker</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-44 scrollbar-none">
          {children}
        </main>
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pb-[env(safe-area-inset-bottom)] w-[calc(100%-2rem)] max-w-sm mx-auto">
          <div className="flex justify-between sm:justify-center items-center gap-1 sm:gap-2 rounded-3xl border border-white/20 bg-zinc-900/80 backdrop-blur-3xl p-1.5 sm:p-2 shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-x-auto scrollbar-none">
            <NavLink 
              to="/"
              className={({isActive}) => `p-2.5 sm:p-3.5 rounded-2xl transition-all duration-300 flex-1 sm:flex-none flex justify-center ${isActive ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
              <Home className="h-5 w-5 sm:h-6 sm:w-6" />
            </NavLink>
            <NavLink 
              to="/transactions"
              className={({isActive}) => `p-2.5 sm:p-3.5 rounded-2xl transition-all duration-300 flex-1 sm:flex-none flex justify-center ${isActive ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            </NavLink>
            <NavLink 
              to="/statistics"
              className={({isActive}) => `p-2.5 sm:p-3.5 rounded-2xl transition-all duration-300 flex-1 sm:flex-none flex justify-center ${isActive ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
            </NavLink>
            <NavLink 
              to="/settings"
              className={({isActive}) => `p-2.5 sm:p-3.5 rounded-2xl transition-all duration-300 flex-1 sm:flex-none flex justify-center ${isActive ? 'bg-zinc-800 text-white shadow-inner shadow-black/50 ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </NavLink>
            <div className="hidden sm:block w-px h-8 bg-white/10 mx-1"></div>
            <button 
              onClick={() => onAddTransaction()}
              className="p-2.5 sm:p-3.5 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-300 flex-1 sm:flex-none flex justify-center"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
