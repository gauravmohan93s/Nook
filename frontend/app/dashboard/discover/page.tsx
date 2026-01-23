'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { BookOpen, Globe, Rss, ArrowRight, Loader2 } from 'lucide-react';

interface ArticlePreview {
    title: string;
    url: string;
    source: string;
    summary: string;
    published: string;
}

interface DiscoverData {
    featured: ArticlePreview[];
    latest: ArticlePreview[];
}

export default function DiscoverPage() {
    const router = useRouter();
    const { status } = useSession();
    const [url, setUrl] = useState('');
    const [data, setData] = useState<DiscoverData | null>(null);
    const [loading, setLoading] = useState(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/discover`);
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (e) {
                console.error("Failed to fetch discover data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [apiUrl]);

    const handleUnlock = () => {
        if (!url) return;
        router.push(`/read?url=${encodeURIComponent(url)}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Search / Paste Section */}
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                    <h1 className="text-2xl font-bold mb-3 text-slate-900 flex items-center gap-2">
                        <Globe className="w-6 h-6 text-indigo-600" />
                        Discover
                    </h1>
                    <p className="text-slate-500 mb-6">Paste a link to unlock knowledge or explore our curated picks.</p>

                    <div className="flex gap-3 flex-col sm:flex-row">
                        <input
                            type="url"
                            placeholder="Paste a Medium, Arxiv, or web link..."
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                        <Button onClick={handleUnlock} className="py-3 px-6">Unlock</Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Featured Section */}
                        {data?.featured && data.featured.length > 0 && (
                            <section>
                                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-emerald-600" />
                                    Featured Reads
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {data.featured.map((article, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}
                                            className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="w-5 h-5 text-indigo-500" />
                                            </div>
                                            <span className="inline-block px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium mb-3">
                                                {article.source}
                                            </span>
                                            <h3 className="font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">
                                                {article.title}
                                            </h3>
                                            <p className="text-sm text-slate-500 line-clamp-2">
                                                {article.summary}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Latest RSS Section */}
                        {data?.latest && data.latest.length > 0 && (
                            <section>
                                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Rss className="w-5 h-5 text-orange-500" />
                                    Fresh from the Web
                                </h2>
                                <div className="grid md:grid-cols-3 gap-4">
                                    {data.latest.map((article, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => router.push(`/read?url=${encodeURIComponent(article.url)}`)}
                                            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-orange-200 hover:bg-orange-50/30 transition-all cursor-pointer flex flex-col h-full"
                                        >
                                            <div className="mb-2 flex justify-between items-start">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                    {article.source}
                                                </span>
                                                {article.published && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                                        {article.published}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-semibold text-slate-900 text-sm mb-2 flex-grow">
                                                {article.title}
                                            </h3>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}