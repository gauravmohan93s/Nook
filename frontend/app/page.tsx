'use client';

import { getApiUrl } from '@/utils/api';
import Newsletter from '@/components/Newsletter';
import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Shield, Zap, ArrowRight, Sparkles, Bookmark, Check, Headphones, GraduationCap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Reader from '@/components/Reader';
import Script from 'next/script';

// Razorpay Types
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [articleHtml, setArticleHtml] = useState<string | null>(null);
  const [articleMeta, setArticleMeta] = useState<{ source?: string; license?: string; tags?: string[] } | null>(null);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const apiUrl = getApiUrl();

  useEffect(() => {
    // Redirect logic disabled as per current requirements
  }, [status, router]);

  const handleUnlock = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError('');
    setArticleHtml(null);
    setArticleMeta(null);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.id_token) {
          headers['Authorization'] = `Bearer ${session.id_token}`;
      }

      const res = await fetch(`${apiUrl}/api/unlock`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to retrieve article.');
      }
      
      const data = await res.json();
      if (data.success && data.html) {
        setArticleHtml(data.html);
        setArticleMeta({ source: data.source, license: data.license, ...(data.metadata || {}) });
      } else {
        throw new Error('Could not parse article content.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load this article. Please check the link and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
      if (!session) {
          signIn("google");
          return;
      }

      try {
          const res = await fetch(`${apiUrl}/api/create-order`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.id_token}`
              },
              body: JSON.stringify({ plan_id: planId })
          });

          if (!res.ok) throw new Error("Failed to create order");
          const order = await res.json();

          const options = {
              key: order.key_id,
              amount: order.amount,
              currency: order.currency,
              name: "Nook Inc.",
              description: `Upgrade to ${planId}`,
              order_id: order.order_id,
              handler: async function (response: RazorpayResponse) {
                  // Verify payment
                  const verifyRes = await fetch(`${apiUrl}/api/verify-payment`, {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.id_token}`
                      },
                      body: JSON.stringify({
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_signature: response.razorpay_signature,
                          plan_id: planId
                      })
                  });
                  if (verifyRes.ok) {
                      alert(`Welcome to ${planId}!`);
                      router.push('/dashboard');
                  } else {
                      alert("Payment verification failed.");
                  }
              },
              prefill: {
                  name: session.user?.name,
                  email: session.user?.email,
              },
              theme: {
                  color: "#4F46E5"
              }
          };

          const rzp1 = new window.Razorpay(options);
          rzp1.open();

      } catch (e) {
          console.error(e);
          alert("Something went wrong initializing payment.");
      }
  };

  // --- READER VIEW ---
  if (articleHtml) {
      return <Reader html={articleHtml} meta={articleMeta} url={url} onBack={() => setArticleHtml(null)} />;
  }

  // --- LANDING VIEW ---
  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6 } },
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-hidden relative text-slate-900">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="absolute -top-[240px] -right-[200px] w-[620px] h-[620px] bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.22),_transparent_60%)] blur-2xl -z-10" />
      <div className="absolute top-[80px] -left-[240px] w-[560px] h-[560px] bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.18),_transparent_60%)] blur-2xl -z-10" />
      <div className="absolute bottom-0 inset-x-0 h-[280px] bg-[linear-gradient(180deg,_rgba(248,250,255,0)_0%,_rgba(243,244,255,0.9)_100%)] -z-10" />

      <main className="flex-1 flex flex-col items-center pt-24 pb-16 px-4 sm:px-6">
        <section className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold tracking-[0.22em] uppercase">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              TRUSTED BY GLOBAL RESEARCHERS
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-serif font-bold leading-[1.05] tracking-tight text-slate-900">
              The Standard for<br/>
              <span className="text-indigo-600 italic font-medium">Deep Reading.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-xl leading-relaxed">
              One link in, distraction out. Nook cleans the page, highlights key ideas, and turns any article into a calm, readable workspace.
            </motion.p>

            <motion.div variants={fadeUp} className="relative">
              <div className="absolute -inset-2 bg-indigo-500/10 rounded-3xl blur-xl"></div>
              <div className="relative bg-white p-2 rounded-3xl shadow-[0_18px_50px_rgba(79,70,229,0.15)] border border-indigo-100 flex items-center">
                <Search className="w-6 h-6 text-slate-400 ml-4" />
                <input
                  type="url"
                  required
                  placeholder="Paste a Medium article URL..."
                  className="flex-1 px-4 py-4 rounded-xl text-lg outline-none text-slate-900 placeholder-slate-400 bg-transparent font-medium"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock(e)}
                />
                <Button size="lg" onClick={handleUnlock} isLoading={loading} className="rounded-2xl">
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </Button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center justify-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4 text-left">
              {[
                { label: "Avg. Unlock", value: "2.1s" },
                { label: "Summaries", value: "3 bullets" },
                { label: "Audio", value: "AI + native" },
              ].map((item) => (
                <div key={item.label} className="bg-white/80 border border-slate-100 rounded-2xl px-4 py-3">
                  <div className="text-sm text-slate-500">{item.label}</div>
                  <div className="text-lg font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -top-8 right-6 w-56 h-56 bg-indigo-600/10 rounded-full blur-2xl"></div>
            <div className="relative space-y-5">
              <div className="bg-white border border-indigo-100 rounded-3xl p-6 shadow-xl shadow-indigo-200/40">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Reader</span>
                  <span className="text-xs text-slate-400">Clean view</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Agents - Complete Course</h3>
                <p className="text-sm text-slate-500">Images, code blocks, and citations preserved with a premium reading flow.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold tracking-wide text-purple-600 uppercase">Summary</span>
                  <span className="text-xs text-slate-400">3 bullets</span>
                </div>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li>- Agent architectures and tool loops</li>
                  <li>- Memory, planning, and orchestration</li>
                  <li>- Real-world evaluation techniques</li>
                </ul>
              </div>

              <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-xl shadow-indigo-500/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold tracking-wide uppercase">Listen</span>
                  <span className="text-xs text-indigo-200">AI voice</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Start reading aloud</span>
                  <Headphones className="w-5 h-5" />
                </div>
              </div>
            </div>
          </motion.div>
        </section>
        
        {/* --- SOCIAL PROOF --- */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-16 w-full max-w-6xl border-t border-slate-100 pt-10"
        >
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Designed for researchers at</p>
          <div className="flex flex-wrap justify-center items-center gap-10 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Stanford - Block S */}
            <svg className="h-12 w-auto text-[#8C1515]" viewBox="0 0 100 100" fill="currentColor">
               <path d="M20,20 V80 H80 V20 H65 V35 H55 V20 H45 V35 H35 V20 Z M35,35 V65 H45 V50 H55 V65 H65 V35 H80 V80 H20 V35 Z" fillRule="evenodd"/> 
               <text x="50" y="95" fontSize="16" fontFamily="serif" textAnchor="middle" fontWeight="bold">Stanford</text>
            </svg>

            {/* MIT - 7 Bars */}
            <svg className="h-10 w-auto text-[#A31F34]" viewBox="0 0 70 40" fill="currentColor">
               {/* M */}
               <rect x="0" y="0" width="8" height="40" />
               <rect x="11" y="15" width="8" height="25" />
               <rect x="22" y="0" width="8" height="40" />
               {/* I */}
               <rect x="33" y="0" width="8" height="40" />
               {/* T */}
               <rect x="44" y="0" width="8" height="12" />
               <rect x="44" y="16" width="8" height="24" />
               <rect x="55" y="0" width="8" height="40" />
            </svg>

            {/* Google */}
            <svg className="h-8 w-auto" viewBox="0 0 24 24" fill="none">
               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
               <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>

            {/* Y Combinator */}
            <svg className="h-8 w-auto text-[#FF6600]" viewBox="0 0 24 24" fill="currentColor">
               <rect width="24" height="24" rx="2" />
               <path d="M6 5h2l4 8 4-8h2l-5 10v4h-2v-4L6 5z" fill="white" />
            </svg>

            {/* Medium */}
            <svg className="h-8 w-auto text-black" viewBox="0 0 100 25" fill="currentColor">
               <text x="0" y="20" fontSize="22" fontFamily="serif" fontWeight="bold">Medium</text>
            </svg>
          </div>
        </motion.div>

        <section className="w-full max-w-6xl mt-28">
          <div className="text-left mb-10">
            <h2 className="text-3xl font-serif font-bold mb-3">Built for deep work</h2>
            <p className="text-slate-600 max-w-2xl">Every interaction is optimized for reading, summarizing, and remembering what matters.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: BookOpen, title: "Native Reader", desc: "A distraction-free view with typography tuned for long form." },
              { icon: Sparkles, title: "AI Summaries", desc: "Fast, multi-provider summaries with daily usage awareness." },
              { icon: Headphones, title: "Audio Flow", desc: "AI TTS with graceful fallback to legacy and native voices." },
              { icon: Bookmark, title: "Personal Library", desc: "Save and revisit your reading history anytime." },
              { icon: Zap, title: "Instant Access", desc: "Unlock Medium and open-access sources quickly." },
              { icon: Shield, title: "Privacy First", desc: "No trackers, no ads, no noise." }
            ].map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-lg transition-all">
                <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- FOUNDATIONAL MEMBERSHIP BANNER --- */}
        <section className="w-full max-w-5xl mt-32 mb-16 mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-10 md:p-16 text-center shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <div className="relative z-10">
              <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-indigo-100 text-xs font-bold tracking-widest uppercase">
                Foundational Membership
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 tracking-tight text-white" style={{ color: 'white' }}>
                Elevate Your Intellectual Standard.
              </h2>
              <p className="text-lg text-indigo-100/80 max-w-2xl mx-auto mb-10 leading-relaxed">
                Join the select group of scholars and professionals who use Nook to distill the world&apos;s best writing. 
                Secure your lifetime preferred rate today.
              </p>
              
              <div className="flex flex-col items-center gap-4">
                <Button 
                  size="lg" 
                  className="bg-white text-slate-900 hover:bg-indigo-50 px-10 py-4 text-lg rounded-full font-bold transition-all hover:scale-105"
                  onClick={() => router.push('/pricing')}
                >
                  Secure Your Membership
                </Button>
                <p className="text-sm text-indigo-200/60">
                  Exclusive Foundational Memberships Available
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- NEWSLETTER SECTION --- */}
        <section className="w-full max-w-2xl mt-20 mb-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Join the Inner Circle</h2>
          <p className="text-slate-600 mb-8">
            Get the best articles curated by our AI, delivered to your inbox weekly.
            No noise, just signal.
          </p>
          <Newsletter />
        </section>

      </main>

      <footer className="py-8 text-center text-slate-400 text-sm border-t border-slate-200">
        <p>(c) 2026 Nook Inc. democratizing knowledge.</p>
      </footer>
    </div>
  );
}

