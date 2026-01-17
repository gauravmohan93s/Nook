'use client';

import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; summary: string } | null>(null);
  const [error, setError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Use environment variable or fallback to localhost
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error('Failed to find a working mirror.');
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper">
      <div className="max-w-2xl w-full text-center space-y-8">
        
        {/* Brand Header */}
        <div className="space-y-2">
          <div className="flex justify-center mb-4">
             {/* Simple Logo Placeholder */}
             <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white font-serif text-2xl font-bold">
               n
             </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Nook
          </h1>
          <p className="text-lg text-secondary">
            Your Window to the Best Writing.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input 
                type="url" 
                required
                placeholder="Paste a Medium Article URL..." 
                className="w-full px-5 py-4 rounded-xl border-2 border-gray-100 focus:border-primary focus:ring-0 text-lg transition-all outline-none"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-primary hover:bg-indigo-700 text-white font-semibold rounded-xl text-lg transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Finding Mirror...' : 'Read for Free'}
            </button>
          </form>

          {/* Messages */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Result Section */}
        {result && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-left space-y-4 animate-fade-in">
             <div className="flex items-center space-x-2 text-accent font-semibold">
                <span className="w-2 h-2 bg-accent rounded-full"></span>
                <span>Article Unlocked</span>
             </div>
             <h3 className="text-2xl font-serif text-gray-900">Ready to Read</h3>
             <p className="text-secondary">{result.summary}</p>
             
             <div className="pt-4">
               <a 
                 href={result.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
               >
                 Open Article ↗
               </a>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}