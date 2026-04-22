"use client";

import React, { useEffect, useState } from 'react';
import { Shield, Info, AlertTriangle, CheckCircle2, XCircle, Clock, RotateCcw, Coins, EyeOff, BarChart3, Settings, Pause, UserMinus, UserCheck, Wallet, History, Users } from 'lucide-react';

interface LPHolder {
    address: string;
    tag: string;
    percent: string;
    is_locked: number;
}

interface GoPlusSecurityData {
    trading_cooldown: string;
    can_take_back_ownership: string;
    is_mintable: string;
    hidden_owner: string;
    sell_tax: string;
    buy_tax: string;
    slippage_modifiable: string;
    personal_slippage_modifiable: string;
    transfer_pausable: string;
    is_blacklisted: string;
    is_whitelisted: string;
    is_honeypot: string;
    is_open_source: string;
    is_anti_whale: string;
    anti_whale_modifiable: string;
    creator_address: string;
    creator_balance: string;
    creator_percent: string;
    owner_address: string;
    owner_balance: string;
    owner_percent: string;
    holder_count: string;
    lp_holder_count: string;
    lp_holders: LPHolder[];
    total_supply: string;
    token_name: string;
    token_symbol: string;
}

interface GoPlusAnalysisProps {
    chain: string;
    contractAddress: string;
}

const GoPlusAnalysis: React.FC<GoPlusAnalysisProps> = ({ chain, contractAddress }) => {
    const [securityData, setSecurityData] = useState<GoPlusSecurityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        if (chain !== 'bsc' || !contractAddress) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const fetchSecurity = async () => {
            try {
                const response = await fetch(`/api/${chain}/security/${contractAddress}`);
                if (!response.ok) throw new Error('Failed to fetch security data');
                const data = await response.json();
                setSecurityData(data);
            } catch (err) {
                console.error('GoPlus analysis component error:', err);
                setError('Security analysis unavailable');
            } finally {
                setLoading(false);
            }
        };

        fetchSecurity();
    }, [chain, contractAddress]);

    if (chain !== 'bsc') return null;

    if (loading) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse mb-6">
                <div className="h-4 w-32 bg-white/10 rounded mb-4"></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 bg-white/10 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !securityData) {
        return null;
    }

    const SecurityTag = ({ label, isSafe, riskLevel = 'info', Icon = Info }: { label: string; isSafe: boolean; riskLevel?: 'info' | 'warning' | 'danger', Icon?: any }) => {
        let bgColor = "bg-white/10 border-white/20 text-white";
        if (isSafe) {
            bgColor = "bg-green-500/10 border-green-500/20 text-green-400";
        } else if (riskLevel === 'danger') {
            bgColor = "bg-red-500/10 border-red-500/20 text-red-400";
        } else if (riskLevel === 'warning') {
            bgColor = "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
        }

        return (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${bgColor} text-[10px] md:text-xs font-medium`}>
                <Icon size={12} className="md:w-3.5 md:h-3.5" />
                <span>{label}</span>
            </div>
        );
    };

    const hasCooldown = securityData.trading_cooldown === "1";
    const canRecoverOwnership = securityData.can_take_back_ownership === "1";
    const isMintable = securityData.is_mintable === "1";
    const hasHiddenOwner = securityData.hidden_owner === "1";
    const isSlippageModifiable = securityData.slippage_modifiable === "1";
    const isPausable = securityData.transfer_pausable === "1";
    const isBlacklisted = securityData.is_blacklisted === "1";
    const isWhitelisted = securityData.is_whitelisted === "1";

    const buyTax = (parseFloat(securityData.buy_tax || "0") * 100).toFixed(2);
    const sellTax = (parseFloat(securityData.sell_tax || "0") * 100).toFixed(2);
    const creatorAddress = securityData.creator_address;
    const creatorBalance = parseFloat(securityData.creator_balance || "0").toFixed(4);
    const lpHoldersCount = securityData.lp_holder_count || securityData.lp_holders?.length || 0;

    return (
        <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-200 text-left"
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-white tracking-wider">GoPlus</h3>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                        <span>Reliability</span>
                        <span className="text-green-400 font-bold">HIGH</span>
                    </div>
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            </button>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 pt-0">
                    <div className="flex flex-wrap gap-2 mb-6">
                        <SecurityTag
                            label={hasCooldown ? "Trading Cooldown" : "No Cooldown"}
                            isSafe={!hasCooldown}
                            riskLevel={hasCooldown ? 'warning' : 'info'}
                            Icon={Clock}
                        />
                        <SecurityTag
                            label={canRecoverOwnership ? "Ownership Recoverable" : "Ownership Fixed"}
                            isSafe={!canRecoverOwnership}
                            riskLevel={canRecoverOwnership ? 'danger' : 'info'}
                            Icon={RotateCcw}
                        />
                        <SecurityTag
                            label={isMintable ? "Mintable" : "Fixed Supply"}
                            isSafe={!isMintable}
                            riskLevel={isMintable ? 'warning' : 'info'}
                            Icon={Coins}
                        />
                        <SecurityTag
                            label={hasHiddenOwner ? "Hidden Owner" : "No Hidden Owner"}
                            isSafe={!hasHiddenOwner}
                            riskLevel={hasHiddenOwner ? 'danger' : 'info'}
                            Icon={EyeOff}
                        />
                        <SecurityTag
                            label={isSlippageModifiable ? "Modifiable Slippage" : "Fixed Slippage"}
                            isSafe={!isSlippageModifiable}
                            riskLevel={isSlippageModifiable ? 'warning' : 'info'}
                            Icon={Settings}
                        />
                        <SecurityTag
                            label={isPausable ? "Transfer Pausable" : "Continuous Trading"}
                            isSafe={!isPausable}
                            riskLevel={isPausable ? 'warning' : 'info'}
                            Icon={Pause}
                        />
                        <SecurityTag
                            label={isBlacklisted ? "Blacklist Enabled" : "No Blacklist"}
                            isSafe={!isBlacklisted}
                            riskLevel={isBlacklisted ? 'warning' : 'info'}
                            Icon={UserMinus}
                        />
                        <SecurityTag
                            label={isWhitelisted ? "Whitelist Enabled" : "No Whitelist"}
                            isSafe={true}
                            riskLevel="info"
                            Icon={UserCheck}
                        />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-white/5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white transition-colors">
                                <BarChart3 size={12} className="text-white" />
                                <span className="uppercase tracking-tighter">Buy / Sell Tax</span>
                            </div>
                            <span className="text-sm font-bold text-white">{buyTax}% / {sellTax}%</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                                <Wallet size={12} className="text-white" />
                                <span className="uppercase tracking-tighter">Creator Balance</span>
                            </div>
                            <span className="text-sm font-bold text-white">{creatorBalance} BNB</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                                <Users size={12} className="text-white" />
                                <span className="uppercase tracking-tighter">LP Holders</span>
                            </div>
                            <span className="text-sm font-bold text-white">{lpHoldersCount}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                                <History size={12} className="text-white" />
                                <span className="uppercase tracking-tighter">Creator</span>
                            </div>
                            <span className="text-[11px] font-bold text-white truncate max-w-[120px]" title={creatorAddress}>
                                {creatorAddress.slice(0, 6)}...{creatorAddress.slice(-4)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoPlusAnalysis;
