'use client';

import { Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Add Razorpay types to window object
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Pricing() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Load Razorpay Script dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
        document.body.removeChild(script);
    };
  }, []);

  const handleUpgrade = async () => {
      if (!session) return alert("Please login first.");
      setLoading(true);
      
      try {
        // 1. Create Order
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/create-order`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.id_token}` }
        });
        
        const order = await res.json();
        if (!order.order_id) {
            throw new Error(order.detail || "Failed to create order");
        }

        // 2. Open Razorpay Modal
        const options = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: "Nook",
            description: "Upgrade to Nook Insider",
            image: "/logo.png", // Ensure you have a logo at public/logo.png
            order_id: order.order_id,
            handler: async function (response: any) {
                // 3. Verify Payment on Backend
                try {
                    const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/verify-payment`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.id_token}` 
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });
                    
                    if (verifyRes.ok) {
                        alert("Payment Successful! Welcome to Nook Insider.");
                        router.refresh(); // Refresh to update UI based on new tier
                    } else {
                        alert("Payment verification failed. Please contact support.");
                    }
                } catch (e) {
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
        
      } catch (e: any) {
          alert(e.message || "An error occurred.");
      } finally {
          setLoading(false);
      }
  };

  const tiers = [
    {
      name: "Seeker",
      price: "₹0",
      desc: "For the casual reader.",
      features: ["3 AI unlocks per day", "Curated news feed", "Weekly newsletter"],
      cta: "Current Plan",
      active: true,
      action: () => {}
    },
    {
      name: "Insider",
      price: "₹299",
      period: "/mo",
      desc: "For the knowledge worker.",
      features: ["Unlimited unlocks", "AI Summaries (GPT-4)", "Audio narration (TTS)", "Save to Library"],
      cta: loading ? "Processing..." : "Upgrade to Insider",
      featured: true,
      action: handleUpgrade
    },
    {
      name: "Patron",
      price: "₹599",
      period: "/mo",
      desc: "For the power user.",
      features: ["All Insider features", "Early access to new tools", "Priority support", "No Ads promise"],
      cta: "Become a Patron",
      action: () => alert("Patron tier coming soon!")
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl font-serif font-bold text-gray-900 mb-6">
            Invest in your mind.
          </h1>
          <p className="text-xl text-gray-500">
            Choose the plan that fits your reading habits. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div key={tier.name} className={`relative p-8 bg-white rounded-2xl shadow-sm border ${tier.featured ? 'border-primary ring-1 ring-primary shadow-xl scale-105' : 'border-gray-200'}`}>
              <h3 className="text-2xl font-serif font-bold text-gray-900">{tier.name}</h3>
              <p className="text-gray-500 mt-2 text-sm">{tier.desc}</p>
              
              <div className="my-8">
                <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                {tier.period && <span className="text-gray-500">{tier.period}</span>}
              </div>

              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="w-5 h-5 text-primary mr-3 shrink-0" />
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={tier.action}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-semibold transition-colors ${tier.featured ? 'bg-primary text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}