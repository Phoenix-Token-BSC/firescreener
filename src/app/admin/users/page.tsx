'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Shield } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/admin/login');
    }
  }, [isAdmin, adminLoading, router]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', username: '', role: 'admin' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdmins();
  }, [isAdmin]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminFetch('/api/admin/users');

      if (!response.ok) throw new Error('Failed to fetch admins');

      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add admin');
      }

      setShowForm(false);
      setFormData({ email: '', username: '', role: 'admin' });
      fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm('Are you sure you want to remove this admin?')) return;

    try {
      const response = await adminFetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete admin');

      fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting admin');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Management</h1>
            <p className="text-gray-400">Manage admin users and their permissions</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            {showForm ? 'Cancel' : 'Add Admin'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Add New Admin</h2>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Admin'}
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

        {/* Admins List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-400">Loading admins...</p>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-800 border-b border-neutral-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Name</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Role</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-gray-300 font-semibold">Joined</th>
                    <th className="px-6 py-3 text-right text-gray-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                        No admins found
                      </td>
                    </tr>
                  ) : (
                    admins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-neutral-700/30 transition-colors">
                        <td className="px-6 py-4 text-white font-medium">{admin.email}</td>
                        <td className="px-6 py-4 text-gray-400">{admin.username || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Shield size={16} className="text-orange-400" />
                            <span className="text-white capitalize">{admin.role}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              admin.is_active
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
