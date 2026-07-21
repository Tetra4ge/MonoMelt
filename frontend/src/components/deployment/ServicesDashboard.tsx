import { Activity, Cpu, HardDrive, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import type { ServiceHealth } from '../../features/deployment/types';

interface ServicesDashboardProps {
  services: ServiceHealth[];
}

export default function ServicesDashboard({ services }: ServicesDashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {services.map((service) => (
        <div key={service.service_name} className="bg-[#111] border border-[#222] rounded-md p-5 shadow-xl flex flex-col transition-all hover:border-[#333]">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-white font-bold text-lg">{service.service_name}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-500 text-xs font-bold uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </div>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-full">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6 mt-4">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 text-xs uppercase">Uptime</span>
              <span className="text-gray-200 font-mono text-sm">{service.uptime}</span>
            </div>
            <div className="flex flex-col gap-1 border-l border-[#222] pl-4">
              <span className="text-gray-500 text-xs uppercase flex items-center gap-1"><Cpu className="w-3 h-3"/> CPU</span>
              <span className="text-gray-200 font-mono text-sm">{service.cpu_usage}</span>
            </div>
            <div className="flex flex-col gap-1 border-l border-[#222] pl-4">
              <span className="text-gray-500 text-xs uppercase flex items-center gap-1"><HardDrive className="w-3 h-3"/> Mem</span>
              <span className="text-gray-200 font-mono text-sm">{service.memory}</span>
            </div>
          </div>

          {/* Endpoint */}
          <div className="mt-auto pt-4 border-t border-[#222]">
            <a 
              href={service.endpoint_url.startsWith('http') ? service.endpoint_url : `https://${service.endpoint_url}`} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors font-mono"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span className="truncate">{service.endpoint_url}</span>
            </a>
          </div>
          
        </div>
      ))}
    </div>
  );
}
