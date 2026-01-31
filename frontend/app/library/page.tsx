'use client';

import { getApiUrl } from '@/utils/api';

import { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { BookOpen, Clock } from "lucide-react";
import { Button } from '@/components/ui/Button';
import { Article } from '../../types/api';

export default function Library() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [fetching, setFetching] = useState(false);
  const apiUrl = getApiUrl();

  useEffect(() => {
    if (status === "loading") return;

    if (session?.id_token) {
      setFetching(true);
      fetch(`${apiUrl}/api/library`, {
        headers: { 'Authorization': `Bearer ${session.id_token}` }
      })
      .then(res => res.json())
      .then(data => setArticles(data))
      .catch(err => console.error(err))
      .finally(() => setFetching(false));
    }
  }, [session, status]);

  const isLoading = status === "loading" || fetching;

  if (!session && status !== "loading") {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="flex items-center justify-center h-[60vh]">
                <p className="text-slate-500">Please log in to view your library.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold text-slate-900 mb-12">Your Library</h1>

        {isLoading ? (
             <div className="text-center py-20 text-slate-400">Loading your saved stories...</div>
        ) : articles.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No saved articles yet</h3>
                <p className="text-slate-500">Stories you save will appear here.</p>
             </div>
        ) : (
             <div className="grid gap-6">
                {articles.map((article: Article) => (
                    <div key={article.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                        <div>
                            <h3 className="text-xl font-serif font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                                <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title || "Untitled Story"}</a>
                            </h3>
                            <div className="flex items-center text-sm text-slate-500">
                                <Clock className="w-4 h-4 mr-1 text-slate-400" />
                                <span>Saved on {article.created_at ? new Date(article.created_at).toLocaleDateString() : 'Unknown date'}</span>
                            </div>
                        </div>
                        <Button 
                            onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}
                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                            Read Now
                        </Button>
                    </div>
                ))}
             </div>
        )}
      </div>
    </div>
  );
}
