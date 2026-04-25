"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Globe, Send, ImagePlus, Flame,
  LogOut, LayoutDashboard, X, Loader2, Link2,
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

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = "pht-dev-token-cache";

interface TokenCache {
  userId: string;
  readOnly: TokenReadOnly | null;
  formData: Omit<TokenEditable, "headerImageFile">;
  pageState: "ready" | "no-token";
}

function loadCache(): TokenCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as TokenCache) : null;
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

function ClaimTokenPanel({ session, onClaimed }: { session: Session; onClaimed: () => void }) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<Chain>("bsc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedAddress = address.trim().toLowerCase();

    // Check the token exists and is unclaimed
    const { data: existing, error: fetchErr } = await supabase
      .from("tokens")
      .select("developer_id")
      .eq("address", normalizedAddress)
      .eq("chain", chain)
      .single();

    if (fetchErr || !existing) { setError("Token not found in registry"); setLoading(false); return; }
    if (existing.developer_id) { setError("Token is already claimed"); setLoading(false); return; }

    // Check this dev doesn't already own a token
    const { data: owned } = await supabase
      .from("tokens")
      .select("address")
      .eq("developer_id", session.user.id)
      .single();

    if (owned) { setError("Your account already has a linked token"); setLoading(false); return; }

    const { error: claimErr } = await supabase
      .from("tokens")
      .update({ developer_id: session.user.id })
      .eq("address", normalizedAddress)
      .eq("chain", chain);

    if (claimErr) { setError(claimErr.message); setLoading(false); return; }
    onClaimed();
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center">
            <Link2 size={18} className="text-white/60" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Claim your token</h2>
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
          Token must exist in the Firescreener registry and not already be claimed.
        </p>
      </motion.div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DevDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tokenReadOnly, setTokenReadOnly] = useState<TokenReadOnly | null>(null);
  const [form, setForm] = useState<TokenEditable>(DEFAULT_FORM);
  const [pageState, setPageState] = useState<"loading" | "no-token" | "error" | "ready">("loading");
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
      if (cache && cache.userId === session.user.id) {
        setTokenReadOnly(cache.readOnly);
        setForm({ ...cache.formData, headerImageFile: null });
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

  // ── Fetch linked token ────────────────────────────────────────────────────

  async function fetchToken(s: Session, background = false) {
    if (!background) { setPageState("loading"); setFetchError(null); }

    try {
      const { data, error } = await supabase
        .from("tokens")
        .select("address, symbol, name, chain, description, header_image, is_burn, website, twitter, telegram, scan")
        .eq("developer_id", s.user.id)
        .single();

      if (error || !data) {
        // PGRST116 = no rows found → show claim panel
        if (error?.code === "PGRST116" || !data) {
          setPageState("no-token");
          saveCache({ userId: s.user.id, readOnly: null, formData: DEFAULT_FORM, pageState: "no-token" });
        } else if (!background) {
          setFetchError((error as { message?: string } | null)?.message ?? "Failed to load token data");
          setPageState("error");
        }
        return;
      }

      const readOnly: TokenReadOnly = { name: data.name, address: data.address, symbol: data.symbol, chain: data.chain as Chain };
      const formData: Omit<TokenEditable, "headerImageFile"> = {
        description: data.description || "",
        headerImage: data.header_image || null,
        isBurn: data.is_burn ?? false,
        website: data.website || "",
        twitter: data.twitter || "",
        telegram: data.telegram || "",
      };

      setTokenReadOnly(readOnly);
      setForm({ ...formData, headerImageFile: null });
      setPageState("ready");
      saveCache({ userId: s.user.id, readOnly, formData, pageState: "ready" });
    } catch (err) {
      if (!background) {
        setFetchError(err instanceof Error ? err.message : "Failed to load token data");
        setPageState("error");
      }
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function patch(partial: Partial<TokenEditable>) {
    setForm((prev) => ({ ...prev, ...partial }));
    setSaved(false);
    setSaveError(null);
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!session || !tokenReadOnly) return;
    setSaving(true);
    setSaveError(null);

    let headerImageUrl = form.headerImage;

    if (form.headerImageFile) {
      const accessToken = session.access_token;
      const fd = new FormData();
      fd.append("file", form.headerImageFile);

      const res = await fetch("/api/dev/upload-header", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
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
      .eq("developer_id", session.user.id);

    if (saveErr) {
      setSaveError(saveErr.message);
    } else {
      patch({ headerImageFile: null, headerImage: headerImageUrl });
      setSaved(true);
      if (tokenReadOnly) {
        saveCache({
          userId: session.user.id,
          readOnly: tokenReadOnly,
          formData: {
            description: form.description,
            headerImage: headerImageUrl,
            isBurn: form.isBurn,
            website: form.website,
            twitter: form.twitter,
            telegram: form.telegram,
          },
          pageState: "ready",
        });
      }
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
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/8">
          <span className="text-xl font-bold uppercase text-white">Dev Portal</span>
        </div>
        <nav className="flex-1 px-3 py-4">
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-white/8 text-white text-sm font-medium">
            <LayoutDashboard size={16} />
            Token Info
          </button>
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
        <header className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-black/10">
          <button className="lg:hidden text-white/50 hover:text-white transition-colors" onClick={() => setSidebarOpen(true)}>
            <div className="flex flex-col gap-1">
              <span className="block w-5 h-0.5 bg-current" />
              <span className="block w-5 h-0.5 bg-current" />
              <span className="block w-5 h-0.5 bg-current" />
            </div>
          </button>

          <span className="text-white font-semibold text-sm flex-1">Token Info</span>

          {tokenReadOnly && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/30">
              <span className="font-bold text-white/60">{tokenReadOnly.symbol.toUpperCase()}</span>
              <span>·</span>
              <span className="font-mono">{tokenReadOnly.address.slice(0, 6)}…{tokenReadOnly.address.slice(-4)}</span>
              <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${CHAIN_COLOURS[tokenReadOnly.chain]}`}>
                {tokenReadOnly.chain}
              </span>
            </div>
          )}
        </header>

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
              <ClaimTokenPanel session={session} onClaimed={() => { clearCache(); fetchToken(session, false); }} />
            </motion.div>
          )}

          {/* Form */}
          {pageState === "ready" && tokenReadOnly && (
            <motion.form key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }} onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-5 py-8 flex flex-col gap-8">

                {/* Identity (read-only) */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">Token Identity</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ReadOnlyField label="Name"   value={tokenReadOnly.name} />
                    <ReadOnlyField label="Symbol" value={tokenReadOnly.symbol.toUpperCase()} />
                  </div>
                  <ReadOnlyField label="Contract Address" value={tokenReadOnly.address} mono />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-white/40 font-medium uppercase tracking-wider">
                      <Lock size={11} /> Chain
                    </div>
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 flex items-center">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest ${CHAIN_COLOURS[tokenReadOnly.chain]}`}>
                        {tokenReadOnly.chain}
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
                      value={form.description}
                      onChange={(e) => patch({ description: e.target.value })}
                      rows={4}
                      maxLength={500}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none focus:border-white/30 transition-colors"
                    />
                    <p className="text-right text-[11px] text-white/25">{form.description.length} / 500</p>
                  </div>
                  <HeaderImagePicker
                    preview={form.headerImage}
                    onChange={(file, url) => patch({ headerImageFile: file, headerImage: url })}
                    onClear={() => patch({ headerImage: null, headerImageFile: null })}
                  />
                </section>

                <div className="border-t border-white/8" />

                {/* Features */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">Features</h2>
                  <BurnToggle value={form.isBurn} onChange={(v) => patch({ isBurn: v })} />
                </section>

                <div className="border-t border-white/8" />

                {/* Links & Socials */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-white font-semibold text-base">Links & Socials</h2>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Website</FieldLabel>
                    <InputField icon={<Globe size={15} />} placeholder="https://yourtoken.io"
                      value={form.website} onChange={(v) => patch({ website: v })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>X / Twitter</FieldLabel>
                    <InputField
                      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-white/35"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
                      placeholder="yourhandle" prefix="x.com/" value={form.twitter} onChange={(v) => patch({ twitter: v })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Telegram</FieldLabel>
                    <InputField icon={<Send size={15} />} placeholder="yourchannel"
                      prefix="t.me/" value={form.telegram} onChange={(v) => patch({ telegram: v })} />
                  </div>
                </section>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 pb-4">
                  <AnimatePresence>
                    {saveError && (
                      <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="text-sm text-red-400">{saveError}</motion.p>
                    )}
                    {saved && !saveError && (
                      <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="text-sm text-green-400">Changes saved</motion.p>
                    )}
                  </AnimatePresence>
                  <div className="ml-auto">
                    <button type="submit" disabled={saving}
                      className="flex items-center justify-center gap-2 bg-white text-[#360606] font-bold text-sm rounded-xl py-3 px-6 hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                    </button>
                  </div>
                </div>

              </div>
            </motion.form>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
