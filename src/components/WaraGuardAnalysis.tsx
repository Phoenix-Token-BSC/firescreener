"use client";

import React, { useEffect, useState } from 'react';
import { Lock, Flame, Clock, ExternalLink, ShieldCheck, ShieldAlert, TrendingUp, TrendingDown, Droplets } from 'lucide-react';

interface ProofLink {
    label: string;
    url: string;
}

interface WaraGuardData {
    meta?: {
        chain?: string;
        token?: string;
        pairAddress?: string;
        dexId?: string;
        fetchedAt?: string;
    };
    tokenAge?: {
        createdAt?: string | null;
        ageDays?: number | null;
        confidence?: string;
        label?: string;
        notes?: string[];
    };
    buySell?: {
        buysCount?: number;
        sellsCount?: number;
        buyVolumeUsd?: number;
        sellVolumeUsd?: number;
        dominantSide?: string;
        notes?: string[];
    };
    liquidity?: {
        status?: string;
        lockerName?: string | null;
        unlockDate?: string | null;
        percentLocked?: number | null;
        proofLinks?: ProofLink[];
        signals?: string[];
        notes?: string[];
    };
}

interface WaraGuardAnalysisProps {
    chain: string;
    contractAddress: string;
}

function formatUsd(value: number): string {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
}

const WaraGuardAnalysis: React.FC<WaraGuardAnalysisProps> = ({ chain, contractAddress }) => {
    const [data, setData] = useState<WaraGuardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!chain || !contractAddress) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/${chain}/waraguard?address=${contractAddress}`);
                if (!res.ok) throw new Error('Failed to fetch WaraGuard data');
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error('WaraGuard analysis error:', err);
                setError('WaraGuard analysis unavailable');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [chain, contractAddress]);

    if (loading) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse mb-6">
                <div className="h-4 w-36 bg-white/10 rounded mb-4"></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 bg-white/10 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    const liquidity = data?.liquidity;
    const tokenAge = data?.tokenAge;
    const buySell = data?.buySell;

    // Hide the card entirely if the payload has none of the sections we render
    if (error || (!liquidity && !tokenAge && !buySell)) return null;

    const lockStatus = (liquidity?.status || 'UNKNOWN').toUpperCase();
    const percentLocked = typeof liquidity?.percentLocked === 'number' ? liquidity.percentLocked : null;
    const lockSafe = lockStatus === 'BURNED' || lockStatus === 'LOCKED';

    const lockLabel =
        lockStatus === 'BURNED' ? 'LP Burned'
        : lockStatus === 'LOCKED' ? 'LP Locked'
        : lockStatus === 'UNKNOWN' ? 'LP Status Unknown'
        : 'LP Unlocked';

    const badgeStyle = lockSafe
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : lockStatus === 'UNKNOWN'
        ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400';

    const buys = buySell?.buysCount ?? 0;
    const sells = buySell?.sellsCount ?? 0;
    const buyVol = buySell?.buyVolumeUsd ?? 0;
    const sellVol = buySell?.sellVolumeUsd ?? 0;
    const totalVol = buyVol + sellVol;
    const buyShare = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;

    const listedDate = tokenAge?.createdAt
        ? new Date(tokenAge.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : null;

    return (
        <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-200 text-left"
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-white tracking-wider">WaraGuard</h3>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${badgeStyle}`}>
                        {lockSafe ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                        <span>{lockLabel}</span>
                        {percentLocked !== null && percentLocked > 0 && (
                            <span className="text-[10px] font-semibold opacity-80">{percentLocked.toFixed(0)}%</span>
                        )}
                    </div>
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            </button>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 pt-0 space-y-5">

                    {/* Liquidity security */}
                    {liquidity && (
                        <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-tighter">
                                    <Droplets size={12} />
                                    <span>Liquidity Security</span>
                                </div>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium ${badgeStyle}`}>
                                    {lockStatus === 'BURNED' ? <Flame size={11} /> : <Lock size={11} />}
                                    <span>
                                        {lockLabel}
                                        {percentLocked !== null && percentLocked > 0 ? ` · ${percentLocked.toFixed(1)}%` : ''}
                                    </span>
                                </div>
                            </div>
                            {liquidity.lockerName && (
                                <p className="text-[11px] text-neutral-400">
                                    Locker: <span className="text-white font-medium">{liquidity.lockerName}</span>
                                    {liquidity.unlockDate && (
                                        <> · Unlocks <span className="text-white font-medium">{new Date(liquidity.unlockDate).toLocaleDateString()}</span></>
                                    )}
                                </p>
                            )}
                            {(liquidity.notes ?? []).map((note, i) => (
                                <p key={i} className="text-[11px] text-neutral-400">{note}</p>
                            ))}
                            {(liquidity.proofLinks ?? []).map((link, i) => (
                                <a
                                    key={i}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors mr-3"
                                >
                                    {link.label} <ExternalLink size={10} />
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Buy/Sell pressure */}
                    {buySell && (buys > 0 || sells > 0) && (
                        <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Buy / Sell Pressure (24h)</span>
                                {buySell.dominantSide && (
                                    <span className={`flex items-center gap-1 text-[10px] font-bold ${buySell.dominantSide === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                        {buySell.dominantSide === 'BUY' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                        {buySell.dominantSide} DOMINANT
                                    </span>
                                )}
                            </div>
                            <div className="h-1.5 bg-red-500/40 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${buyShare}%` }} />
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-green-400 font-medium">{buys} buys · {formatUsd(buyVol)}</span>
                                <span className="text-red-400 font-medium">{sells} sells · {formatUsd(sellVol)}</span>
                            </div>
                        </div>
                    )}

                    {/* Token age */}
                    {tokenAge && (listedDate || typeof tokenAge.ageDays === 'number') && (
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-tighter">
                                <Clock size={12} />
                                <span>{tokenAge.label || 'Listed Since'}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold text-white">
                                    {listedDate ?? 'Unknown'}
                                </span>
                                {typeof tokenAge.ageDays === 'number' && (
                                    <span className="text-[11px] text-neutral-400 ml-2">({tokenAge.ageDays} days)</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WaraGuardAnalysis;
