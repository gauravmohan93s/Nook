'use client';

import { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { BookOpen, Clock } from "lucide-react";

export default function Library() {
  const { data: session } = useSession();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.id_token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/library`, {
        headers: { 'Authorization': `Bearer ${session.id_token}` }
      })
      .then(res => res.json())
      .then(data => setArticles(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
    } else if (session === null) {
        setLoading(false);
    }
  }, [session]);

  if (!session) {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex items-center justify-center h-[60vh]">
                <p className="text-gray-500">Please log in to view your library.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-12">Your Library</h1>

        {loading ? (
             <div className="text-center py-20 text-gray-400">Loading your saved stories...</div>
        ) : articles.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No saved articles yet</h3>
                <p className="text-gray-500">Stories you save will appear here.</p>
             </div>
        ) : (
             <div className="grid gap-6">
                {articles.map((article) => (
                    <div key={article.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                        <div>
                            <h3 className="text-xl font-serif font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                                <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title || "Untitled Story"}</a>
                            </h3>
                            <div className="flex items-center text-sm text-gray-500">
                                <Clock className="w-4 h-4 mr-1" />
                                <span>Saved on {new Date(article.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <a href={article.url} target="_blank" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                            Read Original
                        </a>
                    </div>
                ))}
             </div>
        )}
      </div>
    </div>
  );
}