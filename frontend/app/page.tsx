'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Shield, Zap, ArrowRight, ChevronLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [articleHtml, setArticleHtml] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError('');
    setArticleHtml(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${apiUrl}/api/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to retrieve article.');
      }
      
      const data = await res.json();
      if (data.success && data.html) {
        setArticleHtml(data.html);
      } else {
        throw new Error('Could not parse article content.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load this article. Please check the link and try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- READER VIEW ---
  if (articleHtml) {
    return (
      <div className="min-h-screen bg-[#FDFBF7]"> {/* Creamy paper background */}
        <Navbar />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto px-6 py-12"
        >
            <Button 
              variant="ghost" 
              onClick={() => setArticleHtml(null)}
              className="mb-8 pl-0 hover:pl-2 transition-all text-gray-500"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Search
            </Button>
            
            <article 
              className="prose prose-lg prose-slate md:prose-xl max-w-none font-serif prose-headings:font-serif prose-headings:font-bold prose-p:text-gray-800 prose-a:text-indigo-600"
              dangerouslySetInnerHTML={{ __html: articleHtml }}
            />
        </motion.div>
      </div>
    );
  }

  // --- LANDING VIEW ---
  return (
    <div className="min-h-screen flex flex-col bg-white overflow-hidden relative">
      <Navbar />
      
      {/* Decorative Background Mesh */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10" />
      <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-3xl -z-10" />
      <div className="absolute top-[100px] -left-[200px] w-[500px] h-[500px] bg-emerald-50/40 rounded-full blur-3xl -z-10" />

      <main className="flex-1 flex flex-col items-center pt-24 pb-16 px-4 sm:px-6">
        <div className="w-full max-w-4xl space-y-16 text-center">
          
          {/* Hero Text */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold tracking-wide uppercase mb-4">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              Beta Access
            </div>
            
            <h1 className="text-6xl md:text-7xl font-serif font-bold text-gray-900 leading-[1.1] tracking-tight">
              Unlock knowledge. <br/>
              <span className="text-gray-400 italic font-medium">Without barriers.</span>
            </h1>
            
            <p className="text-xl text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
              Access premium insights from top publications instantly. 
              Distraction-free, curated, and designed for deep reading.
            </p>
          </motion.div>

          {/* Search Input */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl mx-auto w-full relative group"
          >
            <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur-xl transition-all group-hover:bg-indigo-500/10"></div>
            
            <div className="relative bg-white p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex items-center transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
               <Search className="w-6 h-6 text-gray-400 ml-4" />
               <input 
                  type="url" 
                  required
                  placeholder="Paste a Medium article URL..." 
                  className="flex-1 px-4 py-4 rounded-xl text-lg outline-none text-gray-900 placeholder-gray-400 bg-transparent font-medium"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock(e as any)}
               />
               <Button 
                  size="lg"
                  onClick={handleUnlock}
                  isLoading={loading}
                  className="rounded-xl"
               >
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

          {/* Features Grid */}
          <motion.div 
             initial={{ opacity: 0, y: 40 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.4 }}
             className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              { icon: BookOpen, title: "Native Reader", desc: "We parse the content and render it in a clean, ad-free typography optimized for focus." },
              { icon: Zap, title: "Instant Access", desc: "Bypass paywalls legally through our distributed network of public archives." },
              { icon: Shield, title: "Privacy First", desc: "No tracking pixels. No cookies. Just you and the text you want to read." }
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-xl text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </motion.div>

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-8 text-center text-gray-400 text-sm border-t border-gray-100">
        <p>© 2026 Nook Inc. democratizing knowledge.</p>
      </footer>
    </div>
  );
}