'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Bookmark, LogOut, Settings, Sparkles, BookOpen, Shield, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Article } from '../../types/api';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState('');
  // Removed unused loading state
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [fetchingLibrary, setFetchingLibrary] = useState(true);
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('tile');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const fetchLibrary = useCallback(async () => {
      setFetchingLibrary(true);
      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.id_token) {
            headers['Authorization'] = `Bearer ${session.id_token}`;
        }
        const res = await fetch(`${apiUrl}/api/library`, { headers });
        if (res.ok) {
            const data = await res.json();
            setSavedArticles(data);
        }
      } catch (e) {
          console.error("Failed to fetch library", e);
      } finally {
          setFetchingLibrary(false);
      }
  }, [session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
        fetchLibrary();
    }
  }, [status, router, fetchLibrary]);

  const handleUnlock = (e: React.FormEvent) => {
      e.preventDefault();
      if (url) {
          router.push(`/read?url=${encodeURIComponent(url)}`);
      }
  };

  const handleDelete = async (articleUrl: string) => {
      if (!confirm("Are you sure you want to remove this article?")) return;
      try {
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (session?.id_token) {
              headers['Authorization'] = `Bearer ${session.id_token}`;
          }
          await fetch(`${apiUrl}/api/save`, {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ url: articleUrl })
          });
          // Refresh library
          fetchLibrary();
      } catch (e) { // kept e for logging
          console.error(e);
          alert("Failed to delete");
      }
  };

  if (status === 'loading') return <div className="p-10 flex items-center justify-center min-h-screen">Loading Session...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar / Nav */}
      <nav className="fixed top-0 left-0 h-full w-64 bg-white/80 backdrop-blur border-r border-slate-200 p-6 hidden md:flex flex-col">
        <div className="mb-10 flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg"></div>
            <span className="font-serif font-bold text-xl tracking-tight text-slate-900">Nook</span>
        </div>

        <div className="space-y-1 flex-1">
            <Button variant="ghost" className="w-full justify-start bg-indigo-50 text-indigo-600 font-medium">
                <BookOpen className="w-4 h-4 mr-3" /> Library
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900" onClick={() => router.push('/dashboard/discover')}>
                <Sparkles className="w-4 h-4 mr-3" /> Discover
            </Button>
            <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900" onClick={() => router.push('/dashboard/settings')}>
                <Settings className="w-4 h-4 mr-3" /> Settings
            </Button>
             {/* Admin Link (Hidden usually) */}
             <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900" onClick={() => router.push('/admin')}>
                <Shield className="w-4 h-4 mr-3" /> Admin
            </Button>
        </div>

        <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center space-x-3 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {session?.user?.image && <img src={session.user.image} alt="User" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{session?.user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
                </div>
            </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-8">
        <div className="max-w-5xl mx-auto">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-slate-900">Your Workspace</h1>
                    <p className="text-slate-600 mt-2">Welcome back, {session?.user?.name?.split(' ')[0]}. Ready to read?</p>
                </div>
                <div className="bg-white/80 p-1 rounded-lg border border-slate-200 flex items-center">
                    <button 
                        onClick={() => setViewMode('tile')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'tile' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ListIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Quick Unlock */}
            <form onSubmit={handleUnlock} className="bg-white/80 p-2 rounded-xl shadow-sm border border-slate-200 flex items-center mb-12">
               <Search className="w-5 h-5 text-slate-400 ml-4" />
               <input 
                  type="url" 
                  placeholder="Paste a URL to read..." 
                  className="flex-1 px-4 py-3 outline-none text-slate-900 placeholder-slate-400 bg-transparent"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
               />
               <Button type="submit">Unlock</Button>
            </form>

            {/* Library Grid */}
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <Bookmark className="w-4 h-4 mr-2 text-indigo-600" /> Saved Articles
            </h2>
            
            {fetchingLibrary ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                     {[1,2,3,4].map(i => (
                         <div key={i} className="h-40 bg-white/60 rounded-xl border border-slate-100"></div>
                     ))}
                 </div>
            ) : savedArticles.length === 0 ? (
                <div className="text-center py-20 bg-white/70 rounded-xl border border-dashed border-slate-200">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Your library is empty. Unlock an article to save it.</p>
                </div>
            ) : viewMode === 'tile' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {savedArticles.map((article: Article) => (
                        <div key={article.id} className="bg-white/80 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group relative">
                            <button 
                                onClick={(e) => { e.stopPropagation(); if(article.url) handleDelete(article.url); }}
                                className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                title="Delete Article"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                            <div className="h-40 bg-gray-100 overflow-hidden relative cursor-pointer" onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}>
                                {article.thumbnail_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={article.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
                                        <BookOpen className="w-12 h-12" />
                                    </div>
                                )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2 leading-tight">{article.title || 'Untitled Article'}</h3>
                                <p className="text-xs text-slate-500 mb-4 line-clamp-1">{article.author || 'Unknown Author'} - {article.published_at || 'Recently Saved'}</p>
                                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">{article.created_at ? new Date(article.created_at).toLocaleDateString() : ''}</span>
                                    <Button size="sm" variant="ghost" className="text-indigo-600 hover:bg-indigo-50 p-0 hover:px-2" onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}>Read Now <ArrowRight className="w-3 h-3 ml-1" /></Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {savedArticles.map((article: Article) => (
                        <div key={article.id} className="bg-white/80 p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-6 group">
                             <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}>
                                {article.thumbnail_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={article.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
                                        <BookOpen className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 mb-1 line-clamp-1 cursor-pointer hover:text-indigo-600" onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}>{article.title || 'Untitled Article'}</h3>
                                <p className="text-sm text-slate-500 mb-2 line-clamp-1">{article.author || 'Unknown Author'} - {article.url}</p>
                                <div className="flex items-center space-x-4 text-xs text-slate-400">
                                    <span>Saved: {article.created_at ? new Date(article.created_at).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}>Read</Button>
                                <button 
                                    onClick={() => handleDelete(article.url)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
