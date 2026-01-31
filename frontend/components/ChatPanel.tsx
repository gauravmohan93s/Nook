'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Sparkles, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/utils/api';
import { useSession } from 'next-auth/react';
import DOMPurify from 'dompurify';

interface Message {
    role: 'user' | 'ai';
    content: string;
}

interface ChatPanelProps {
    url: string;
    onClose: () => void;
}

export default function ChatPanel({ url, onClose }: ChatPanelProps) {
    const { data: session } = useSession();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const apiUrl = getApiUrl();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const formatMessage = (text: string) => {
        // 1. Escape HTML (handled by DOMPurify later, but good practice)
        // 2. Bold: **text** -> <b>text</b>
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        
        // 3. Lists: * text -> <li>text</li> (Wrapped in <ul> if strictly parsing, but simple replacement helps)
        // Simple heuristic: If line starts with * or -, make it a list item
        formatted = formatted.replace(/^\s*[\*\-]\s+(.*)$/gm, '<li class="ml-4">$1</li>');
        
        // 4. Line breaks: \n -> <br>
        formatted = formatted.replace(/\n/g, '<br />');
        
        return DOMPurify.sanitize(formatted);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch(`${apiUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.id_token}`
                },
                body: JSON.stringify({ url, message: userMsg })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to get answer');
            }

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
        } catch (err: any) {
            setMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full md:w-96 bg-white shadow-2xl border-l border-slate-200 z-[60] flex flex-col"
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Chat with Article</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nook AI Assistant</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-slate-900 font-medium">Ask anything about this article</p>
                            <p className="text-xs text-slate-500 mt-1">AI will answer based on the content provided.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 w-full">
                            {["Summarize the main argument", "What are the key takeaways?", "Explain the methodology"].map(q => (
                                <button 
                                    key={q}
                                    onClick={() => setInput(q)}
                                    className="text-xs p-2 rounded-lg border border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all text-left"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                        }`}>
                            <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 p-3 rounded-2xl rounded-bl-none border border-slate-200">
                            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                <div className="relative flex items-center">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your question..."
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        disabled={loading}
                    />
                    <button 
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors shadow-md"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </motion.div>
    );
}
