"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Login from "@/components/dev/Login";
import Signup from "@/components/dev/Signup";
import { supabase } from "@/lib/supabase";

export default function DevAuthPage() {
  const router = useRouter();
  const [view, setView] = useState<"login" | "signup">("login");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { router.replace("/dev/dashboard"); return; }
      setChecking(false);
    });
  }, [router]);

  if (checking) return null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#360606" }}>
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-10">
          <span className="text-white font-black text-3xl tracking-tight">PHT</span>
          <span className="ml-2 text-xs font-semibold uppercase tracking-widest text-white/30 align-middle">
            Dev Portal
          </span>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <AnimatePresence mode="wait">
            {view === "login" ? (
              <Login key="login" onSwitch={() => setView("signup")} />
            ) : (
              <Signup key="signup" onSwitch={() => setView("login")} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
