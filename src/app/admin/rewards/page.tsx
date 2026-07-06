'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import Link from 'next/link';

interface Reward {
  id: string;
  name: string;
  description: string;
  type: 'fcfs' | 'ticket' | 'instant';
  cost: number;
  stock?: number;
  icon: string;
  color: string;
  badge?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminRewardsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/admin/login');
    }
  }, [isAdmin, adminLoading, router]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'instant' as const,
    cost: 100,
    stock: 10,
    icon: '🎁',
    color: 'orange',
    badge: '',
  });

  useEffect(() => {
    if (!isAdmin) return;
    fetchRewards();
  }, [isAdmin]);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const response = await adminFetch('/api/admin/rewards');

      if (!response.ok) throw new Error('Failed to fetch rewards');

      const data = await response.json();
      setRewards(data.rewards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/admin/rewards/${editingId}` : '/api/admin/rewards';
      const method = editingId ? 'PUT' : 'POST';

      const response = await adminFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save reward');

      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        type: 'instant',
        cost: 100,
        stock: 10,
        icon: '🎁',
        color: 'orange',
        badge: '',
      });
      fetchRewards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving reward');
    }
  };

  const handleEdit = (reward: Reward) => {
    setFormData({
      name: reward.name,
      description: reward.description,
      type: reward.type,
      cost: reward.cost,
      stock: reward.stock || 10,
      icon: reward.icon,
      color: reward.color,
      badge: reward.badge || '',
    });
    setEditingId(reward.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;

    try {
      setDeleting(id);
      const response = await adminFetch(`/api/admin/rewards/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete reward');

      fetchRewards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting reward');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Manage Rewards</h1>
            <p className="text-gray-400">Create, edit, and manage reward offerings</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name: '',
                description: '',
                type: 'instant',
                cost: 100,
                stock: 10,
                icon: '🎁',
                color: 'orange',
                badge: '',
              });
            }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            {showForm ? 'Cancel' : 'New Reward'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">{editingId ? 'Edit' : 'Create'} Reward</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                  >
                    <option value="instant">Instant</option>
                    <option value="fcfs">FCFS</option>
                    <option value="ticket">Ticket</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cost (Points)</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                {formData.type === 'fcfs' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Stock</label>
                    <input
                      type="number"
                      value={formData.stock || ''}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Icon (Emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Color</label>
                  <select
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                  >
                    <option value="orange">Orange</option>
                    <option value="purple">Purple</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Badge (Optional)</label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    placeholder="e.g., HOT, LIMITED"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
                >
                  {editingId ? 'Update Reward' : 'Create Reward'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Rewards List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-400">Loading rewards...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {rewards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No rewards yet. Create one to get started!</p>
              </div>
            ) : (
              rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6 flex items-center justify-between hover:border-neutral-600 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-4xl">{reward.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-white">{reward.name}</h3>
                      <p className="text-gray-400 text-sm">{reward.description}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-neutral-700 text-gray-300 px-2 py-1 rounded">
                          {reward.type}
                        </span>
                        <span className="text-xs bg-neutral-700 text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                          💰 {reward.cost} points
                        </span>
                        {reward.stock && (
                          <span className="text-xs bg-neutral-700 text-blue-400 px-2 py-1 rounded">
                            Stock: {reward.stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(reward)}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(reward.id)}
                      disabled={deleting === reward.id}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
