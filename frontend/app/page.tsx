'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Shield, Zap, ArrowRight, Sparkles, Bookmark, Check, Headphones, GraduationCap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
              BETA ACCESS
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-serif font-bold leading-[1.05] tracking-tight">
              Unlock deep reading.<br/>
              <span className="text-indigo-600 italic font-medium">Designed for clarity.</span>
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

        <section className="w-full max-w-6xl mt-28 mb-16">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-serif font-bold mb-3">Plans & Pricing</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Choose the plan that fits your research needs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-200 bg-white flex flex-col">
              <h3 className="text-xl font-bold mb-2">Seeker</h3>
              <div className="text-4xl font-bold mb-6">Free</div>
              <ul className="space-y-4 mb-8 flex-1 text-slate-600">
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-600 mr-3" /> 3 Unlocks / Day</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-600 mr-3" /> Basic Reader View</li>
                <li className="flex items-center text-slate-400"><span className="w-5 h-5 mr-3" /> No AI Summaries</li>
                <li className="flex items-center text-slate-400"><span className="w-5 h-5 mr-3" /> No Audio Player</li>
              </ul>
              <Button variant="secondary" className="w-full" onClick={() => signIn("google")}>Get Started</Button>
            </div>

            <div className="p-8 rounded-3xl border border-indigo-200 bg-indigo-50/60 relative flex flex-col">
              <div className="absolute top-5 right-5 bg-indigo-200 text-indigo-900 text-xs font-bold px-3 py-1 rounded-full flex items-center"><GraduationCap className="w-3 h-3 mr-1"/> STUDENT</div>
              <h3 className="text-xl font-bold text-indigo-900 mb-2">Scholar</h3>
              <div className="text-4xl font-bold text-indigo-900 mb-6">$4.99<span className="text-lg font-normal text-indigo-700">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-indigo-900">
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-600 mr-3" /> Unlimited Unlocks</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-600 mr-3" /> 5 AI Summaries / Day</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-600 mr-3" /> 5 Audio Articles / Day</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-600 mr-3" /> Unlimited Library</li>
              </ul>
              <Button className="w-full" onClick={() => handleUpgrade('scholar')}>Select Plan</Button>
            </div>

            <div className="p-8 rounded-3xl border border-slate-900 bg-slate-900 text-white relative flex flex-col overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-4 -mt-4 opacity-60"></div>
              <div className="absolute top-5 right-5 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center border border-white/20 bg-white/10"><Crown className="w-3 h-3 mr-1"/> PRO</div>

              <h3 className="text-xl font-bold mb-2">Insider</h3>
              <div className="text-4xl font-bold mb-6">$9.99<span className="text-lg font-normal text-slate-300">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-slate-100">
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-300 mr-3" /> Unlimited Unlocks</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-300 mr-3" /> Unlimited AI Summaries</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-300 mr-3" /> Unlimited Audio (TTS)</li>
                <li className="flex items-center"><Check className="w-5 h-5 text-indigo-300 mr-3" /> Priority Support</li>
              </ul>
              <Button className="w-full bg-white text-slate-900 hover:bg-slate-100" onClick={() => handleUpgrade('insider')}>Go Limitless</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-slate-400 text-sm border-t border-slate-200">
        <p>(c) 2026 Nook Inc. democratizing knowledge.</p>
      </footer>
    </div>
  );
}
