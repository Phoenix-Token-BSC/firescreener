"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, Globe, Flame, ImagePlus, ArrowRight, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: <FileText size={18} />, title: "Token Description", body: "Write a public description that appears on your token's page." },
  { icon: <Globe size={18} />, title: "Links & Socials", body: "Set your website, X/Twitter, and Telegram so users can find your community." },
  { icon: <Flame size={18} />, title: "Burn Tracking", body: "Toggle burn stats visibility to surface supply deflation on your page." },
  { icon: <ImagePlus size={18} />, title: "Header Image", body: "Upload a header banner that personalises your token profile." },
  { icon: <ShieldCheck size={18} />, title: "Verified Profile", body: "Claimed profiles are marked verified, building trust with your community." },
];

const STEPS = [
  { n: "01", title: "Create an account", body: "Sign up with your email. No wallet required." },
  { n: "02", title: "Claim your token", body: "Enter your contract address and chain. First to claim it owns it." },
  { n: "03", title: "Edit & publish", body: "Fill in your token info and hit Save — changes go live instantly." },
];

export default function DevPortalLanding() {
  return (
    <main className="min-h-screen" style={{ background: "#360606" }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-xl tracking-tight">PHT</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 align-middle">Dev Portal</span>
        </div>
        <Link href="/dev/auth"
          className="flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition-colors">
          Sign in <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-white/30 border border-white/10 rounded-full px-3 py-1 mb-6">
            Developer Portal
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-5">
            Own your token&apos;s<br className="hidden sm:block" /> presence on PHT
          </h1>
          <p className="text-white/45 text-lg max-w-xl mx-auto mb-10">
            Create a developer account, claim your token, and control the info that thousands of traders see every day — description, links, burn tracking, and more.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dev/auth"
              className="flex items-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl px-7 py-3.5 hover:bg-white/90 transition-colors">
              Get Started <ArrowRight size={15} />
            </Link>
            <Link href="/dev/auth"
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-white font-semibold text-sm rounded-xl px-7 py-3.5 hover:bg-white/10 transition-colors">
              Sign in
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-white/25 mb-10">What you can manage</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="bg-white/[0.04] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white/50 mb-4">
                {f.icon}
              </div>
              <h3 className="text-white font-semibold text-sm mb-1.5">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-white/25 mb-10">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <motion.div key={s.n}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
              className="flex flex-col gap-3">
              <span className="text-4xl font-black text-white/10">{s.n}</span>
              <h3 className="text-white font-bold text-base">{s.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="border-t border-white/8 py-14 px-6">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-white font-black text-2xl mb-3">Ready to claim?</h2>
          <p className="text-white/40 text-sm mb-8">It&apos;s free. Takes 2 minutes.</p>
          <Link href="/dev/auth"
            className="inline-flex items-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl px-8 py-3.5 hover:bg-white/90 transition-colors">
            Create your account <ArrowRight size={15} />
          </Link>
        </div>
      </section>

    </main>
  );
}
