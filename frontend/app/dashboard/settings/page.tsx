'use client';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface MeResponse {
    email: string;
    tier: string;
    is_admin: boolean;
    remaining_reads: number;
    remaining_summaries: number;
    remaining_tts: number;
}

export default function SettingsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [me, setMe] = useState<MeResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    useEffect(() => {
        if (status === 'loading') return;
        if (status === 'unauthenticated') {
            router.push('/');
            return;
        }
        if (!session?.id_token) {
            setError("Session token missing. Please sign out and sign back in.");
            setLoading(false);
            return;
        }
        const fetchMe = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/me`, {
                    headers: { 'Authorization': `Bearer ${session.id_token}` }
                });
                if (!res.ok) throw new Error('Failed to load account');
                setMe(await res.json());
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load account');
            } finally {
                setLoading(false);
            }
        };
        fetchMe();
    }, [session, status]);

    return (
        <div className="min-h-screen bg-slate-50 p-10">
            <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <h1 className="text-2xl font-bold mb-4 text-slate-900">Settings</h1>

                {loading && <p className="text-slate-400">Loading account...</p>}
                {error && <p className="text-red-600">{error}</p>}

                {me && (
                    <div className="space-y-6 text-slate-600">
                        <div>
                            <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2">Account</h2>
                            <p><span className="font-semibold text-slate-900">Email:</span> {me.email}</p>
                            <p><span className="font-semibold text-slate-900">Tier:</span> {me.tier}</p>
                            <p><span className="font-semibold text-slate-900">Admin:</span> {me.is_admin ? 'Yes' : 'No'}</p>
                        </div>

                        <div>
                            <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2">AI Usage</h2>
                            <p><span className="font-semibold text-slate-900">Remaining Unlocks:</span> {me.remaining_reads}</p>
                            <p><span className="font-semibold text-slate-900">Remaining Summaries:</span> {me.remaining_summaries}</p>
                            <p><span className="font-semibold text-slate-900">Remaining TTS:</span> {me.remaining_tts}</p>
                            <p className="text-xs text-slate-400 mt-2">AI features consume daily credits based on your plan.</p>
                        </div>
                    </div>
                )}

                <div className="mt-8">
                    <Button onClick={() => router.back()}>Go Back</Button>
                </div>
            </div>
        </div>
    );
}
