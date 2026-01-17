export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-serif font-bold text-xl">
          n
        </div>
        <span className="text-xl font-serif font-bold text-gray-900 tracking-tight">Nook</span>
      </div>
      
      <div className="flex items-center space-x-6">
        <button className="text-sm font-medium text-secondary hover:text-primary transition-colors">
          Log in
        </button>
        <button className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition-colors">
          Get Started
        </button>
      </div>
    </nav>
  );
}
