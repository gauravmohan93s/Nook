'use client';

import { getApiUrl } from '@/utils/api';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Reader from '@/components/Reader';
import { Button } from '@/components/ui/Button';

function ReadContent() {
    const searchParams = useSearchParams();
    const url = searchParams.get('url');
    const router = useRouter();
    const { data: session } = useSession();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [articleHtml, setArticleHtml] = useState<string>('');
    const [pdfUrl, setPdfUrl] = useState<string | undefined>(undefined);
    const [contentType, setContentType] = useState<'html' | 'pdf'>('html');
    const [articleMeta, setArticleMeta] = useState<{ source?: string; license?: string; tags?: string[] } | null>(null);

    useEffect(() => {
        if (!url) {
            setError("No URL provided");
            setLoading(false);
            return;
        }
        
        const fetchArticle = async () => {
            try {
                const headers: HeadersInit = { 'Content-Type': 'application/json' };
                if (session?.id_token) {
                    headers['Authorization'] = `Bearer ${session.id_token}`;
                }

                const apiUrl = getApiUrl();
                const res = await fetch(`${apiUrl}/api/unlock`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ url }),
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.detail || 'Failed to load article');
                }
                if (data.success) {
                    setArticleHtml(data.html || '');
                    setPdfUrl(data.pdf_url);
                    setContentType(data.content_type || 'html');
                    setArticleMeta({ source: data.source, license: data.license, ...(data.metadata || {}) });
                } else {
                    throw new Error('Invalid content');
                }
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("An unknown error occurred");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [url, session]);

    if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading Article...</div>;
    
    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
        </div>
    );

    if (url) {
        return (
            <Reader 
                html={articleHtml} 
                pdfUrl={pdfUrl}
                contentType={contentType}
                meta={articleMeta} 
                url={url} 
                onBack={() => router.back()} 
            />
        );
    }

    return null;
}

export default function ReadPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ReadContent />
        </Suspense>
    );
}
