"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoadingWithLogo from "@/components/LoadingWithLogo";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Clock, ImagePlus, X } from "lucide-react";

type Chain = "bsc" | "eth" | "sol" | "rwa";

interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

interface Submission {
  id: number;
  address: string;
  symbol: string;
  name: string;
  chain: Chain;
  status: "pending" | "live" | "rejected";
  submitted_at: string | null;
  rejection_reason: string | null;
}

interface SubmitOutcome {
  kind: "live" | "pending" | "rejected";
  message: string;
  checks: CheckResult[];
  warnings: string[];
}

/** Result of the as-you-type contract lookup. */
interface Lookup {
  state: "idle" | "loading" | "found" | "error";
  name?: string;
  symbol?: string;
  liquidityUsd?: number;
  pairCount?: number;
  error?: string;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const CHAINS: { value: Chain; label: string }[] = [
  { value: "bsc", label: "BNB Chain" },
  { value: "eth", label: "Ethereum" },
  { value: "sol", label: "Solana" },
  { value: "rwa", label: "AssetChain (RWA)" },
];

const STATUS_STYLES: Record<Submission["status"], string> = {
  live: "bg-green-500/15 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

function CheckRow({ check }: { check: CheckResult }) {
  const Icon =
    check.status === "pass" ? CheckCircle2 : check.status === "warn" ? AlertTriangle : XCircle;
  const color =
    check.status === "pass"
      ? "text-green-400"
      : check.status === "warn"
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <li className="flex items-start gap-3 py-2">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <span className="text-sm font-medium text-white">{check.label}</span>
        <p className="text-xs text-neutral-400 break-words">{check.detail}</p>
      </div>
    </li>
  );
}

export default function NewListing() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isDev, setIsDev] = useState(false);

  const [chain, setChain] = useState<Chain>("bsc");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [isBurn, setIsBurn] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);

  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  // Identifies the newest lookup so a slow earlier response cannot overwrite it.
  const lookupSeq = useRef(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorChecks, setErrorChecks] = useState<CheckResult[]>([]);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [mine, setMine] = useState<Submission[]>([]);

  const loadMine = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch("/api/listings", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMine(data.listings ?? []);
    } catch {
      /* the list is supplementary — a failure here should not break the form */
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsDev(!!session);
      setCheckingAuth(false);
      if (session) loadMine();
    });
  }, [loadMine]);

  // Resolve the contract's real name and symbol as it is pasted, so the developer does
  // not type them by hand (and cannot mistype them). Debounced — this fires on every
  // keystroke otherwise.
  useEffect(() => {
    const trimmed = address.trim();
    if (!isDev || trimmed.length < 32) {
      setLookup({ state: "idle" });
      return;
    }

    const seq = ++lookupSeq.current;
    setLookup({ state: "loading" });

    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(
          `/api/listings/lookup?chain=${chain}&address=${encodeURIComponent(trimmed)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const data = await res.json();

        // A newer keystroke has already superseded this request.
        if (seq !== lookupSeq.current) return;

        if (data.alreadyListed) {
          setLookup({ state: "error", error: data.message });
          return;
        }
        if (!res.ok || !data.found) {
          setLookup({ state: "error", error: data.error ?? "Could not find this token." });
          return;
        }

        setLookup({
          state: "found",
          name: data.name,
          symbol: data.symbol,
          liquidityUsd: data.liquidityUsd,
          pairCount: data.pairCount,
        });
        // Prefill, but leave both editable — the developer has the final say.
        setName((prev) => prev || data.name);
        setSymbol((prev) => prev || data.symbol);
      } catch {
        if (seq === lookupSeq.current) {
          setLookup({ state: "error", error: "Lookup failed. You can still submit." });
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [address, chain, isDev]);

  // Object URLs must be revoked or each re-pick leaks one.
  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (!headerFile) { setHeaderPreview(null); return; }
    const url = URL.createObjectURL(headerFile);
    setHeaderPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [headerFile]);

  function pickImage(file: File | null, setter: (f: File | null) => void, label: string) {
    if (!file) { setter(null); return; }
    // Validated here as well as server-side so the user finds out immediately.
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError(`${label} must be a PNG, JPEG or WEBP.`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`${label} exceeds the 2 MB limit.`);
      return;
    }
    setError(null);
    setter(file);
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorChecks([]);
    setOutcome(null);

    if (!address.trim()) {
      setError("Enter the token's contract address.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/dev/auth");
        return;
      }

      // multipart, not JSON — the logo and header ride along with the submission so the
      // whole listing is one request.
      const fd = new FormData();
      fd.append("address", address.trim());
      fd.append("chain", chain);
      fd.append("isBurn", String(isBurn));
      if (name.trim()) fd.append("name", name.trim());
      if (symbol.trim()) fd.append("symbol", symbol.trim());
      if (description.trim()) fd.append("description", description.trim());
      if (website.trim()) fd.append("website", website.trim());
      if (twitter.trim()) fd.append("twitter", twitter.trim());
      if (telegram.trim()) fd.append("telegram", telegram.trim());
      if (logoFile) fd.append("logo", logoFile);
      if (headerFile) fd.append("header", headerFile);

      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        setErrorChecks(data.checks ?? []);
        return;
      }

      setOutcome({
        kind: data.status === "live" ? "live" : "pending",
        message:
          data.status === "live"
            ? `${data.token.name} passed every check and is live on FireScreener now.`
            : `${data.token.name} has been submitted. Our team reviews flagged tokens, usually within 24 hours.`,
        checks: data.checks ?? [],
        warnings: data.warnings ?? [],
      });

      setAddress("");
      setName("");
      setSymbol("");
      setDescription("");
      setWebsite("");
      setTwitter("");
      setTelegram("");
      setIsBurn(false);
      setLogoFile(null);
      setHeaderFile(null);
      setLookup({ state: "idle" });
      loadMine();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) return <LoadingWithLogo />;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center mb-10">
          <Image
            src="/images/firescreener-mock.png"
            alt="Firescreener data mockup"
            width={400}
            height={400}
            className="pb-4 w-64 h-auto"
          />
          <h1 className="font-bold text-3xl md:text-5xl">LIST YOUR TOKEN</h1>
          <p className="text-lg text-neutral-400 mt-2">
            Submit your contract and we&apos;ll run the checks automatically. Tokens that pass
            go live immediately.
          </p>
        </div>

        {!isDev ? (
          <div className="border border-orange-500/30 bg-orange-500/5 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">A developer account is required</h2>
            <p className="text-neutral-400 mb-6">
              Listing is open to project teams. Create a free developer account — it takes a
              minute — and you&apos;ll also be able to manage your token&apos;s profile afterwards.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dev/auth"
                className="bg-orange-500 px-8 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                Sign up or log in
              </Link>
              <Link
                href="https://wa.me/2348161670217"
                className="border border-orange-500 px-8 py-2.5 rounded-xl font-semibold hover:bg-orange-500/10 transition-colors"
              >
                Talk to us instead
              </Link>
            </div>
          </div>
        ) : outcome ? (
          <div
            className={`border rounded-xl p-8 ${
              outcome.kind === "live"
                ? "border-green-500/30 bg-green-500/5"
                : "border-yellow-500/30 bg-yellow-500/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              {outcome.kind === "live" ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <Clock className="w-6 h-6 text-yellow-400" />
              )}
              <h2 className="text-xl font-semibold">
                {outcome.kind === "live" ? "Your token is live" : "Submitted for review"}
              </h2>
            </div>
            <p className="text-neutral-300 mb-6">{outcome.message}</p>

            {/* The listing succeeded but an image did not save — worth saying plainly
                rather than letting them discover the missing logo later. */}
            {outcome.warnings.length > 0 && (
              <ul className="mb-6 space-y-2">
                {outcome.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-yellow-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            )}

            {outcome.checks.length > 0 && (
              <ul className="divide-y divide-white/5 border-t border-white/5 pt-2 mb-6">
                {outcome.checks.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </ul>
            )}

            <button
              onClick={() => setOutcome(null)}
              className="bg-orange-500 px-6 py-2 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              Submit another token
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="chain" className="block text-sm font-medium mb-2">
                Chain
              </label>
              <select
                id="chain"
                value={chain}
                onChange={(e) => setChain(e.target.value as Chain)}
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none"
              >
                {CHAINS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium mb-2">
                Contract address
              </label>
              <input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={chain === "sol" ? "Base58 mint address" : "0x…"}
                spellCheck={false}
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 font-mono text-sm focus:border-orange-500 focus:outline-none"
              />
              {/* Live feedback on the pasted contract */}
              {lookup.state === "loading" && (
                <p className="text-xs text-neutral-500 mt-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Looking up this contract…
                </p>
              )}
              {lookup.state === "found" && (
                <p className="text-xs text-green-400 mt-2 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" />
                  Found {lookup.name} ({lookup.symbol})
                  {lookup.liquidityUsd != null &&
                    ` · $${Math.round(lookup.liquidityUsd).toLocaleString()} liquidity`}
                  {lookup.pairCount != null &&
                    ` · ${lookup.pairCount} pair${lookup.pairCount === 1 ? "" : "s"}`}
                </p>
              )}
              {lookup.state === "error" && (
                <p className="text-xs text-yellow-400 mt-2 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  {lookup.error}
                </p>
              )}
              {lookup.state === "idle" && (
                <p className="text-xs text-neutral-500 mt-2">
                  Paste the address and we&apos;ll pull the name and symbol automatically.
                </p>
              )}
            </div>

            {/* Prefilled from the lookup, but editable — the team has the final say on
                how their token is presented. */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Token name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-filled from the contract"
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="symbol" className="block text-sm font-medium mb-2">
                  Symbol
                </label>
                <input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="Auto-filled"
                  spellCheck={false}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 text-sm uppercase focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description <span className="text-neutral-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder="What is your project about?"
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 text-sm resize-y focus:border-orange-500 focus:outline-none"
              />
              <p className="text-xs text-neutral-500 mt-1.5 text-right">
                {description.length}/1000
              </p>
            </div>

            {/* Artwork */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Logo <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                {logoPreview ? (
                  <div className="relative border border-white/10 rounded-lg p-4 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded-full object-cover" />
                    <span className="text-xs text-neutral-400 truncate flex-1">{logoFile?.name}</span>
                    <button
                      type="button"
                      onClick={() => setLogoFile(null)}
                      className="text-neutral-500 hover:text-white shrink-0"
                      aria-label="Remove logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-white/15 rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-500/50 transition-colors">
                    <ImagePlus className="w-5 h-5 text-neutral-500" />
                    <span className="text-xs text-neutral-500">Square PNG/JPEG/WEBP, max 2 MB</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => pickImage(e.target.files?.[0] ?? null, setLogoFile, "Logo")}
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Header image <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                {headerPreview ? (
                  <div className="relative border border-white/10 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headerPreview} alt="Header preview" className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => setHeaderFile(null)}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white/80 hover:text-white"
                      aria-label="Remove header image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-white/15 rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-500/50 transition-colors">
                    <ImagePlus className="w-5 h-5 text-neutral-500" />
                    <span className="text-xs text-neutral-500">Wide banner, max 2 MB</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => pickImage(e.target.files?.[0] ?? null, setHeaderFile, "Header image")}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {([
                ["Website", website, setWebsite, "yourproject.com"],
                ["X / Twitter", twitter, setTwitter, "x.com/yourproject"],
                ["Telegram", telegram, setTelegram, "t.me/yourproject"],
              ] as const).map(([label, value, setter, placeholder]) => (
                <div key={label}>
                  <label className="block text-sm font-medium mb-2">
                    {label} <span className="text-neutral-500 font-normal">(optional)</span>
                  </label>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    spellCheck={false}
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isBurn}
                onChange={(e) => setIsBurn(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm">This token has a burn mechanism</span>
            </label>

            {error && (
              <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
                {errorChecks.length > 0 && (
                  <ul className="mt-3 pt-3 border-t border-red-500/20">
                    {errorChecks.map((c) => (
                      <CheckRow key={c.id} check={c} />
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-500 py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running checks…
                </>
              ) : (
                "Submit for listing"
              )}
            </button>
          </form>
        )}

        {isDev && mine.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold mb-4">Your submissions</h2>
            <ul className="space-y-2">
              {mine.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-4 border border-white/10 rounded-lg px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.name}{" "}
                      <span className="text-neutral-500 uppercase text-sm">{s.symbol}</span>
                    </p>
                    <p className="text-xs text-neutral-500 font-mono truncate">{s.address}</p>
                    {s.status === "rejected" && s.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1">{s.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.status === "live" && (
                      <Link
                        href={`/${s.chain}/${s.address}`}
                        className="text-xs text-orange-400 hover:underline"
                      >
                        View
                      </Link>
                    )}
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border capitalize ${STATUS_STYLES[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
