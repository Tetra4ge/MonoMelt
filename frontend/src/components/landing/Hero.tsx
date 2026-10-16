import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LogIn, LayoutDashboard } from 'lucide-react';

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
            <a href="https://github.com/Tetra4ge/MonoMelt#readme" target="_blank" rel="noopener noreferrer" className="hover:text-white cursor-pointer transition-colors">Docs</a>
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
          <span>A Digital Twin observatory and Notion report export are live. <Link to={session ? "/dashboard" : "/login"} className="text-gray-500 hover:text-white ml-1">Open the workspace</Link></span>
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
          Break up the monolith <br className="hidden md:block" /> with evidence, not guesswork
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base lg:text-lg text-gray-400 max-w-2xl mb-12 leading-relaxed">
          Upload a ZIP or a public GitHub repository. MonoMELT maps how the code really depends on itself, proposes service boundaries, and produces a migration plan, a cost and risk report, and starter files for the new services.
        </p>

        {/* Terminal Box */}
        <div className="bg-[#111] border border-[#222] rounded-sm w-full max-w-3xl overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-[#222] text-xs md:text-sm font-bold text-gray-500">
            run it locally
          </div>
          <div className="px-4 md:px-6 py-6 flex flex-col gap-3 text-xs md:text-sm font-mono">
            <div className="flex items-center text-gray-400 break-all sm:break-normal">
              <span className="text-emerald-500 font-bold mr-2">~</span>
              <span className="text-blue-400 font-bold mr-3">$</span>
              <span className="text-white font-bold">git clone https://github.com/Tetra4ge/MonoMelt.git</span>
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-2 align-middle"></span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
