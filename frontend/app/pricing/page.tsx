'use client';

import { Check } from "lucide-react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";

export default function Pricing() {
  const { data: session } = useSession();

  const handleUpgrade = async () => {
      if (!session?.user?.email) return alert("Please login first.");
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upgrade`, {
          method: 'POST',
          headers: { 'X-User-Email': session.user.email }
      });
      
      if (res.ok) {
          alert("Welcome to Insider! You now have unlimited reads.");
      } else {
          alert("Upgrade failed. Please try again.");
      }
  };

  const tiers = [
    {
      name: "Seeker",
      price: "$0",
      desc: "For the casual reader.",
      features: ["3 AI unlocks per day", "Curated news feed", "Weekly newsletter"],
      cta: "Current Plan",
      active: true,
      action: () => {}
    },
    {
      name: "Insider",
      price: "$2.99",
      period: "/mo",
      desc: "For the knowledge worker.",
      features: ["Unlimited unlocks", "AI Summaries (GPT-4)", "Audio narration (TTS)", "Save to Library"],
      cta: "Upgrade to Insider",
      featured: true,
      action: handleUpgrade
    },
    {
      name: "Patron",
      price: "$5.99",
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
