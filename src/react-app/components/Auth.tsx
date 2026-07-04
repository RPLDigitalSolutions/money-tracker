import { useState } from "react";
import { Lock } from "lucide-react";
import {
  generateIdentity,
  encryptIdentity,
  decryptIdentity,
  exportPublicKey,
  signChallenge,
  encryptData,
  UserIdentity
} from "../lib/crypto";
import { User } from "../types";
import { sanitizeString, validatePassword, decryptUserBalance } from "../utils";
export function Auth({ onLogin }: { onLogin: (identity: UserIdentity, token: string, user: User) => void }) {
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
    const sanitizedUsername = sanitizeString(username, 50);
    if (sanitizedUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }
    try {
      setLoading(true);
      const identity = await generateIdentity();
      const encryptedIdentity = await encryptIdentity(identity, password);
      const publicKeyJson = await exportPublicKey(identity.authKeys.publicKey);
      const encryptedBalance = await encryptData("0", identity.dataKey);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };
  const handleLogin = async () => {
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
      const res1 = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sanitizedUsername })
      });
      const data1 = await res1.json();
      if (!res1.ok) throw new Error(data1.error || "User not found");
      const { encrypted_private_key, nonce, server_signature } = data1;
      const identity = await decryptIdentity(encrypted_private_key, password);
      const signature = await signChallenge(identity.authKeys.privateKey, nonce);
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
      const meRes = await fetch("/api/me", { 
          headers: { Authorization: `Bearer ${data2.token}` } 
      });
      const meData = await meRes.json();
      const decryptedBalance = await decryptUserBalance(meData.current_balance, identity.dataKey);
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
