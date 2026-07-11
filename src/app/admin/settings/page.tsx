'use client';

import { useAdmin } from '@/contexts/AdminContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/admin/login');
    }
  }, [isAdmin, adminLoading, router]);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Admin Settings Info */}
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-blue-400 mb-3">Admin Configuration</h2>
            <p className="text-gray-300 mb-4">
              To add or remove admin users, update the <code className="bg-neutral-800 px-2 py-1 rounded">ADMIN_EMAILS</code> environment variable:
            </p>
            <div className="bg-neutral-900 border border-neutral-700 rounded p-4 font-mono text-sm text-gray-300 mb-4 overflow-x-auto">
              ADMIN_EMAILS=admin1@example.com,admin2@example.com,admin3@example.com
            </div>
            <p className="text-gray-400 text-sm">
              Admins must have a Google account linked to their email for authentication.
            </p>
          </div>

          {/* Coming Soon Features */}
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Coming Soon</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-700/30 rounded-lg">
                <h3 className="font-semibold text-white mb-2">🔐 Security Settings</h3>
                <p className="text-gray-400 text-sm">Manage API keys, security logs, and authentication settings</p>
              </div>

              <div className="p-4 bg-neutral-700/30 rounded-lg">
                <h3 className="font-semibold text-white mb-2">🎨 Branding</h3>
                <p className="text-gray-400 text-sm">Configure reward platform branding and colors</p>
              </div>

              <div className="p-4 bg-neutral-700/30 rounded-lg">
                <h3 className="font-semibold text-white mb-2">📧 Email Notifications</h3>
                <p className="text-gray-400 text-sm">Configure email templates and notification settings</p>
              </div>

              <div className="p-4 bg-neutral-700/30 rounded-lg">
                <h3 className="font-semibold text-white mb-2">📊 Audit Logs</h3>
                <p className="text-gray-400 text-sm">View detailed activity logs and admin actions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
