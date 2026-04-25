"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, User } from "lucide-react";

type Step = "form" | "verify" | "done";

export default function Signup({ onSwitch }: { onSwitch: () => void }) {
  const [step, setStep] = useState<Step>("form");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: submit signup form ────────────────────────────────────────────

  async function handleSignup(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dev/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Signup failed");
        setLoading(false);
        return;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("verify");
  }

  // ── Step 2: submit verification code ─────────────────────────────────────

  async function handleVerify(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dev/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Verification failed");
        setLoading(false);
        return;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("done");
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-white mb-2">You&apos;re all set</h2>
        <p className="text-sm text-white/50">
          Your account is verified. Sign in to access the developer portal.
        </p>
        <button
          onClick={onSwitch}
          className="mt-8 text-sm text-white underline underline-offset-2 hover:text-white/70 transition-colors"
        >
          Sign in
        </button>
      </motion.div>
    );
  }

  // ── Verify code ───────────────────────────────────────────────────────────

  if (step === "verify") {
    return (
      <motion.div
        key="verify"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
      >
        <h2 className="text-2xl font-bold text-white mb-1">Check your email</h2>
        <p className="text-sm text-white/50 mb-8">
          We sent a 6-digit code to <span className="text-white">{email}</span>. Enter it below.
        </p>

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/30 transition-colors">
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              maxLength={6}
              className="bg-transparent flex-1 text-sm text-white placeholder-white/30 outline-none tracking-widest text-center text-lg font-bold"
            />
          </div>

          {error && <p className="text-red-400 text-xs px-1">{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="flex items-center justify-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl py-3 mt-1 hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <p className="text-center text-sm text-white/40 mt-6">
          Wrong email?{" "}
          <button
            onClick={() => { setStep("form"); setCode(""); setError(null); }}
            className="text-white underline underline-offset-2 hover:text-white/80 transition-colors"
          >
            Go back
          </button>
        </p>
      </motion.div>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────

  return (
    <motion.div
      key="form"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
      <p className="text-sm text-white/50 mb-8">Join the developer portal</p>

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        {/* Username */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/30 transition-colors">
          <User size={16} className="text-white/40 shrink-0" />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only"
            className="bg-transparent flex-1 text-sm text-white placeholder-white/30 outline-none"
          />
        </div>

        {/* Email */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/30 transition-colors">
          <Mail size={16} className="text-white/40 shrink-0" />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-transparent flex-1 text-sm text-white placeholder-white/30 outline-none"
          />
        </div>

        {/* Password */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/30 transition-colors">
          <Lock size={16} className="text-white/40 shrink-0" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="bg-transparent flex-1 text-sm text-white placeholder-white/30 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p className="text-red-400 text-xs px-1">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl py-3 mt-1 hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-white/40 mt-6">
        Already have an account?{" "}
        <button onClick={onSwitch} className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">
          Sign in
        </button>
      </p>
    </motion.div>
  );
}
