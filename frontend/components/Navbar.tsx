import { auth } from "@/auth"
import { loginAction, logoutAction } from "@/app/actions"

export default async function Navbar() {
  const session = await auth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 transition-all">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-serif font-bold text-xl shadow-md shadow-indigo-500/20">
          n
        </div>
        <span className="text-xl font-serif font-bold text-gray-900 tracking-tight">Nook</span>
      </div>
      
      <div className="flex items-center space-x-6">
        {session && session.user ? (
          <div className="flex items-center space-x-4">
             <span className="text-sm font-medium text-gray-700 hidden md:inline">
               {session.user.name}
             </span>
             {session.user.image && (
               <img src={session.user.image} alt="User" className="w-8 h-8 rounded-full border border-gray-200" />
             )}
             <form action={logoutAction}>
                <button className="text-sm font-medium text-secondary hover:text-red-600 transition-colors">
                  Sign Out
                </button>
             </form>
          </div>
        ) : (
          <form action={loginAction}>
            <button className="px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/10">
              Sign In
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}
