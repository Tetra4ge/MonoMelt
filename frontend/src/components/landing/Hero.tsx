import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Copy, LogIn, LayoutDashboard } from 'lucide-react';

const Hero = () => {
  const { session } = useAuthStore();
  const navigate = useNavigate();

  const handleDashboardClick = () => {
    if (session) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <section className="relative pt-12 pb-20 lg:pb-32">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Mock Navbar (matching the screenshot vibe) */}
        <div className="flex justify-between items-center mb-12 md:mb-24 pb-4 md:pb-8">
          <div className="text-2xl md:text-4xl font-logo tracking-widest text-gray-200">monomelt</div>
          <div className="hidden md:flex gap-8 text-sm text-gray-400">
            <a href="https://github.com/Tetra4ge/monomelt" target="_blank" rel="noopener noreferrer" className="hover:text-white cursor-pointer transition-colors">GitHub</a>
            <span className="hover:text-white cursor-pointer transition-colors">Docs</span>
            <span className="hover:text-white cursor-pointer transition-colors">Data</span>
            <span className="hover:text-white cursor-pointer transition-colors">Zen</span>
            <span onClick={handleDashboardClick} className="hover:text-white cursor-pointer transition-colors">Dashboard</span>
          </div>
          <Link to={session ? "/dashboard" : "/login"} className="px-4 py-2 bg-white text-black font-bold text-sm rounded-sm hover:bg-gray-200 transition-colors flex items-center gap-2">
            {session ? <LayoutDashboard className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {session ? "Dashboard" : "Try It"}
          </Link>
        </div>

        {/* Badge */}
        <div className="inline-block border border-[#222] bg-[#0a0a0a] text-gray-400 text-[10px] sm:text-xs mb-8 p-1 leading-relaxed">
          <span className="bg-white text-black px-2 py-0.5 mr-2 font-bold inline-block">New</span>
          <span>Introducing full AST parsing for legacy monoliths. <Link to={session ? "/dashboard" : "/login"} className="text-gray-500 hover:text-white ml-1">Try it now</Link></span>
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
          The open source AI <br className="hidden md:block" /> monolith deconstructor
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base lg:text-lg text-gray-400 max-w-2xl mb-12 leading-relaxed">
          Upload your legacy codebase and let our AI agents analyze ASTs, identify bounded contexts, and generate production-ready microservices instantly.
        </p>

        {/* Terminal Box */}
        <div className="bg-[#111] border border-[#222] rounded-sm w-full max-w-3xl overflow-hidden">
          <div className="flex gap-4 md:gap-8 px-4 md:px-6 py-4 border-b border-[#222] text-xs md:text-sm font-bold overflow-x-auto whitespace-nowrap">
            <span className="text-white cursor-pointer">curl</span>
            <span className="text-gray-600 cursor-pointer hover:text-gray-400">npm</span>
            <span className="text-gray-600 cursor-pointer hover:text-gray-400">bun</span>
            <span className="text-gray-600 cursor-pointer hover:text-gray-400">brew</span>
            <span className="text-gray-600 cursor-pointer hover:text-gray-400">paru</span>
          </div>
          <div className="px-4 md:px-6 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs md:text-sm font-mono">
            <div className="flex items-center text-gray-400 break-all sm:break-normal">
              <span className="text-emerald-500 font-bold mr-2">~</span>
              <span className="text-blue-400 font-bold mr-3">$</span>
              <span className="text-white font-bold">
                git clone https://github.com/Tetra4ge/monomelt.git
              </span>
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-2 align-middle"></span>
            </div>
            <Copy className="w-4 h-4 text-gray-600 hover:text-white cursor-pointer transition-colors self-end sm:self-auto shrink-0" />
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
