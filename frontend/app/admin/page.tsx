'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, BarChart3, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { User } from '../../types/api';

interface Stats {
  total_users: number;
  daily_active_users: number;
  total_saved_articles: number;
}

interface CacheEntry {
  url: string;
  source: string;
  updated_at?: string | null;
  has_html: boolean;
  has_text: boolean;
  has_summary: boolean;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [cacheUrl, setCacheUrl] = useState('');
  const [cacheLoading, setCacheLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const fetchData = useCallback(async (headers: HeadersInit) => {
      // Fetch Stats
      const statsRes = await fetch(`${apiUrl}/api/admin/stats`, { headers });
      if (statsRes.ok) setStats(await statsRes.json());

      // Fetch Users
      const usersRes = await fetch(`${apiUrl}/api/admin/users`, { headers });
      if (usersRes.ok) setUsers(await usersRes.json());
  }, [apiUrl]);

  const fetchCache = useCallback(async (headers: HeadersInit, url?: string) => {
      setCacheLoading(true);
      try {
          const query = url ? `?url=${encodeURIComponent(url)}` : '';
          const res = await fetch(`${apiUrl}/api/admin/cache${query}`, { headers });
          if (res.ok) setCacheEntries(await res.json());
      } finally {
          setCacheLoading(false);
      }
  }, [apiUrl]);

  const checkAdmin = useCallback(async () => {
      try {
        if (!session?.id_token) {
            alert("Session token missing. Please sign out and sign back in.");
            router.push('/dashboard');
            return;
        }
        const headers: HeadersInit = { 
            'Authorization': `Bearer ${session?.id_token}`
        };
        const res = await fetch(`${apiUrl}/api/admin/me`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.is_admin) {
                setIsAdmin(true);
                fetchData(headers);
                fetchCache(headers);
            } else {
                router.push('/dashboard');
            }
        } else {
            router.push('/dashboard');
        }
      } catch {
          router.push('/dashboard');
      } finally {
          setLoading(false);
      }
  }, [session, router, fetchData]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
        checkAdmin();
    }
  }, [status, router, checkAdmin]);

  const promoteUser = async (email: string) => {
      if(!confirm(`Make ${email} an admin?`)) return;
      
      const headers: HeadersInit = { 
            'Authorization': `Bearer ${session?.id_token}`,
            'Content-Type': 'application/json' 
      };
      
      const res = await fetch(`${apiUrl}/api/admin/promote?email=${email}&make_admin=true`, { 
          method: 'POST',
          headers
      });
      
      if (res.ok) {
          alert("Promoted!");
          fetchData(headers);
          fetchCache(headers);
      } else {
          alert("Failed");
      }
  };

  const flushCache = async () => {
      if (!cacheUrl.trim()) {
          alert("Paste a URL to flush.");
          return;
      }
      if (!confirm(`Flush cache for ${cacheUrl}?`)) return;
      const headers: HeadersInit = { 
            'Authorization': `Bearer ${session?.id_token}`,
            'Content-Type': 'application/json' 
      };
      const res = await fetch(`${apiUrl}/api/admin/cache/flush?url=${encodeURIComponent(cacheUrl)}`, { method: 'POST', headers });
      if (res.ok) {
          setCacheUrl('');
          fetchCache(headers);
          alert("Cache flushed.");
      } else {
          alert("Cache flush failed.");
      }
  };

  if (loading) return <div className="p-10">Checking privileges...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
            <h1 className="text-3xl font-bold text-slate-900">Admin Console</h1>
            <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </header>

        {/* Stats */}
        {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-700">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Total Users</p>
                            <p className="text-2xl font-bold">{stats.total_users}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Active Today</p>
                            <p className="text-2xl font-bold">{stats.daily_active_users}</p>
                        </div>
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Saved Articles</p>
                            <p className="text-2xl font-bold">{stats.total_saved_articles}</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Cache Tools */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-bold text-slate-900">Cache Tools</h2>
                    <p className="text-sm text-slate-500">Flush a single URL from content_cache.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <input
                        type="url"
                        placeholder="Paste article URL..."
                        className="flex-1 md:w-96 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        value={cacheUrl}
                        onChange={(e) => setCacheUrl(e.target.value)}
                    />
                    <Button onClick={flushCache}>Flush</Button>
                </div>
            </div>
            <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Recent Cache Entries</h3>
                    <Button variant="secondary" size="sm" onClick={() => {
                        const headers: HeadersInit = { 'Authorization': `Bearer ${session?.id_token}` };
                        fetchCache(headers, cacheUrl || undefined);
                    }}>
                        Refresh
                    </Button>
                </div>
                {cacheLoading ? (
                    <div className="text-sm text-slate-400">Loading cache...</div>
                ) : cacheEntries.length === 0 ? (
                    <div className="text-sm text-slate-400">No cache entries found.</div>
                ) : (
                    <div className="space-y-2 text-sm">
                        {cacheEntries.slice(0, 8).map((entry) => (
                            <div key={`${entry.url}-${entry.source}`} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                                <div className="font-medium text-slate-800 truncate">{entry.url}</div>
                                <div className="text-slate-500">
                                    {entry.source} | html: {entry.has_html ? 'yes' : 'no'} | summary: {entry.has_summary ? 'yes' : 'no'} | {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : 'n/a'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* User Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-bold text-slate-900">User Management</h2>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 font-medium text-slate-500">Email</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Tier</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Role</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Joined</th>
                        <th className="px-6 py-3 font-medium text-slate-500">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map((user: User) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">{user.email}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.tier === 'insider' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                                    {user.tier}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {user.is_admin ? (
                                    <span className="flex items-center text-indigo-700 font-bold"><ShieldAlert className="w-3 h-3 mr-1"/> Admin</span>
                                ) : 'User'}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                            <td className="px-6 py-4">
                                {!user.is_admin && user.email && (
                                    <Button size="sm" variant="ghost" onClick={() => user.email && promoteUser(user.email)}>Promote</Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
