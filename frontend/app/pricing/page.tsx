'use client';

import { getApiUrl } from '@/utils/api';
import { Check, HelpCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

// Razorpay types
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOrder {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  detail?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Pricing() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const apiUrl = getApiUrl();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- OFFER PERIOD SCHEME (COUNTDOWN) ---
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const difference = tomorrow.getTime() - now.getTime();
      
      if (difference > 0) {
        return {
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        };
      }
      return { hours: 0, minutes: 0, seconds: 0 };
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    
    setTimeLeft(calculateTimeLeft()); 

    return () => clearInterval(timer);
  }, []);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');

  const handleUpgrade = async (planId: string) => {
    if (!session?.id_token) return setToast({ type: 'error', message: "Please login first." });
    setLoading(true);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      headers['Authorization'] = `Bearer ${session.id_token}`;

      const res = await fetch(`${apiUrl}/api/create-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan_id: planId })
      });

      const order: RazorpayOrder = await res.json();
      if (!order.order_id) {
        throw new Error(order.detail || "Failed to create order");
      }

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Nook",
        description: `Upgrade to ${planId}`,
        image: "/logo.png",
        order_id: order.order_id,
        handler: async function (response: RazorpayResponse) {
          try {
            const verifyRes = await fetch(`${apiUrl}/api/verify-payment`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: planId
              })
            });

            if (verifyRes.ok) {
              setToast({ type: 'success', message: "Welcome to Nook. Your account has been upgraded." });
              router.refresh();
            } else {
              setToast({ type: 'error', message: "Payment verification failed. Please contact support." });
            }
          } catch {
            setToast({ type: 'error', message: "Verification error." });
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
      if (e instanceof Error) {
        setToast({ type: 'error', message: e.message });
      } else {
        setToast({ type: 'error', message: "An error occurred." });
      }
    } finally {
      setLoading(false);
    }
  };

  const tiers = [
    {
      name: "Seeker",
      price: "Free",
      originalPrice: null,
      desc: "For the casual reader.",
      features: ["1 unlock per day", "Reader view", "Community updates"],
      cta: "Current Plan",
      active: true,
      action: () => {}
    },
    {
      name: "Scholar",
      price: currency === 'USD' ? (billingCycle === 'monthly' ? '$4.99' : '$49.99') : (billingCycle === 'monthly' ? 'INR 299' : 'INR 2999'),
      originalPrice: currency === 'USD' ? (billingCycle === 'monthly' ? '$9.99' : '$99.99') : (billingCycle === 'monthly' ? 'INR 499' : 'INR 5998'),
      period: billingCycle === 'monthly' ? "/mo" : "/yr",
      desc: "For the knowledge worker.",
      features: ["Unlimited unlocks", "AI summaries", "Audio narration", "Save to Library"],
      cta: loading ? "Processing..." : "Upgrade to Scholar",
      featured: true,
      action: () => handleUpgrade('scholar')
    },
    {
      name: "Insider",
      price: currency === 'USD' ? (billingCycle === 'monthly' ? '$9.99' : '$99.99') : (billingCycle === 'monthly' ? 'INR 699' : 'INR 6999'),
      originalPrice: currency === 'USD' ? (billingCycle === 'monthly' ? '$19.99' : '$199.99') : (billingCycle === 'monthly' ? 'INR 1299' : 'INR 15588'),
      period: billingCycle === 'monthly' ? "/mo" : "/yr",
      desc: "For the power user.",
      features: ["All Scholar features", "Priority support", "Unlimited AI usage"],
      cta: loading ? "Processing..." : "Go Insider",
      action: () => handleUpgrade('insider')
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-24 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl border flex items-center animate-in slide-in-from-right-10 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-700'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-3 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* FOUNDATIONAL BANNER */}
      <div className="bg-slate-900 text-white py-3 px-4 text-center shadow-md">
        <p className="text-sm md:text-base font-medium flex items-center justify-center gap-2">
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Foundational Membership</span>
          <span>Lock in your <strong>preferred rate permanently</strong>. Invitation expires in:</span>
          <span className="font-mono font-bold bg-white/10 px-2 rounded">
            {String(timeLeft.hours).padStart(2, '0')}h : {String(timeLeft.minutes).padStart(2, '0')}m : {String(timeLeft.seconds).padStart(2, '0')}s
          </span>
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-5xl font-serif font-bold text-slate-900 mb-6">
            Secure your legacy access.
          </h1>
          <p className="text-xl text-slate-500 mb-8">
            Nook is built for the long-term scholar. Our foundational tiers ensure you always have the standard for deep research.
          </p>
          
          <div className="flex flex-col items-center gap-6">
            {/* Billing Toggle */}
            <div className="flex justify-center items-center space-x-4">
                <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-indigo-600' : 'text-slate-500'}`}>Monthly</span>
                <button 
                onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                className="w-14 h-7 bg-indigo-100 rounded-full p-1 relative transition-colors duration-300 focus:outline-none"
                >
                <div className={`w-5 h-5 bg-indigo-600 rounded-full shadow-md transform transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-7' : ''}`} />
                </button>
                <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-indigo-600' : 'text-slate-500'}`}>
                Yearly <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">-20%</span>
                </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {tiers.map((tier) => (
            <div key={tier.name} className={`relative p-8 rounded-3xl border ${tier.featured ? 'border-indigo-200 bg-indigo-50/60 shadow-xl scale-105 z-10' : 'border-slate-200 bg-white'} transition-all`}>
              {tier.originalPrice && (
                 <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                   LIMITED TIME OFFER
                 </div>
              )}
              
              <h3 className="text-2xl font-serif font-bold text-slate-900">{tier.name}</h3>
              <p className="text-slate-500 mt-2 text-sm">{tier.desc}</p>

              <div className="my-8">
                {tier.originalPrice && (
                  <span className="text-lg text-slate-400 line-through mr-2">{tier.originalPrice}</span>
                )}
                <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                {tier.period && <span className="text-slate-500">{tier.period}</span>}
                
                {tier.price !== 'Free' && (
                    <div className="mt-2">
                        <button 
                            onClick={() => setCurrency(prev => prev === 'USD' ? 'INR' : 'USD')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 underline decoration-dotted underline-offset-2"
                        >
                            {currency === 'USD' ? 'Switch to INR (₹)' : 'Switch to USD ($)'}
                        </button>
                    </div>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="w-5 h-5 text-indigo-700 mr-3 shrink-0" />
                    <span className="text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={tier.action}
                disabled={loading || (billingCycle === 'yearly' && tier.price !== 'Free')} 
                variant={tier.featured ? 'primary' : 'secondary'}
                className="w-full"
              >
                {billingCycle === 'yearly' && tier.price !== 'Free' ? 'Coming Soon' : tier.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-serif font-bold text-center mb-8">Frequently Asked Questions</h2>
            <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-lg flex items-center"><HelpCircle className="w-5 h-5 mr-3 text-indigo-600"/> Can I cancel anytime?</h3>
                    <p className="text-slate-600 mt-2 ml-8">Yes. You can cancel your subscription at any time from your dashboard. You will retain access until the end of your billing cycle.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-lg flex items-center"><HelpCircle className="w-5 h-5 mr-3 text-indigo-600"/> How does the AI summary work?</h3>
                    <p className="text-slate-600 mt-2 ml-8">We use advanced models like Gemini 2.0 and Llama 3 to read the article and synthesize the core insights into bullet points, saving you reading time.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                    <h3 className="font-bold text-lg flex items-center"><HelpCircle className="w-5 h-5 mr-3 text-indigo-600"/> Is my payment secure?</h3>
                    <p className="text-slate-600 mt-2 ml-8">Yes. We use Razorpay, a globally trusted payment gateway. We do not store your card details.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}