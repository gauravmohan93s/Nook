'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';

export default function DiscoverPage() {
    const router = useRouter();
    const { status } = useSession();
    const [url, setUrl] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    const samples = [
        {
            title: "AI Agents - Complete Course",
            url: "https://medium.com/data-science-collective/ai-agents-complete-course-f226aa4550a1"
        },
        {
            title: "Towards Data Science",
            url: "https://towardsdatascience.com/"
        },
        {
            title: "Open Access - arXiv",
            url: "https://arxiv.org/"
        }
    ];

    const handleUnlock = () => {
        if (!url) return;
        router.push(`/read?url=${encodeURIComponent(url)}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                    <h1 className="text-2xl font-bold mb-3 text-slate-900">Discover</h1>
                    <p className="text-slate-500 mb-6">Paste a link or jump into a curated sample.</p>

                    <div className="flex gap-3">
                        <input
                            type="url"
                            placeholder="Paste a URL to read..."
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                        <Button onClick={handleUnlock}>Unlock</Button>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Curated Samples</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        {samples.map(sample => (
                            <button
                                key={sample.url}
                                onClick={() => router.push(`/read?url=${encodeURIComponent(sample.url)}`)}
                                className="text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                            >
                                <p className="font-semibold text-slate-900 mb-2">{sample.title}</p>
                                <p className="text-xs text-slate-400 break-words">{sample.url}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <Button onClick={() => router.back()}>Go Back</Button>
                </div>
            </div>
        </div>
    );
}
