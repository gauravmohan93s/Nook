'use client';

import Link from "next/link";
import { useState } from "react";
import { Menu, X, LayoutDashboard, Compass, Settings, LogOut, Library } from "lucide-react";
import { usePathname } from "next/navigation";

interface NavLinksProps {
  user?: {
    name?: string | null;
    image?: string | null;
  };
  loginAction: () => void;
  logoutAction: () => void;
}

export default function NavLinks({ user, loginAction, logoutAction }: NavLinksProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Discover", href: "/dashboard/discover", icon: Compass },
    { name: "Library", href: "/library", icon: Library },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <div className="hidden md:flex items-center space-x-6">
        {user ? (
          <div className="flex items-center space-x-4">
             <Link href="/dashboard" className={`text-sm font-medium transition-colors ${pathname === '/dashboard' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}>
                Dashboard
             </Link>
             <Link href="/dashboard/discover" className={`text-sm font-medium transition-colors ${pathname === '/dashboard/discover' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}>
                Discover
             </Link>
             <Link href="/library" className={`text-sm font-medium transition-colors ${pathname === '/library' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}>
                Library
             </Link>
             <span className="text-sm font-medium text-slate-300">|</span>
             {user.image && (
               <img src={user.image} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
             )}
             <button onClick={() => logoutAction()} className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors">
               Sign Out
             </button>
          </div>
        ) : (
          <button onClick={() => loginAction()} className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
            Sign In
          </button>
        )}
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-xl flex flex-col p-4 space-y-2 md:hidden animate-in slide-in-from-top-2 z-50">
          {user ? (
            <>
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 mb-2">
                {user.image ? (
                  <img src={user.image} alt="User" className="w-10 h-10 rounded-full border border-slate-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                    {user.name?.charAt(0)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900">{user.name}</span>
                  <span className="text-xs text-slate-500">Signed in</span>
                </div>
              </div>
              
              {navItems.map((item) => (
                <Link 
                  key={item.href}
                  href={item.href} 
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 text-base font-medium px-4 py-3 rounded-xl transition-colors ${pathname === item.href ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
              
              <div className="pt-2 border-t border-slate-100 mt-2">
                <button 
                  onClick={() => { logoutAction(); setIsOpen(false); }}
                  className="flex items-center space-x-3 text-base font-medium text-red-600 px-4 py-3 rounded-xl hover:bg-red-50 w-full text-left transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => { loginAction(); setIsOpen(false); }}
              className="w-full py-3.5 text-center text-base font-bold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Sign In to Nook
            </button>
          )}
        </div>
      )}
    </>
  );
}
