'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');

    try {
      // Re-using the welcome route for now as a "sign up" signal
      const res = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: 'Subscriber' }),
      });

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={subscribe} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-white rounded-lg p-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email for updates..."
            className="flex-1 px-4 py-3 bg-transparent text-slate-900 placeholder-slate-400 outline-none"
            disabled={status === 'loading' || status === 'success'}
          />
          <button
            type="submit"
            disabled={status === 'loading' || status === 'success'}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
              status === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <AnimatePresence mode="wait">
              {status === 'loading' ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                </motion.div>
              ) : status === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center"
                >
                  <Check className="w-5 h-5 mr-2" /> Joined
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center"
                >
                  Join <ArrowRight className="w-4 h-4 ml-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </form>
      {status === 'error' && (
        <p className="text-red-500 text-sm mt-2 text-center">Something went wrong. Please try again.</p>
      )}
      {status === 'success' && (
        <p className="text-slate-500 text-sm mt-2 text-center">Welcome to the inner circle.</p>
      )}
    </div>
  );
}
