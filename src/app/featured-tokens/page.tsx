'use client';

import React, { useState, useEffect } from 'react';

interface FeaturedToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  addedAt: string;
  daysActive: number;
  expiresAt: string;
}

export default function FeaturedTokensPage() {
  const [tokens, setTokens] = useState<FeaturedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    address: '',
    daysActive: 7,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchFeaturedTokens();
  }, []);

  const fetchFeaturedTokens = async () => {
    try {
      const response = await fetch('/api/featured-tokens');
      if (!response.ok) throw new Error('Failed to fetch featured tokens');
      const data = await response.json();
      setTokens(data);
    } catch (error) {
      console.error('Error fetching featured tokens:', error);
      setMessage({ type: 'error', text: 'Failed to load featured tokens' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!form.address.trim()) {
      setMessage({ type: 'error', text: 'Please enter a token address' });
      setLoading(false);
      return;
    }

    if (form.daysActive < 1 || form.daysActive > 90) {
      setMessage({ type: 'error', text: 'Days must be between 1 and 90' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/featured-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: form.address.trim(),
          daysActive: parseInt(form.daysActive.toString()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add featured token');
      }

      setMessage({ type: 'success', text: `${data.symbol} added successfully!` });
      setForm({ address: '', daysActive: 7 });
      await fetchFeaturedTokens();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error adding token' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (address: string, symbol: string) => {
    if (!confirm(`Remove ${symbol} from featured tokens?`)) return;

    try {
      const response = await fetch(`/api/featured-tokens?address=${address}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove token');

      setMessage({ type: 'success', text: `${symbol} removed` });
      await fetchFeaturedTokens();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove token' });
    }
  };

  const getDaysRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="p-4">
        <h1 className="text-white text-3xl font-bold mb-2">Featured Tokens</h1>
        <p className="text-gray-400 mb-6">Boost tokens to appear in the trending list (token details auto-fetched from registry)</p>

        {/* Add Token Form */}
        <div className="bg-orange-900/20 border border-orange-500 rounded-lg p-6 mb-8">
          <h2 className="text-white text-xl font-semibold mb-4">Add Featured Token</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Token Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Paste token address (e.g., 0x... or Solana address)"
                className="w-full px-4 py-2 bg-black border border-orange-500 rounded text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
                required
              />
              <p className="text-gray-400 text-xs mt-2">Token details (symbol, name, chain) will be auto-fetched from registry</p>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Days Active (1-90)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={form.daysActive}
                onChange={(e) => setForm({ ...form, daysActive: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-black border border-orange-500 rounded text-white focus:outline-none focus:border-orange-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-700 text-white font-semibold py-2 rounded transition-colors"
            >
              {loading ? 'Adding...' : 'Add Featured Token'}
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded ${
                message.type === 'success'
                  ? 'bg-green-900/50 border border-green-500 text-green-200'
                  : 'bg-red-900/50 border border-red-500 text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Featured Tokens List */}
        <div className="bg-black/50 border border-orange-500 rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-white text-xl font-semibold mb-4">Active Featured Tokens ({tokens.length})</h2>

            {tokens.length === 0 ? (
              <p className="text-gray-400">No active featured tokens</p>
            ) : (
              <div className="space-y-3">
                {tokens.map((token) => (
                  <div
                    key={token.address}
                    className="flex items-center justify-between bg-orange-900/20 border border-orange-500/50 rounded p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-white font-semibold">{token.symbol}</p>
                          <p className="text-gray-400 text-xs">{token.name}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <p className="text-gray-300">Chain: <span className="text-orange-400 font-medium">{token.chain.toUpperCase()}</span></p>
                        <p className="text-gray-300">Address: <span className="text-gray-400 text-xs font-mono">{token.address.slice(0, 10)}...{token.address.slice(-8)}</span></p>
                        <p className="text-gray-300">
                          Expires in: <span className="text-orange-400 font-semibold">{getDaysRemaining(token.expiresAt)} days</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(token.address, token.symbol)}
                      className="ml-4 px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-500 rounded transition-colors whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
