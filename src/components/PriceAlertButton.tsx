'use client';
import { useState } from 'react';
import { FaBell, FaBellSlash, FaTimes, FaTrash, FaRedo } from 'react-icons/fa';
import type { PriceAlert } from '@/hooks/usePriceAlerts';

interface Props {
  alerts: PriceAlert[];
  currentPrice?: string | number;
  onAdd: (type: PriceAlert['type'], threshold: number) => void;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
}

export default function PriceAlertButton({
  alerts,
  currentPrice,
  onAdd,
  onRemove,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'add' | 'list'>('add');
  const [type, setType] = useState<PriceAlert['type']>('price_above');
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState('');

  const activeCount = alerts.filter((a) => !a.triggered).length;

  function handleAdd() {
    const val = parseFloat(threshold);
    if (isNaN(val) || val <= 0) {
      setError('Enter a valid price above 0');
      return;
    }
    onAdd(type, val);
    setThreshold('');
    setError('');
    setTab('list');
  }

  function formatThreshold(n: number) {
    if (n < 0.0001) return n.toExponential(4);
    if (n < 1) return n.toFixed(6);
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  return (
    <>
      {/* Bell trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 bg-orange-950 hover:bg-orange-900 border border-orange-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
        title="Set price alert"
      >
        <FaBell size={13} />
        <span>Alert</span>
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-[#1a0f00] border border-orange-800 rounded-2xl w-full max-w-sm shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-orange-900">
              <div className="flex items-center gap-2">
                <FaBell className="text-orange-400" size={16} />
                <span className="text-white font-semibold">Price Alerts</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                <FaTimes size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-orange-900">
              <button
                onClick={() => setTab('add')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'add' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Add Alert
              </button>
              <button
                onClick={() => setTab('list')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'list' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-200'}`}
              >
                My Alerts
                {alerts.length > 0 && (
                  <span className="ml-1.5 bg-orange-900 text-orange-300 text-xs px-1.5 rounded-full">
                    {alerts.length}
                  </span>
                )}
              </button>
            </div>

            <div className="p-5">
              {tab === 'add' ? (
                <div className="space-y-4">
                  {currentPrice && (
                    <p className="text-xs text-gray-400">
                      Current price:{' '}
                      <span className="text-orange-300 font-medium">
                        ${parseFloat(String(currentPrice)).toFixed(8)}
                      </span>
                    </p>
                  )}

                  {/* Direction selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setType('price_above')}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${type === 'price_above' ? 'bg-green-600 border-green-500 text-white' : 'border-orange-800 text-gray-400 hover:border-orange-600'}`}
                    >
                      Price Above
                    </button>
                    <button
                      onClick={() => setType('price_below')}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${type === 'price_below' ? 'bg-red-700 border-red-600 text-white' : 'border-orange-800 text-gray-400 hover:border-orange-600'}`}
                    >
                      Price Below
                    </button>
                  </div>

                  {/* Threshold input */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">
                      Target Price (USD)
                    </label>
                    <div className="flex items-center gap-2 bg-black/30 border border-orange-800 rounded-lg px-3 py-2">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00000000"
                        value={threshold}
                        onChange={(e) => {
                          setThreshold(e.target.value);
                          setError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
                      />
                    </div>
                    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
                  </div>

                  <button
                    onClick={handleAdd}
                    disabled={!threshold}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    Create Alert
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <FaBellSlash size={24} className="mx-auto mb-2 opacity-40" />
                      No alerts set yet
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${alert.triggered ? 'border-gray-700 opacity-60' : 'border-orange-800'} bg-black/20`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${alert.type === 'price_above' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}
                          >
                            {alert.type === 'price_above' ? '↑' : '↓'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium">
                              {alert.type === 'price_above' ? 'Above' : 'Below'} ${formatThreshold(alert.threshold)}
                            </p>
                            {alert.triggered && (
                              <p className="text-orange-400 text-[10px]">Triggered</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {alert.triggered && (
                            <button
                              onClick={() => onReset(alert.id)}
                              title="Re-enable alert"
                              className="text-gray-400 hover:text-orange-400 transition-colors p-1"
                            >
                              <FaRedo size={11} />
                            </button>
                          )}
                          <button
                            onClick={() => onRemove(alert.id)}
                            title="Delete alert"
                            className="text-gray-400 hover:text-red-400 transition-colors p-1"
                          >
                            <FaTrash size={11} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
