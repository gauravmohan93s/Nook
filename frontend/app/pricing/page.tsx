'use client';

import { Check } from "lucide-react";
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (!session?.id_token) return alert("Please login first.");
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
              alert("Payment Successful. Welcome to Nook.");
              router.refresh();
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch {
            alert("Verification error.");
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
        alert(e.message);
      } else {
        alert("An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const tiers = [
    {
      name: "Seeker",
      price: "INR 0",
      desc: "For the casual reader.",
      features: ["3 unlocks per day", "Reader view", "Community updates"],
      cta: "Current Plan",
      active: true,
      action: () => {}
    },
    {
      name: "Scholar",
      price: "INR 299",
      period: "/mo",
      desc: "For the knowledge worker.",
      features: ["Unlimited unlocks", "AI summaries", "Audio narration", "Save to Library"],
      cta: loading ? "Processing..." : "Upgrade to Scholar",
      featured: true,
      action: () => handleUpgrade('scholar')
    },
    {
      name: "Insider",
      price: "INR 699",
      period: "/mo",
      desc: "For the power user.",
      features: ["All Scholar features", "Priority support", "Unlimited AI usage"],
      cta: loading ? "Processing..." : "Go Insider",
      action: () => handleUpgrade('insider')
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-24 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl font-serif font-bold text-slate-900 mb-6">
            Invest in your mind.
          </h1>
          <p className="text-xl text-slate-500">
            Choose the plan that fits your reading habits. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div key={tier.name} className={`relative p-8 rounded-3xl border ${tier.featured ? 'border-indigo-200 bg-indigo-50/60 shadow-xl scale-105' : 'border-slate-200 bg-white'} transition-all`}>
              <h3 className="text-2xl font-serif font-bold text-slate-900">{tier.name}</h3>
              <p className="text-slate-500 mt-2 text-sm">{tier.desc}</p>

              <div className="my-8">
                <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                {tier.period && <span className="text-slate-500">{tier.period}</span>}
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
                disabled={loading}
                variant={tier.featured ? 'primary' : 'secondary'}
                className="w-full"
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
