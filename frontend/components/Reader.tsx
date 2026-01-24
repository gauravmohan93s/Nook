'use client';

import { getApiUrl } from '@/utils/api';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Sparkles, Bookmark, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSession, signIn } from 'next-auth/react';
import DOMPurify from 'dompurify';

interface ReaderProps {
  html: string;
  pdfUrl?: string; // New prop
  contentType?: 'html' | 'pdf'; // New prop
  meta: { 
      source?: string; 
      license?: string;
      title?: string;
      thumbnail_url?: string;
      author?: string;
      published_at?: string;
      tags?: string[];
  } | null;
  url: string;
  onBack: () => void;
}

export default function Reader({ html, pdfUrl, contentType = 'html', meta, url, onBack }: ReaderProps) {
  const { data: session } = useSession();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryMeta, setSummaryMeta] = useState<{ provider?: string; model?: string; remaining?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentParaIndex, setCurrentParaIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null); // For Legacy TTS
  
  // Speech Synthesis Refs
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const aiTtsUrl = process.env.NEXT_PUBLIC_TTS_AI_URL;
  const legacyTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_LEGACY_TTS === 'true';
  const apiBaseUrl = getApiUrl();

  useEffect(() => {
      if (typeof window !== 'undefined') {
          synthRef.current = window.speechSynthesis;
          audioRef.current = new Audio();
      }
      return () => {
          if (synthRef.current) synthRef.current.cancel();
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
          }
      };
  }, []);

  const requireLogin = () => {
     if (confirm("You need to sign in to use this feature. Would you like to login?")) {
         signIn("google");
     }
  };

  const ensureSession = () => {
      if (!session) {
          requireLogin();
          return false;
      }
      if (!session.id_token) {
          alert("Session token missing. Please sign out and sign back in.");
          return false;
      }
      return true;
  };

  const handleSummarize = async () => {
    if (!ensureSession()) return;

    setIsSummarizing(true);
    try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.id_token) {
            headers['Authorization'] = `Bearer ${session.id_token}`;
        }
        
        const res = await fetch(`${apiBaseUrl}/api/summarize`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || data.summary || "Summarize failed");
        }
        setSummary(data.summary || "No summary available.");
        setSummaryMeta({
            provider: data.provider,
            model: data.model,
            remaining: data.remaining_summaries,
        });
    } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to summarize. AI might be busy.");
    } finally {
        setIsSummarizing(false);
    }
  };

  const getReadableText = () => {
      const reader = document.getElementById('nook-reader');
      return reader?.innerText || "";
  };

  // --- AI TTS (PRIMARY) ---
  const tryAiTts = async (text: string): Promise<boolean> => {
      if (!aiTtsUrl) return false;
      if (!ensureSession()) return false;
      try {
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (session?.id_token) {
              headers['Authorization'] = `Bearer ${session.id_token}`;
          }
          const res = await fetch(aiTtsUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({ text: text.substring(0, 4000) })
          });
          if (!res.ok) throw new Error("AI TTS failed");
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (audioRef.current) {
              audioRef.current.src = objectUrl;
              await audioRef.current.play();
              audioRef.current.onended = () => setIsPlaying(false);
          }
          return true;
      } catch (e) {
          return false;
      }
  };

  // --- LEGACY (BACKEND) TTS ---
  const tryLegacyTts = async (text: string): Promise<boolean> => {
      if (!legacyTtsEnabled) return false;
      if (!ensureSession()) return false;
      try {
          const headers: HeadersInit = {};
          if (session?.id_token) {
              headers['Authorization'] = `Bearer ${session.id_token}`;
          }
          const res = await fetch(`${apiBaseUrl}/api/speak?text=${encodeURIComponent(text.substring(0, 1000))}`, {
              headers
          });
          if (!res.ok) throw new Error("Legacy TTS failed");
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (audioRef.current) {
              audioRef.current.src = objectUrl;
              await audioRef.current.play();
              audioRef.current.onended = () => setIsPlaying(false);
          }
          return true;
      } catch (e) {
          return false;
      }
  };

  // --- BROWSER NATIVE TTS LOGIC ---
  const speakParagraph = (index: number) => {
      if (!synthRef.current) return;
      
      const reader = document.getElementById('nook-reader');
      if (!reader) return;
      
      const paragraphs = Array.from(reader.querySelectorAll('p, h1, h2, h3, blockquote')); 
      
      if (index >= paragraphs.length) {
          setIsPlaying(false);
          setCurrentParaIndex(-1);
          return;
      }

      // Highlight
      document.querySelectorAll('#nook-reader .bg-yellow-100').forEach(el => 
          el.classList.remove('bg-yellow-100', 'transition-colors', 'duration-500', 'p-2', 'rounded')
      );
      const p = paragraphs[index] as HTMLElement;
      p.classList.add('bg-yellow-100', 'transition-colors', 'duration-500', 'p-2', 'rounded');
      p.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const text = p.textContent?.trim();
      if (!text) {
          speakParagraph(index + 1);
          return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
          if (isPlaying) speakParagraph(index + 1);
      };
      utterance.onerror = (e) => {
          console.error("Speech error", e);
          setIsPlaying(false);
      };
      
      // Select a nice voice if available
      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
      if (preferredVoice) utterance.voice = preferredVoice;

      speechRef.current = utterance;
      synthRef.current.speak(utterance);
      setCurrentParaIndex(index);
  };

  const handleListen = async () => {
      if (!synthRef.current) return;

      if (isPlaying) {
          synthRef.current.cancel();
          audioRef.current?.pause();
          setIsPlaying(false);
          document.querySelectorAll('#nook-reader .bg-yellow-100').forEach(el => 
              el.classList.remove('bg-yellow-100', 'p-2', 'rounded')
          );
          return;
      }

      const text = getReadableText();
      if (!text) return;

      setIsPlaying(true);

      const aiOk = await tryAiTts(text);
      if (aiOk) return;

      const legacyOk = await tryLegacyTts(text);
      if (legacyOk) return;

      // Fallback to native TTS
      speakParagraph(currentParaIndex === -1 ? 0 : currentParaIndex);
  };

  const handleSave = async () => {
      if (!ensureSession()) return;
      setIsSaving(true);
      try {
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (session?.id_token) {
            headers['Authorization'] = `Bearer ${session.id_token}`;
          }

          const payload = {
              url: url,
              title: meta?.title || 'Untitled Article',
              thumbnail_url: meta?.thumbnail_url,
              author: meta?.author,
              published_at: meta?.published_at
          };

          const res = await fetch(`${apiBaseUrl}/api/save`, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
          });
          
          const data = await res.json();
          if (!res.ok) {
              throw new Error(data.detail || "Save failed");
          }
          if (data.success) {
              alert(data.message || "Saved to Library!");
          } else {
              alert("Failed to save: " + (data.detail || "Unknown error"));
          }
      } catch (e) {
          alert(e instanceof Error ? e.message : "Failed to save");
      } finally {
          setIsSaving(false);
      }
  };

  const summaryPoints = summary
      ? summary.split(/(?:\u2022|\*|-)/).map(s => s.trim()).filter(s => s.length > 10)
      : [];

  const safeHtml = useMemo(() => {
      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, [html]);

  const proxyPdfUrl = pdfUrl ? `${apiBaseUrl}/api/proxy_pdf?url=${encodeURIComponent(pdfUrl)}` : '';

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-serif">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto px-6 py-12"
      >
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
              <Button 
                  variant="ghost"
                  onClick={() => { 
                      if (synthRef.current) synthRef.current.cancel();
                      if (audioRef.current) audioRef.current.pause();
                      onBack(); 
                  }}
                  className="pl-0 hover:pl-2 transition-all text-slate-500 font-sans"
              >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
              </Button>

              <div className="flex items-center gap-2">
                  <div className="flex space-x-2">
                      {!session && (
                          <div className="text-xs text-indigo-600 font-medium mr-2 flex items-center font-sans"> 
                              Sign in for features -&gt;
                          </div>
                      )}
                      {contentType !== 'pdf' && (
                          <Button variant={isPlaying ? "primary" : "secondary"} size="sm" onClick={handleListen} title="Listen">
                              {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                              {isPlaying ? 'Stop' : 'Listen'}
                          </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={handleSummarize} disabled={isSummarizing}>
                          <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                          {isSummarizing ? 'Thinking...' : 'Summarize'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleSave} disabled={isSaving}>
                          <Bookmark className="w-4 h-4 mr-2" />
                          Save
                      </Button>
                  </div>
              </div>
          </div>

          {/* Enhanced Metadata Header */}
          {meta && (
              <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {meta.thumbnail_url && contentType !== 'pdf' && (
                      <div className="h-52 w-full overflow-hidden">
                          <img src={meta.thumbnail_url} alt="Cover" className="h-full w-full object-cover" />
                      </div>
                  )}
                  <div className="p-6 text-slate-900">
                      <h1 className="text-3xl font-bold mb-4 leading-tight font-serif">{meta.title}</h1>
                      <div className="flex items-center gap-4 text-sm text-slate-500 font-sans">
                          <div className="flex flex-col">
                              <span className="font-semibold text-slate-900">{meta.author || 'Unknown Author'}</span>
                              <span>{meta.published_at || 'Recently Published'} &bull; {meta.source || 'Web'}</span>
                          </div>
                      </div>
                      {meta.tags && meta.tags.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                              {meta.tags.slice(0, 8).map((tag) => (
                                  <span key={tag} className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-full border border-indigo-100">
                                      {tag}
                                  </span>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {summaryPoints.length > 0 && (
              <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100 text-slate-900 animate-fade-in">
                  <h4 className="font-bold flex items-center mb-4">
                      <Sparkles className="w-4 h-4 mr-2 text-indigo-500" /> Nook Note
                  </h4>
                  <ul className="space-y-3">
                      {summaryPoints.map((point, i) => (
                          <li key={i} className="flex items-start">
                              <span className="mr-2 text-indigo-500">-</span>
                              <span className="text-sm leading-relaxed">{point}</span>
                          </li>
                      ))}
                  </ul>
                  {summaryMeta && (
                      <div className="mt-4 text-xs text-slate-500">
                          AI summary uses credits. Remaining: {summaryMeta.remaining ?? "n/a"} | Provider: {summaryMeta.provider || "n/a"} {summaryMeta.model ? ` | ${summaryMeta.model}` : ""}
                      </div>
                  )}
              </div>
          )}
          
          {contentType === 'pdf' && proxyPdfUrl ? (
             <div className="w-full h-[800px] border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-slate-900">
                  <iframe 
                      src={proxyPdfUrl} 
                      className="w-full h-full"
                      title="PDF Reader"
                  />
             </div>
          ) : (
            <div 
                id="nook-reader"
                className="prose prose-lg prose-slate md:prose-xl max-w-none font-serif prose-headings:font-serif prose-headings:font-bold prose-p:text-slate-800 prose-a:text-indigo-700"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          )}
      </motion.div>
    </div>
  );
}
