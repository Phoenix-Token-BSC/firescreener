'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { FiGlobe, FiHome, FiTrendingUp, FiZap, FiBookmark, FiPlus, FiExternalLink, FiActivity } from 'react-icons/fi';
import { TOKEN_REGISTRY, getTokensBySymbol, getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface Suggestion {
  fullName: string;
  symbol: string;
  chain: string;
  address: string;
}

const MAX_SUGGESTIONS = 15;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getActiveChain = (): string | null => {
    const path = pathname?.toLowerCase() || '';
    if (path.startsWith('/bsc')) return 'bsc';
    if (path.startsWith('/eth')) return 'eth';
    if (path.startsWith('/rwa')) return 'rwa';
    if (path.startsWith('/sol')) return 'sol';
    return null;
  };

  const activeChain = getActiveChain();

  const getChainInfo = (chain: string | null) => {
    if (!chain) return { name: 'All Chains', logo: null };
    const chainInfo: { [key: string]: { name: string; logo: string | null } } = {
      bsc: { name: 'BSC', logo: '/bsc-logo.png' },
      eth: { name: 'Ethereum', logo: '/eth-logo.png' },
      rwa: { name: 'RWA Chain', logo: '/rwa-logo.png' },
      sol: { name: 'Solana', logo: '/sol-logo.png' },
    };
    return chainInfo[chain] || { name: 'All Chains', logo: null };
  };

  const currentChainInfo = getChainInfo(activeChain);

  const isActive = (href: string) => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  const handleSearch = (tokenFromSearchBar: string = search): void => {
    const raw = tokenFromSearchBar.trim();
    const q = raw.toLowerCase();
    if (!q) return;

    const looksLikeBscOrEth = isValidContractAddress(raw, 'bsc') || isValidContractAddress(raw, 'eth');
    const looksLikeRwa = isValidContractAddress(raw, 'rwa');
    const looksLikeSol = isValidContractAddress(raw, 'sol');

    if (looksLikeBscOrEth || looksLikeRwa || looksLikeSol) {
      const match = getTokenByAddress(raw) || getTokenByAddress(q);
      if (match) {
        router.push(`/${match.chain}/${match.address}`);
        return;
      }
      if (looksLikeSol) {
        router.push(`/sol/${raw}`);
        return;
      }
      if (activeChain) {
        router.push(`/${activeChain}/${raw}`);
        return;
      }
      router.push(`/bsc/${raw}`);
      return;
    }

    const active = (activeChain ?? undefined) as 'bsc' | 'sol' | 'rwa' | 'eth' | undefined;
    let candidates = getTokensBySymbol(q);

    if (candidates.length === 0) {
      const byName = TOKEN_REGISTRY.filter(t => t.name.toLowerCase().includes(q));
      candidates = byName;
    }

    if (candidates.length > 0) {
      const exactInActive = active
        ? candidates.find(t => t.chain === active && t.symbol.toLowerCase() === q)
        : undefined;
      const exactSymbol = candidates.find(t => t.symbol.toLowerCase() === q);
      const inActive = active ? candidates.find(t => t.chain === active) : undefined;
      const chosen =
        exactInActive ||
        exactSymbol ||
        inActive ||
        candidates.find(t => t.chain === 'bsc') ||
        candidates[0];
      router.push(`/${chosen.chain}/${chosen.address}`);
      return;
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    const q = value.trim().toLowerCase();
    const active = (activeChain ?? undefined) as 'bsc' | 'sol' | 'rwa' | 'eth' | undefined;

    const filtered = TOKEN_REGISTRY
      .filter(t =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
      )
      .sort((a, b) => {
        const score = (t: typeof a) =>
          (active && t.chain === active ? 100 : 0) + (t.chain === 'bsc' ? 10 : 0);
        return score(b) - score(a);
      })
      .slice(0, MAX_SUGGESTIONS)
      .map(t => ({
        fullName: t.name,
        symbol: t.symbol,
        chain: t.chain,
        address: t.address,
      }));

    setSuggestions(filtered);
  };

  const onSuggestionClick = (suggestion: Suggestion) => {
    if (!suggestion?.address || !suggestion?.chain) return;
    setSearch(suggestion.symbol.toUpperCase());
    router.push(`/${suggestion.chain}/${suggestion.address}`);
    setSuggestions([]);
  };

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:bg-neutral-900 md:border-r md:border-orange-500/30 md:overflow-y-auto md:h-screen">
      {/* Logo Section */}
      <div className="p-4 border-b border-orange-500/30">
        <Link href="/" className="flex items-center gap-2 font-bold text-white hover:opacity-80">
          <Image
            src="/logo-fixed.png"
            alt="FireScreener Logo"
            width={28}
            height={28}
          />
          <span className="text-sm">FIRESCREENER</span>
        </Link>
      </div>

      {/* Search Section */}
      <div className="p-4 border-b border-orange-500/30">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={onChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            className="w-full pl-9 pr-3 py-2 bg-neutral-800 text-white text-sm border border-orange-500/30 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
          />

          {/* Search Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-orange-500/30 rounded-lg shadow-lg z-50">
              <ul className="max-h-40 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => onSuggestionClick(suggestion)}
                    className="px-3 py-2 hover:bg-orange-500/20 cursor-pointer text-sm border-b border-orange-500/10 last:border-b-0"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-white font-medium">{suggestion.symbol.toUpperCase()}</span>
                        <span className="text-gray-400 text-xs ml-2">{suggestion.fullName}</span>
                      </div>
                      <span className="text-gray-500 text-xs">{suggestion.chain.toUpperCase()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Chain Selector - List View */}
      <div className="p-4 border-b border-orange-500/30">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Chains</p>
        <div className="space-y-2">
          {[
            { href: '/', name: 'All Chains', logo: null, key: 'all' },
            { href: '/bsc', name: 'BSC', logo: '/bsc-logo.png', key: 'bsc' },
            { href: '/eth', name: 'Ethereum', logo: '/eth-logo.png', key: 'eth' },
            { href: '/rwa', name: 'RWA Chain', logo: '/rwa-logo.png', key: 'rwa' },
            { href: '/sol', name: 'Solana', logo: '/sol-logo.png', key: 'sol' },
          ].map((chain) => (
            <Link
              key={chain.key}
              href={chain.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                (chain.key === 'all' ? !activeChain : activeChain === chain.key)
                  ? 'bg-orange-500/20 text-orange-400 font-medium'
                  : 'text-gray-300 hover:bg-orange-500/10'
              }`}
            >
              {chain.logo ? (
                <Image src={chain.logo} alt={chain.name} width={16} height={16} className="rounded-sm flex-shrink-0" />
              ) : (
                <FiGlobe className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{chain.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Navigation</p>
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            isActive('/')
              ? 'bg-orange-500/20 text-orange-400 font-medium'
              : 'text-gray-300 hover:bg-orange-500/10'
          }`}
        >
          <FiHome className="h-4 w-4" />
          <span>Home</span>
        </Link>

        <Link
          href="/trending"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            isActive('/trending')
              ? 'bg-orange-500/20 text-orange-400 font-medium'
              : 'text-gray-300 hover:bg-orange-500/10'
          }`}
        >
          <FiActivity className="h-4 w-4" />
          <span>Trending</span>
        </Link>

        <Link
          href="/price-predict"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            isActive('/price-predict')
              ? 'bg-orange-500/20 text-orange-400 font-medium'
              : 'text-gray-300 hover:bg-orange-500/10'
          }`}
        >
          <FiTrendingUp className="h-4 w-4" />
          <span>Price Predict</span>
        </Link>

        <Link
          href="/gains"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            isActive('/gains')
              ? 'bg-orange-500/20 text-orange-400 font-medium'
              : 'text-gray-300 hover:bg-orange-500/10'
          }`}
        >
          <FiZap className="h-4 w-4" />
          <span>Gains</span>
        </Link>

        <Link
          href="/watchlist"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            isActive('/watchlist')
              ? 'bg-orange-500/20 text-orange-400 font-medium'
              : 'text-gray-300 hover:bg-orange-500/10'
          }`}
        >
          <FiBookmark className="h-4 w-4" />
          <span>Watchlist</span>
        </Link>

        <Link
          href="/new-listing"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
            isActive('/new-listing')
              ? 'bg-orange-500/20 text-orange-400 font-medium'
              : 'text-gray-300 hover:bg-orange-500/10'
          }`}
        >
          <FiPlus className="h-4 w-4" />
          <span>List Token</span>
        </Link>
      </nav>

      {/* Footer Links */}
      <div className="p-4 border-t border-orange-500/30 space-y-2">
        <Link
          href="https://www.phoenixtoken.community"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm text-gray-300 hover:bg-orange-500/10"
        >
          <FiExternalLink className="h-4 w-4" />
          <span>Token Community</span>
        </Link>
      </div>
    </aside>
  );
}
