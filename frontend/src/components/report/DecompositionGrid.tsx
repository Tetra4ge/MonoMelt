import React from 'react';
import { Layers, Users, Link as LinkIcon } from 'lucide-react';

export const DecompositionGrid = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) return <div className="text-gray-500 text-xs">No decomposition data.</div>;

  return (
    <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide">&gt; proposed_microservices</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.map((service, idx) => (
          <div key={idx} className="bg-[#0a0a0a] border border-[#333] p-5 hover:border-blue-500 transition-colors group flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
              <h3 className="font-bold text-white text-sm tracking-wide">{service.service_name}</h3>
            </div>
            
            <p className="text-gray-400 text-xs mb-5 font-sans flex-grow">
              {service.rationale}
            </p>
            
            <div className="flex items-center justify-between border-t border-[#222] pt-4 mt-auto">
              <div className="flex items-center gap-2 text-gray-500">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">TEAM: {service.team_allocation}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-500">
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">DEPS: {service.dependencies?.length || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
