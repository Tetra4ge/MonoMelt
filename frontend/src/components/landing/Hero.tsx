import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Copy, LogIn, LayoutDashboard } from 'lucide-react';

const Hero = () => {
  const { session } = useAuthStore();
  const navigate = useNavigate();

  const handleDashboardClick = () => {
    if (session) {
      navigate('/app/projects');
    } else {
      navigate('/login');
    }
  };

  return (
    <section className="relative pt-12 pb-20 lg:pb-32">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Mock Navbar */}
        <div className="flex justify-between items-center mb-12 md:mb-24 pb-4 md:pb-8 border-b border-[#1f1f23]">
          <div className="text-xl md:text-2xl font-bold tracking-wider text-white flex items-center gap-2 font-display">
            <span className="w-8 h-8 rounded-lg bg-lime-400 text-black flex items-center justify-center font-extrabold text-sm">m</span>
            <span>monomelt</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
            <a href="https://github.com/Tetra4ge/monomelt" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
            <span className="hover:text-white cursor-pointer transition-colors">Docs</span>
            <span className="hover:text-white cursor-pointer transition-colors">Architecture</span>
            <span onClick={handleDashboardClick} className="hover:text-white cursor-pointer transition-colors">Dashboard</span>
          </div>
          <Link to={session ? "/app/projects" : "/login"} className="btn-primary text-xs flex items-center gap-2">
            {session ? <LayoutDashboard className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
            {session ? "Dashboard" : "Get Started"}
          </Link>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-[#232328] bg-[#141417] text-zinc-400 text-xs mb-8 px-3 py-1 rounded-full">
          <span className="bg-lime-400 text-black px-2 py-0.5 font-bold rounded-full text-[10px]">NEW</span>
          <span>Full AST parsing for legacy monoliths. <Link to={session ? "/app/projects" : "/login"} className="text-lime-400 font-bold hover:underline ml-1">Try it now</Link></span>
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display text-white mb-6 leading-tight tracking-tight">
          The open source AI <br className="hidden md:block" /> monolith deconstructor
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mb-12 leading-relaxed">
          Upload your legacy codebase and let AI agents analyze ASTs, identify bounded contexts, and generate production-ready microservices.
        </p>

        {/* Terminal Box */}
        <div className="app-card w-full max-w-3xl overflow-hidden">
          <div className="flex gap-6 px-6 py-3.5 border-b border-[#232328] text-xs font-bold text-zinc-400">
            <span className="text-white cursor-pointer">curl</span>
            <span className="hover:text-zinc-200 cursor-pointer">npm</span>
            <span className="hover:text-zinc-200 cursor-pointer">bun</span>
            <span className="hover:text-zinc-200 cursor-pointer">brew</span>
          </div>
          <div className="px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-mono">
            <div className="flex items-center text-zinc-400 break-all sm:break-normal">
              <span className="text-lime-400 font-bold mr-2">~</span>
              <span className="text-blue-400 font-bold mr-3">$</span>
              <span className="text-white font-semibold">
                git clone https://github.com/Tetra4ge/monomelt.git
              </span>
              <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-2 align-middle"></span>
            </div>
            <Copy className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer transition-colors shrink-0" />
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
