"use client";

import React, { useEffect, useState } from 'react';
import { Info, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, Scale, Code } from 'lucide-react';

interface GoPlusSecurityData {
    is_honeypot: string;
    is_blacklisted: string;
    is_contract_verified: string;
    is_proxy: string;
    is_mintable: string;
    can_take_back_ownership: string;
    is_open_source: string;
    buy_tax: string;
    sell_tax: string;
    owner_address: string;
    creator_address: string;
    is_anti_whale: string;
    slippage_modifiable: string;
    personal_slippage_modifiable: string;
    selfdestruct: string;
    hidden_owner: string;
    external_call: string;
    trust_list: string;
    transfer_pausable?: string; // pausable_transfer mapping
}

interface HoneypotAnalysisProps {
    chain: string;
    contractAddress: string;
}

const HoneypotAnalysis: React.FC<HoneypotAnalysisProps> = ({ chain, contractAddress }) => {
    const [securityData, setSecurityData] = useState<GoPlusSecurityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (chain !== 'bsc' || !contractAddress) {
            setLoading(false);
            return;
        }
        const fetchSecurity = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/${chain}/security/${contractAddress}`);
                if (!response.ok) throw new Error('Failed to fetch security data');
                const data = await response.json();
                setSecurityData(data);
            } catch (err) {
                console.error('Honeypot analysis component error:', err);
                setError('Honeypot analysis unavailable');
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

    const SecurityTag = ({ label, isSafe, riskLevel = 'info' }: { label: string; isSafe: boolean; riskLevel?: 'info' | 'warning' | 'danger' }) => {
        let bgColor = "bg-white/10 border-white/20 text-white-400";
        let Icon = Info;

        if (isSafe) {
            bgColor = "bg-green-500/10 border-green-500/20 text-green-400";
            Icon = CheckCircle2;
        } else if (riskLevel === 'danger') {
            bgColor = "bg-red-500/10 border-red-500/20 text-red-400";
            Icon = XCircle;
        } else if (riskLevel === 'warning') {
            bgColor = "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
            Icon = AlertCircle;
        }

        return (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${bgColor} text-[10px] md:text-xs font-medium`}>
                <Icon size={12} className="md:w-3.5 md:h-3.5" />
                <span>{label}</span>
            </div>
        );
    };

    const isHoneypot = securityData.is_honeypot === "1";
    const isAntiWhale = securityData.is_anti_whale === "1";
    const isPausable = securityData.transfer_pausable === "1"; // transfer_pausable in GoPlus
    const isProxy = securityData.is_proxy === "1";
    const isOpenSource = securityData.is_open_source === "1";
    const hasHiddenOwner = securityData.hidden_owner === "1";
    const buyTax = parseFloat(securityData.buy_tax || "0") * 100;
    const sellTax = parseFloat(securityData.sell_tax || "0") * 100;

    return (
        <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-200 text-left"
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-md font-semibold text-white tracking-wider">Honeypot </h3>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                        <span className={`px-2 py-0.5 rounded-full ${isHoneypot ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} font-bold`}>
                            {isHoneypot ? 'RISKY' : 'GOOD'}
                        </span>
                    </div>
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            </button>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                        <SecurityTag
                            label={isHoneypot ? "HoneyPot Detected" : "No HoneyPot"}
                            isSafe={!isHoneypot}
                            riskLevel={isHoneypot ? 'danger' : 'info'}
                        />
                        <SecurityTag
                            label={isPausable ? "Transfer Pausable" : "No Pause Logic"}
                            isSafe={!isPausable}
                            riskLevel={isPausable ? 'warning' : 'info'}
                        />
                        <SecurityTag
                            label={isAntiWhale ? "Anti-Whale Active" : "No Anti-Whale"}
                            isSafe={!isAntiWhale}
                            riskLevel={isAntiWhale ? 'info' : 'info'}
                        />
                        <SecurityTag
                            label={isOpenSource ? "Open Source" : "Not Open Source"}
                            isSafe={isOpenSource}
                            riskLevel={!isOpenSource ? 'warning' : 'info'}
                        />
                        <SecurityTag
                            label={isProxy ? "Proxy Detected" : "No Proxy"}
                            isSafe={!isProxy}
                            riskLevel={isProxy ? 'warning' : 'info'}
                        />
                        <SecurityTag
                            label={hasHiddenOwner ? "Hidden Owner" : "No Hidden Owner"}
                            isSafe={!hasHiddenOwner}
                            riskLevel={hasHiddenOwner ? 'danger' : 'info'}
                        />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <Scale size={10} className="text-white" />
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Buy Tax</span>
                            </div>
                            <span className={`text-sm font-bold ${buyTax > 10 ? 'text-red-400' : 'text-green-400'}`}>
                                {buyTax.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <Scale size={10} className="text-neutral-200" />
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Sell Tax</span>
                            </div>
                            <span className={`text-sm font-bold ${sellTax > 10 ? 'text-red-400' : 'text-green-400'}`}>
                                {sellTax.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <Code size={10} className="text-neutral-200" />
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Open Source</span>
                            </div>
                            <span className="text-sm font-bold text-white uppercase">
                                {isOpenSource ? "YES" : "NO"}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                {hasHiddenOwner ? <EyeOff size={10} className="text-red-500" /> : <Eye size={10} className="text-green-500" />}
                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">Hidden Owner</span>
                            </div>
                            <span className="text-sm font-bold text-white uppercase">
                                {hasHiddenOwner ? "YES" : "NO"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HoneypotAnalysis;
