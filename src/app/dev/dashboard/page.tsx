"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Globe, Send, ImagePlus, Flame,
  LogOut, LayoutDashboard, X, Loader2, Link2, Plus, ChevronLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

type Chain = "bsc" | "eth" | "rwa" | "sol";

interface TokenReadOnly {
  name: string;
  address: string;
  symbol: string;
  chain: Chain;
}

interface TokenEditable {
  description: string;
  headerImage: string | null;
  headerImageFile: File | null;
  isBurn: boolean;
  website: string;
  twitter: string;
  telegram: string;
}

interface TokenEntry {
  readOnly: TokenReadOnly;
  form: TokenEditable;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = "pht-dev-token-cache";

interface TokenCache {
  userId: string;
  tokens: Array<{ readOnly: TokenReadOnly; formData: Omit<TokenEditable, "headerImageFile"> }>;
  activeIdx: number;
  pageState: "ready" | "no-token";
}

function loadCache(): TokenCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tokens)) return null;
    return parsed as TokenCache;
  } catch { return null; }
}

function saveCache(data: TokenCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

const DEFAULT_FORM: TokenEditable = {
  description: "", headerImage: null, headerImageFile: null,
  isBurn: false, website: "", twitter: "", telegram: "",
};

function entryToCache(e: TokenEntry): TokenCache["tokens"][number] {
  return {
    readOnly: e.readOnly,
    formData: {
      description: e.form.description,
      headerImage: e.form.headerImage,
      isBurn: e.form.isBurn,
      website: e.form.website,
      twitter: e.form.twitter,
      telegram: e.form.telegram,
    },
  };
}

const CHAIN_COLOURS: Record<Chain, string> = {
  bsc:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  eth:  "bg-blue-500/15 text-blue-400 border-blue-500/25",
  rwa:  "bg-purple-500/15 text-purple-400 border-purple-500/25",
  sol:  "bg-green-500/15 text-green-400 border-green-500/25",
};

const CHAIN_OPTIONS: Chain[] = ["bsc", "eth", "rwa", "sol"];

// ─── Reusable field components ────────────────────────────────────────────────

function ReadOnlyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-white/40 font-medium uppercase tracking-wider">
        <Lock size={11} />
        {label}
      </div>
      <div className={`bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white/50 select-all ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-white/40 font-medium uppercase tracking-wider">{children}</span>;
}

function InputField({ icon, placeholder, value, onChange, prefix }: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/30 transition-colors">
      <span className="text-white/35 shrink-0">{icon}</span>
      {prefix && <span className="text-white/30 text-sm shrink-0">{prefix}</span>}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent flex-1 text-sm text-white placeholder-white/25 outline-none"
      />
    </div>
  );
}

function HeaderImagePicker({ preview, onChange, onClear }: {
  preview: string | null;
  onChange: (file: File, url: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    onChange(file, URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Header Image</FieldLabel>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Header preview" className="w-full h-full object-cover" />
          <button type="button" onClick={onClear}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-1 transition-colors">
            <X size={14} className="text-white" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 h-36 rounded-xl border border-dashed border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <ImagePlus size={22} className="text-white/30" />
          <p className="text-xs text-white/30">Drop an image or <span className="text-white/60 underline underline-offset-2">browse</span></p>
          <p className="text-[10px] text-white/20">PNG, JPG, WEBP — max 2 MB</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

function BurnToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Flame size={16} className={value ? "text-orange-400" : "text-white/30"} />
        <div>
          <p className="text-sm text-white font-medium">Burn Tracking</p>
          <p className="text-xs text-white/35 mt-0.5">Show burn stats on the token page</p>
        </div>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${value ? "bg-orange-500" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

// ─── Claim Token Panel ────────────────────────────────────────────────────────

function ClaimTokenPanel({
  session,
  onClaimed,
  onCancel,
}: {
  session: Session;
  onClaimed: (claimedAddress: string) => void;
  onCancel?: () => void;
}) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<Chain>("bsc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedAddress = address.trim().toLowerCase();

    const { data: existing, error: fetchErr } = await supabase
      .from("tokens")
      .select("developer_id")
      .eq("address", normalizedAddress)
      .eq("chain", chain)
      .single();

    if (fetchErr || !existing) { setError("Token not found in registry"); setLoading(false); return; }
    if (existing.developer_id) { setError("Token is already claimed"); setLoading(false); return; }

    const { error: claimErr } = await supabase
      .from("tokens")
      .update({ developer_id: session.user.id })
      .eq("address", normalizedAddress)
      .eq("chain", chain);

    if (claimErr) { setError(claimErr.message); setLoading(false); return; }
    onClaimed(normalizedAddress);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="text-white/40 hover:text-white transition-colors shrink-0">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
            <Link2 size={18} className="text-white/60" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Claim a token</h2>
            <p className="text-xs text-white/40">Link a token to this developer account</p>
          </div>
        </div>

        <form onSubmit={handleClaim} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Contract Address</FieldLabel>
            <input type="text" placeholder="0x..." value={address} onChange={(e) => setAddress(e.target.value)} required
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none font-mono focus:border-white/30 transition-colors" />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Chain</FieldLabel>
            <div className="flex gap-2">
              {CHAIN_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setChain(c)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase border transition-colors ${chain === c ? CHAIN_COLOURS[c] : "bg-white/[0.03] border-white/8 text-white/30 hover:text-white/50"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl py-3 mt-1 hover:bg-white/90 transition-colors disabled:opacity-60">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Claiming..." : "Claim Token"}
          </button>
        </form>

        <p className="text-center text-xs text-white/25 mt-5">
          Token must exist in the PHT registry and not already be claimed.
        </p>
      </motion.div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DevDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pageState, setPageState] = useState<"loading" | "no-token" | "claiming" | "error" | "ready">("loading");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/dev/auth"); return; }
      setSession(session);

      const cache = loadCache();
      if (cache && cache.userId === session.user.id && cache.tokens.length > 0) {
        const entries: TokenEntry[] = cache.tokens.map(ct => ({
          readOnly: ct.readOnly,
          form: { ...ct.formData, headerImageFile: null },
        }));
        setTokens(entries);
        setActiveIdx(Math.min(cache.activeIdx, entries.length - 1));
        setPageState(cache.pageState);
        fetchToken(session, true);
      } else {
        fetchToken(session, false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!s) { router.replace("/dev/auth"); return; }
      setSession(s);
      if (event === "SIGNED_IN") { clearCache(); fetchToken(s, false); }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Fetch all linked tokens ───────────────────────────────────────────────

  async function fetchToken(s: Session, background = false, focusAddress?: string) {
    if (!background) { setPageState("loading"); setFetchError(null); }

    try {
      const { data, error } = await supabase
        .from("tokens")
        .select("address, symbol, name, chain, description, header_image, is_burn, website, twitter, telegram, scan")
        .eq("developer_id", s.user.id)
        .order("name", { ascending: true });

      if (error) {
        if (!background) { setFetchError(error.message); setPageState("error"); }
        return;
      }

      if (!data || data.length === 0) {
        setTokens([]);
        setPageState("no-token");
        saveCache({ userId: s.user.id, tokens: [], activeIdx: 0, pageState: "no-token" });
        return;
      }

      const entries: TokenEntry[] = data.map(row => ({
        readOnly: { name: row.name, address: row.address, symbol: row.symbol, chain: row.chain as Chain },
        form: {
          description: row.description || "",
          headerImage: row.header_image || null,
          headerImageFile: null,
          isBurn: row.is_burn ?? false,
          website: row.website || "",
          twitter: row.twitter || "",
          telegram: row.telegram || "",
        },
      }));

      setTokens(entries);
      setPageState("ready");

      const newIdx = focusAddress
        ? Math.max(0, entries.findIndex(e => e.readOnly.address === focusAddress))
        : background ? undefined : 0;

      if (newIdx !== undefined) setActiveIdx(newIdx);

      saveCache({
        userId: s.user.id,
        tokens: entries.map(entryToCache),
        activeIdx: newIdx ?? 0,
        pageState: "ready",
      });
    } catch (err) {
      if (!background) {
        setFetchError(err instanceof Error ? err.message : "Failed to load token data");
        setPageState("error");
      }
    }
  }

  // ── Active token helpers ──────────────────────────────────────────────────

  const activeToken = tokens[activeIdx] ?? null;

  function switchToken(idx: number) {
    setActiveIdx(idx);
    setSaved(false);
    setSaveError(null);
  }

  function patch(partial: Partial<TokenEditable>) {
    setTokens(prev => prev.map((t, i) =>
      i === activeIdx ? { ...t, form: { ...t.form, ...partial } } : t
    ));
    setSaved(false);
    setSaveError(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!session || !activeToken) return;
    const { readOnly, form } = activeToken;
    setSaving(true);
    setSaveError(null);

    let headerImageUrl = form.headerImage;

    if (form.headerImageFile) {
      const fd = new FormData();
      fd.append("file", form.headerImageFile);
      fd.append("address", readOnly.address);

      const res = await fetch("/api/dev/upload-header", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) {
        setSaveError("Image upload failed: " + (json.error ?? res.statusText));
        setSaving(false);
        return;
      }
      headerImageUrl = json.url;
    }

    const { error: saveErr } = await supabase
      .from("tokens")
      .update({
        description: form.description,
        header_image: headerImageUrl,
        is_burn: form.isBurn,
        website: form.website,
        twitter: form.twitter,
        telegram: form.telegram,
      })
      .eq("developer_id", session.user.id)
      .eq("address", readOnly.address)
      .eq("chain", readOnly.chain);

    if (saveErr) {
      setSaveError(saveErr.message);
    } else {
      patch({ headerImageFile: null, headerImage: headerImageUrl });
      setSaved(true);
      const updatedEntries = tokens.map((t, i) =>
        i === activeIdx ? { ...t, form: { ...t.form, headerImageFile: null, headerImage: headerImageUrl } } : t
      );
      saveCache({
        userId: session.user.id,
        tokens: updatedEntries.map(entryToCache),
        activeIdx,
        pageState: "ready",
      });
    }

    setSaving(false);
  }

  async function handleSignOut() {
    clearCache();
    await supabase.auth.signOut();
    router.replace("/dev/auth");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex" style={{ background: "#360606" }}>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col bg-black/30 border-r border-white/8 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-xl tracking-tight">PHT</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Dev Portal</span>
          </div>
          <button className="lg:hidden text-white/40 hover:text-white transition-colors" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <button
            onClick={() => pageState === "claiming" ? setPageState(tokens.length > 0 ? "ready" : "no-token") : undefined}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-white/8 text-white text-sm font-medium">
            <LayoutDashboard size={16} />
            Token Info
            {tokens.length > 1 && (
              <span className="ml-auto text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full text-white/50">
                {tokens.length}
              </span>
            )}
          </button>
          {(pageState === "ready" || pageState === "claiming") && (
            <button
              onClick={() => setPageState("claiming")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white text-sm">
              <Plus size={15} />
              Claim Another Token
            </button>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-white/8">
          {session && (
            <p className="px-3 text-xs text-white/30 mb-2 truncate">{session.user.email}</p>
          )}
          <button onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/50 hover:text-white text-sm">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 sm:px-5 py-4 border-b border-white/8 bg-black/10">
          <button className="lg:hidden text-white/50 hover:text-white transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
            <div className="flex flex-col gap-[5px]">
              <span className="block w-5 h-0.5 bg-current rounded-full" />
              <span className="block w-5 h-0.5 bg-current rounded-full" />
              <span className="block w-5 h-0.5 bg-current rounded-full" />
            </div>
          </button>

          <span className="text-white font-semibold text-sm flex-1 min-w-0">
            {pageState === "claiming" ? "Claim a Token" : "Token Info"}
          </span>

          {activeToken && pageState === "ready" && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-white/30 shrink-0">
              <span className="font-bold text-white/60">{activeToken.readOnly.symbol.toUpperCase()}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline font-mono">{activeToken.readOnly.address.slice(0, 6)}…{activeToken.readOnly.address.slice(-4)}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${CHAIN_COLOURS[activeToken.readOnly.chain]}`}>
                {activeToken.readOnly.chain}
              </span>
            </div>
          )}
        </header>

        {/* Token tabs (when multiple tokens) */}
        {pageState === "ready" && tokens.length > 1 && (
          <div className="flex items-center gap-1 px-4 sm:px-5 py-2 border-b border-white/8 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {tokens.map((t, i) => (
              <button key={t.readOnly.address} onClick={() => switchToken(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  i === activeIdx
                    ? "bg-white/10 text-white"
                    : "text-white/35 hover:text-white/60 hover:bg-white/5"
                }`}>
                {t.readOnly.symbol.toUpperCase()}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${CHAIN_COLOURS[t.readOnly.chain]}`}>
                  {t.readOnly.chain}
                </span>
              </button>
            ))}
            <button onClick={() => setPageState("claiming")}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-white/25 hover:text-white/50 transition-colors whitespace-nowrap ml-1">
              <Plus size={12} />
              Add
            </button>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">

          {/* Loading */}
          {pageState === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </motion.div>
          )}

          {/* Error */}
          {pageState === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <p className="text-white/40 text-sm mb-2">Failed to load token data</p>
                <p className="text-red-400 text-xs font-mono bg-white/5 rounded-lg px-4 py-3 mb-6">{fetchError}</p>
                <button onClick={() => session && fetchToken(session)}
                  className="text-sm text-white underline underline-offset-2 hover:text-white/70 transition-colors">
                  Try again
                </button>
              </div>
            </motion.div>
          )}

          {/* No token linked */}
          {pageState === "no-token" && session && (
            <motion.div key="no-token" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <ClaimTokenPanel
                session={session}
                onClaimed={(addr) => { clearCache(); fetchToken(session, false, addr); }}
              />
            </motion.div>
          )}

          {/* Claim another token */}
          {pageState === "claiming" && session && (
            <motion.div key="claiming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <ClaimTokenPanel
                session={session}
                onClaimed={(addr) => { clearCache(); fetchToken(session, false, addr); }}
                onCancel={() => setPageState(tokens.length > 0 ? "ready" : "no-token")}
              />
            </motion.div>
          )}

          {/* Form */}
          {pageState === "ready" && activeToken && (
            <motion.form key={`form-${activeToken.readOnly.address}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }} onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

                {/* Identity (read-only) */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">Token Identity</h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <ReadOnlyField label="Name"   value={activeToken.readOnly.name} />
                    <ReadOnlyField label="Symbol" value={activeToken.readOnly.symbol.toUpperCase()} />
                  </div>
                  <ReadOnlyField label="Contract Address" value={activeToken.readOnly.address} mono />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-white/40 font-medium uppercase tracking-wider">
                      <Lock size={11} /> Chain
                    </div>
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 flex items-center">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest ${CHAIN_COLOURS[activeToken.readOnly.chain]}`}>
                        {activeToken.readOnly.chain}
                      </span>
                    </div>
                  </div>
                </section>

                <div className="border-t border-white/8" />

                {/* About */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">About</h2>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      placeholder="Describe your token — what it does, its mission, community, etc."
                      value={activeToken.form.description}
                      onChange={(e) => patch({ description: e.target.value })}
                      rows={4}
                      maxLength={500}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none focus:border-white/30 transition-colors"
                    />
                    <p className="text-right text-[11px] text-white/25">{activeToken.form.description.length} / 500</p>
                  </div>
                  <HeaderImagePicker
                    preview={activeToken.form.headerImage}
                    onChange={(file, url) => patch({ headerImageFile: file, headerImage: url })}
                    onClear={() => patch({ headerImage: null, headerImageFile: null })}
                  />
                </section>

                <div className="border-t border-white/8" />

                {/* Features */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">Features</h2>
                  <BurnToggle value={activeToken.form.isBurn} onChange={(v) => patch({ isBurn: v })} />
                </section>

                <div className="border-t border-white/8" />

                {/* Links & Socials */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">Links & Socials</h2>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Website</FieldLabel>
                    <InputField icon={<Globe size={15} />} placeholder="https://yourtoken.io"
                      value={activeToken.form.website} onChange={(v) => patch({ website: v })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>X / Twitter</FieldLabel>
                    <InputField
                      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-white/35"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
                      placeholder="yourhandle" prefix="x.com/" value={activeToken.form.twitter} onChange={(v) => patch({ twitter: v })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Telegram</FieldLabel>
                    <InputField icon={<Send size={15} />} placeholder="yourchannel"
                      prefix="t.me/" value={activeToken.form.telegram} onChange={(v) => patch({ telegram: v })} />
                  </div>
                </section>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 pb-6 sm:pb-4">
                  <AnimatePresence>
                    {saveError && (
                      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-sm text-red-400 sm:flex-1">{saveError}</motion.p>
                    )}
                    {saved && !saveError && (
                      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-sm text-green-400 sm:flex-1">Changes saved</motion.p>
                    )}
                  </AnimatePresence>
                  <button type="submit" disabled={saving}
                    className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl py-3 px-6 hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                  </button>
                </div>

              </div>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
