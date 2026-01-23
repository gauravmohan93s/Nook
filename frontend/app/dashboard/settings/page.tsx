'use client';

import { getApiUrl } from '@/utils/api';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { 
    User, 
    CreditCard, 
    LogOut, 
    Zap, 
    FileText, 
    Mic, 
    Loader2, 
    ShieldCheck, 
    LayoutDashboard 
} from 'lucide-react';

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
    const apiUrl = getApiUrl();

    useEffect(() => {
        if (status === 'loading') return;
        if (status === 'unauthenticated') {
            router.push('/');
            return;
        }
        
        const fetchMe = async () => {
            if (!session?.id_token) return;
            try {
                const res = await fetch(`${apiUrl}/api/me`, {
                    headers: { 'Authorization': `Bearer ${session.id_token}` }
                });
                if (res.ok) {
                    setMe(await res.json());
                }
            } catch (e) {
                console.error("Failed to load account", e);
            } finally {
                setLoading(false);
            }
        };
        fetchMe();
    }, [session, status, apiUrl, router]);

    const getLimitWidth = (remaining: number, max: number) => {
        if (remaining >= 9999) return '100%';
        // Assuming max is arbitrary for seeker, but let's say 5 for seeker visualization
        const total = remaining + 1; // Just a placeholder logic if we don't know max
        // Better logic: Seeker has 3 reads. 
        return `${Math.min(100, Math.max(5, (remaining / 5) * 100))}%`; 
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                    <Button variant="secondary" onClick={() => router.back()}>
                        Back
                    </Button>
                </div>

                {me && (
                    <>
                        {/* Profile Card */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{me.email}</h2>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                                            me.tier === 'insider' ? 'bg-purple-100 text-purple-700' : 
                                            me.tier === 'scholar' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {me.tier} Plan
                                        </span>
                                        {me.is_admin && (
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <ShieldCheck className="w-3 h-3" /> Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 bg-slate-50/50">
                                <div className="flex gap-3">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => signOut({ callbackUrl: '/' })}
                                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Sign Out
                                    </Button>
                                    {me.is_admin && (
                                        <Button 
                                            variant="secondary"
                                            onClick={() => router.push('/admin')}
                                            className="flex-1"
                                        >
                                            <LayoutDashboard className="w-4 h-4 mr-2" />
                                            Admin Panel
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Usage Stats */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Daily Usage</h3>
                            
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                                            <FileText className="w-4 h-4 text-slate-400" /> Article Unlocks
                                        </span>
                                        <span className="text-slate-900 font-bold">
                                            {me.remaining_reads >= 9999 ? 'Unlimited' : me.remaining_reads}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                                            style={{ width: me.remaining_reads >= 9999 ? '100%' : getLimitWidth(me.remaining_reads, 5) }} 
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                                            <Zap className="w-4 h-4 text-amber-400" /> AI Summaries
                                        </span>
                                        <span className="text-slate-900 font-bold">
                                            {me.remaining_summaries >= 9999 ? 'Unlimited' : me.remaining_summaries}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                                            style={{ width: me.remaining_summaries >= 9999 ? '100%' : getLimitWidth(me.remaining_summaries, 3) }} 
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                                            <Mic className="w-4 h-4 text-emerald-400" /> Audio (TTS)
                                        </span>
                                        <span className="text-slate-900 font-bold">
                                            {me.remaining_tts >= 9999 ? 'Unlimited' : me.remaining_tts}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                                            style={{ width: me.remaining_tts >= 9999 ? '100%' : getLimitWidth(me.remaining_tts, 3) }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subscription Management */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-10">
                                <CreditCard className="w-32 h-32" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-2">Manage Subscription</h3>
                                <p className="text-slate-300 mb-6 text-sm max-w-md">
                                    Upgrade your plan to unlock unlimited reading, advanced AI summaries, and natural text-to-speech.
                                </p>
                                <Button 
                                    className="bg-white text-slate-900 hover:bg-slate-100 border-none"
                                    onClick={() => router.push('/pricing')}
                                >
                                    {me.tier === 'seeker' ? 'Upgrade Plan' : 'View Plans'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}