import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { encryptIdentity, UserIdentity } from '../lib/crypto';

export default function SettingsView() {
  const { user, identity, onLogout } = useOutletContext<{ 
    user: User | null; 
    identity: UserIdentity | null; 
    onLogout: () => void;
  }>();

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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="p-6 max-w-2xl mx-auto space-y-8 pb-24"
    >
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
    </motion.div>
  );
}
