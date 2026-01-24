'use client';

import { getApiUrl } from '@/utils/api';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { BookOpen, Globe, Rss, ArrowRight, Loader2, Search, Library } from 'lucide-react';
import { motion } from 'framer-motion';

interface ArticlePreview {
    title: string;
    url: string;
    source: string;
    summary: string;
    published: string;
}

interface BookResult {
    title: string;
    author: string;
    url: string; // Detail page
    thumbnail_url?: string;
    source: string;
}

interface DiscoverData {
    featured: ArticlePreview[];
    latest: ArticlePreview[];
}

export default function DiscoverPage() {
    const router = useRouter();
    const { status } = useSession();
    const [url, setUrl] = useState('');
    const [activeTab, setActiveTab] = useState<'feeds' | 'books'>('feeds');
    const [searchQuery, setSearchQuery] = useState('');
    const [bookResults, setBookResults] = useState<BookResult[]>([]);
    const [isSearchingBooks, setIsSearchingBooks] = useState(false);
    
    const [data, setData] = useState<DiscoverData | null>(null);
    const [loading, setLoading] = useState(true);
    const apiUrl = getApiUrl();

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

    const handleBookSearch = async () => {
        if (!searchQuery) return;
        setIsSearchingBooks(true);
        try {
            const res = await fetch(`${apiUrl}/api/search?q=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setBookResults(data.results || []);
            }
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearchingBooks(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-10">
            <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
                
                {/* Header & Tabs */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Globe className="w-6 h-6 text-indigo-600" />
                            Discover
                        </h1>
                        <p className="text-slate-500 text-sm sm:text-base">Explore articles, research papers, and books.</p>
                    </div>
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto no-scrollbar">
                        <button 
                            onClick={() => setActiveTab('feeds')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'feeds' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Feeds & Articles
                        </button>
                        <button 
                            onClick={() => setActiveTab('books')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'books' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Find Books (Anna's)
                        </button>
                    </div>
                </div>

                {activeTab === 'feeds' ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8">
                        {/* URL Paste Input */}
                        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-sm">
                            <div className="flex gap-3 flex-col sm:flex-row">
                                <input
                                    type="url"
                                    placeholder="Paste a Medium, Arxiv, YouTube, or web link..."
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm sm:text-base"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                                <Button onClick={handleUnlock} className="py-3 px-6 w-full sm:w-auto">Unlock</Button>
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8">
                         {/* Book Search Input */}
                         <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-sm">
                            <div className="flex gap-3 flex-col sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search for books, papers, or authors..."
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm sm:text-base"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBookSearch()}
                                    />
                                </div>
                                <Button onClick={handleBookSearch} className="py-3 px-6 w-full sm:w-auto" disabled={isSearchingBooks}>
                                    {isSearchingBooks ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                                </Button>
                            </div>
                        </div>

                        {/* Book Results */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {bookResults.map((book, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => router.push(`/read?url=${encodeURIComponent(book.url)}`)}
                                    className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer flex gap-4 h-auto sm:h-40 overflow-hidden"
                                >
                                    <div className="w-20 sm:w-24 h-28 sm:h-32 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-slate-100">
                                        {book.thumbnail_url ? (
                                            <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Library className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col py-1 overflow-hidden">
                                        <h3 className="font-bold text-slate-900 text-sm line-clamp-3 mb-1">
                                            {book.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                                            {book.author}
                                        </p>
                                        <span className="mt-auto inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 w-fit">
                                            {book.source}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {!isSearchingBooks && bookResults.length === 0 && searchQuery && (
                            <div className="text-center py-12 text-slate-400">
                                No books found. Try a different query.
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}