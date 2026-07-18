import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700/50">
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-400 font-semibold mb-1">
            Tailwind is Working! 🎉
          </div>
          <h1 className="block mt-1 text-2xl leading-tight font-bold text-white mb-2">
            Transformation Intelligence Platform
          </h1>
          <p className="mt-2 text-slate-300 text-sm">
            If you can see this styled card with a dark background, purple text, and rounded corners, it means your Tailwind CSS v4 setup is working perfectly. 
          </p>
          <div className="mt-6 flex gap-4">
            <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors">
              Get Started
            </button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors">
              Documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App;
