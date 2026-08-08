'use client';

import { useAdmin } from '@/contexts/AdminContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Check, X, ExternalLink } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

type Chain = 'bsc' | 'eth' | 'sol' | 'rwa';
type Status = 'pending' | 'live' | 'rejected';

interface CheckResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

interface Listing {
  id: number;
  address: string;
  symbol: string;
  name: string;
  chain: Chain;
  status: Status;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  checks: CheckResult[] | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

const TABS: { value: Status | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'live', label: 'Live' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function CheckBadge({ check }: { check: CheckResult }) {
  const Icon =
    check.status === 'pass' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
  const color =
    check.status === 'pass'
      ? 'text-green-400'
      : check.status === 'warn'
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <li className="flex items-start gap-2 py-1">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
      <span className="text-xs text-neutral-400">
        <span className="text-neutral-300 font-medium">{check.label}:</span> {check.detail}
      </span>
    </li>
  );
}

export default function AdminListingsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [tab, setTab] = useState<Status | 'all'>('pending');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) router.push('/admin/login');
  }, [isAdmin, adminLoading, router]);

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch(`/api/admin/listings?status=${tab}`);
      if (!res.ok) throw new Error('Failed to load listings');
      const data = await res.json();
      setListings(data.listings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading listings');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchListings();
  }, [isAdmin, fetchListings]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('Reason for rejecting (shown to the submitter):');
      if (input === null) return;
      reason = input;
    }

    try {
      setActing(id);
      const res = await adminFetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      await fetchListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (adminLoading || !isAdmin) return null;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/admin" className="text-sm text-neutral-500 hover:text-orange-400">
            ← Admin
          </Link>
          <h1 className="text-2xl font-bold mt-2">Token listings</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Submissions that passed every automated check are already live. These need a human.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4 mb-6 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="text-neutral-500">
            {tab === 'pending' ? 'Nothing waiting for review.' : 'Nothing here.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {listings.map((l) => (
              <li key={l.id} className="border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold">{l.name}</h2>
                      <span className="text-sm text-neutral-500 uppercase">{l.symbol}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/5 uppercase text-neutral-400">
                        {l.chain}
                      </span>
                      {l.status !== 'pending' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 capitalize text-neutral-400">
                          {l.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 font-mono mt-1 break-all">{l.address}</p>

                    <div className="flex gap-3 mt-2 flex-wrap">
                      {l.website && (
                        <a href={l.website} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-orange-400 hover:underline inline-flex items-center gap-1">
                          Website <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {l.twitter && (
                        <a href={l.twitter} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-orange-400 hover:underline inline-flex items-center gap-1">
                          X <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {l.telegram && (
                        <a href={l.telegram} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-orange-400 hover:underline inline-flex items-center gap-1">
                          Telegram <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <a
                        href={`https://dexscreener.com/${l.chain === 'sol' ? 'solana' : l.chain}/${l.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-400 hover:underline inline-flex items-center gap-1"
                      >
                        DexScreener <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {l.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => review(l.id, 'approve')}
                        disabled={acting === l.id}
                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => review(l.id, 'reject')}
                        disabled={acting === l.id}
                        className="inline-flex items-center gap-1.5 bg-neutral-800 hover:bg-red-900/50 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {l.rejection_reason && (
                  <p className="text-xs text-red-400 mt-3">Rejected: {l.rejection_reason}</p>
                )}

                {l.checks && l.checks.length > 0 && (
                  <ul className="mt-4 pt-3 border-t border-white/5">
                    {l.checks.map((c) => (
                      <CheckBadge key={c.id} check={c} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
