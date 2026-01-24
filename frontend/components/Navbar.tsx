import { auth } from "@/auth"
import { loginAction, logoutAction } from "@/app/actions"
import NavLinks from "./NavLinks"
import Link from "next/link"

export default async function Navbar() {
  const session = await auth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 transition-all">
      <Link href="/" className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-serif font-bold text-xl shadow-md shadow-indigo-600/20">
          n
        </div>
        <span className="text-xl font-serif font-bold text-slate-900 tracking-tight">Nook</span>
      </Link>
      
      <NavLinks 
        user={session?.user} 
        loginAction={loginAction} 
        logoutAction={logoutAction} 
      />
    </nav>
  );
}
