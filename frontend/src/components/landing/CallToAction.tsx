import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const CallToAction = () => {
  const { session } = useAuthStore();
  
  return (
    <section className="py-24 border-t border-[#1f1f23] bg-[#09090b]">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="app-card p-12 text-center">
          <h2 className="text-3xl font-bold font-display text-white mb-3">Ready to break the monolith?</h2>
          <p className="text-sm text-zinc-400 mb-8 max-w-2xl mx-auto">
            Stop debating architecture in endless meetings. Let AI give you the data-driven blueprint you need today.
          </p>
          <Link to={session ? "/dashboard" : "/login"} className="btn-primary inline-block text-xs">
            Start Your Transformation Free
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
