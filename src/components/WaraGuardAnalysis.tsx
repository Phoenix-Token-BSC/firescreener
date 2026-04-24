"use client";

import React, { useEffect, useState } from 'react';
import { Lock, Flame, Users, Droplets, TrendingUp, ExternalLink, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface ScoreBreakdown {
    technicalSafety: number;
    liquidityHealth: number;
    onChainMaturity: number;
    holderDistribution: number;
    marketPresence: number;
}

interface WaraGuardData {
    token: {
        address: string;
        name: string;
        symbol: string;
        chain: string;
        logo: string | null;
        decimals: number;
    };
    score: {
        total: number;
        label: string;
        breakdown: ScoreBreakdown;
    };
    market: {
        price: string;
        marketCap: number;
        volume24h: number;
        liquidity: number;
        priceChange24h: number;
        source: string;
    };
    holders: {
        count: number;
        source: string;
        topHoldersUrl: string;
    };
    supply: {
        circulating: number;
        total: number;
        max: number | null;
        burned: number;
        source: string;
    };
    safety: {
        isHoneypot: boolean;
        buyTax: number;
        sellTax: number;
        hasBlacklist: boolean;
        hasMintFunction: boolean;
        ownershipRenounced: boolean;
        isContractVerified: boolean;
        hasHiddenOwner: boolean;
        source: string;
    };
    liquidity_lock: {
        status: string;
        platform: string | null;
        lockedPercent: number;
        unlockTime: string | null;
        isExpired: boolean | null;
        verifyUrl: string;
        explorerUrl: string;
    };
    meta: {
        scannedAt: string;
        chain: string;
        explorerUrl: string;
        notes: string[];
    };
}

interface WaraGuardAnalysisProps {
    chain: string;
    contractAddress: string;
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

    if (error || !data) return null;

    const { score, safety, liquidity_lock, market, holders } = data;

    const scoreColor =
        score.total >= 80 ? 'text-green-400' :
        score.total >= 50 ? 'text-yellow-400' :
        'text-red-400';

    const scoreBg =
        score.total >= 80 ? 'bg-green-500/10 border-green-500/20' :
        score.total >= 50 ? 'bg-yellow-500/10 border-yellow-500/20' :
        'bg-red-500/10 border-red-500/20';

    const ScoreBar = ({ label, value, max }: { label: string; value: number; max: number }) => (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">{label}</span>
                <span className="text-[10px] text-white font-semibold">{value}/{max}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${value / max >= 0.8 ? 'bg-green-500' : value / max >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${(value / max) * 100}%` }}
                />
            </div>
        </div>
    );

    const SafetyTag = ({
        label,
        safe,
        danger = false,
        Icon,
    }: {
        label: string;
        safe: boolean;
        danger?: boolean;
        Icon: React.ElementType;
    }) => {
        const style = safe
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : danger
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';

        return (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${style} text-[10px] md:text-xs font-medium`}>
                <Icon size={12} className="md:w-3.5 md:h-3.5" />
                <span>{label}</span>
            </div>
        );
    };

    const lockStatus = liquidity_lock.status === 'burned'
        ? 'LP Burned'
        : liquidity_lock.status === 'locked'
        ? `LP Locked ${liquidity_lock.lockedPercent.toFixed(1)}%`
        : 'LP Unlocked';

    const lockSafe = liquidity_lock.status === 'burned' || liquidity_lock.status === 'locked';

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
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${scoreBg} ${scoreColor}`}>
                        {score.total >= 80 ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                        <span>{score.total}/100</span>
                        <span className="text-[10px] font-semibold opacity-80">{score.label}</span>
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

                    {/* Score breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                        <ScoreBar label="Technical Safety" value={score.breakdown.technicalSafety} max={40} />
                        <ScoreBar label="Liquidity Health" value={score.breakdown.liquidityHealth} max={20} />
                        <ScoreBar label="On-chain Maturity" value={score.breakdown.onChainMaturity} max={15} />
                        <ScoreBar label="Holder Distribution" value={score.breakdown.holderDistribution} max={15} />
                        <ScoreBar label="Market Presence" value={score.breakdown.marketPresence} max={10} />
                    </div>

                    {/* Safety flags */}
                    <div className="flex flex-wrap gap-2">
                        <SafetyTag
                            label={safety.isHoneypot ? 'Honeypot' : 'Not a Honeypot'}
                            safe={!safety.isHoneypot}
                            danger={safety.isHoneypot}
                            Icon={safety.isHoneypot ? XCircle : CheckCircle2}
                        />
                        <SafetyTag
                            label={safety.ownershipRenounced ? 'Ownership Renounced' : 'Ownership Active'}
                            safe={safety.ownershipRenounced}
                            danger={false}
                            Icon={safety.ownershipRenounced ? CheckCircle2 : AlertTriangle}
                        />
                        <SafetyTag
                            label={safety.isContractVerified ? 'Contract Verified' : 'Contract Not Verified'}
                            safe={safety.isContractVerified}
                            danger={!safety.isContractVerified}
                            Icon={safety.isContractVerified ? CheckCircle2 : XCircle}
                        />
                        <SafetyTag
                            label={safety.hasMintFunction ? 'Mint Function' : 'No Mint Function'}
                            safe={!safety.hasMintFunction}
                            danger={safety.hasMintFunction}
                            Icon={safety.hasMintFunction ? AlertTriangle : CheckCircle2}
                        />
                        <SafetyTag
                            label={safety.hasHiddenOwner ? 'Hidden Owner' : 'No Hidden Owner'}
                            safe={!safety.hasHiddenOwner}
                            danger={safety.hasHiddenOwner}
                            Icon={safety.hasHiddenOwner ? XCircle : CheckCircle2}
                        />
                        <SafetyTag
                            label={safety.hasBlacklist ? 'Blacklist Enabled' : 'No Blacklist'}
                            safe={!safety.hasBlacklist}
                            danger={false}
                            Icon={safety.hasBlacklist ? AlertTriangle : CheckCircle2}
                        />
                        <SafetyTag
                            label={lockStatus}
                            safe={lockSafe}
                            danger={!lockSafe}
                            Icon={liquidity_lock.status === 'burned' ? Flame : Lock}
                        />
                    </div>

                    {/* Tax + stats row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-white/5">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Buy Tax</span>
                            <span className={`text-sm font-bold ${safety.buyTax > 10 ? 'text-red-400' : safety.buyTax > 5 ? 'text-yellow-400' : 'text-white'}`}>
                                {safety.buyTax}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Sell Tax</span>
                            <span className={`text-sm font-bold ${safety.sellTax > 10 ? 'text-red-400' : safety.sellTax > 5 ? 'text-yellow-400' : 'text-white'}`}>
                                {safety.sellTax}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <Users size={12} className="text-white" />
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Holders</span>
                            </div>
                            <a
                                href={holders.topHoldersUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-bold text-white flex items-center gap-1 hover:text-blue-400 transition-colors"
                            >
                                {holders.count.toLocaleString()}
                                <ExternalLink size={10} />
                            </a>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <Droplets size={12} className="text-white" />
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Liquidity</span>
                            </div>
                            <span className="text-sm font-bold text-white">
                                ${market.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    {/* LP lock detail + verify link */}
                    {liquidity_lock.lockedPercent > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp size={12} />
                                <span>LP {liquidity_lock.status === 'burned' ? 'burned' : 'locked'}: <span className="text-white font-semibold">{liquidity_lock.lockedPercent.toFixed(2)}%</span></span>
                                {liquidity_lock.platform && <span>· {liquidity_lock.platform}</span>}
                            </div>
                            <a
                                href={liquidity_lock.verifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Verify <ExternalLink size={10} />
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WaraGuardAnalysis;
