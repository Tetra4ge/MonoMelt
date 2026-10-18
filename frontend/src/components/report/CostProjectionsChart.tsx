import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useThemeStore } from '../../stores/themeStore';

export const CostProjectionsChart = ({ data }: { data: any }) => {
  const isLight = useThemeStore((state) => state.theme) === 'light';
  const axisLine = isLight ? '#a3a3a3' : '#555';
  const axisText = isLight ? '#4d4d4d' : '#888';

  if (!data) return <div className="text-gray-500 text-xs p-8 text-center border border-dashed border-[#333]">Cost data unavailable.</div>;

  const chartData = [
    { name: 'Monolith', cost: data.current_monolith_cost_monthly },
    { name: 'Microservices', cost: data.projected_microservices_cost_monthly }
  ];

  return (
    <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl h-full flex flex-col">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide">&gt; financial_projection</h2>
      
      <div className="flex-grow min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke={axisLine} tick={{fill: axisText, fontSize: 12}} />
            <YAxis stroke={axisLine} tick={{fill: axisText, fontSize: 12}} />
            <Tooltip 
              cursor={{fill: isLight ? '#efefef' : '#1a1a1a'}}
              contentStyle={{ backgroundColor: isLight ? '#ffffff' : '#0a0a0a', border: `1px solid ${isLight ? '#cfcfcf' : '#333'}`, color: isLight ? '#0a0a0a' : '#fff', fontSize: '12px' }} 
            />
            <Bar dataKey="cost" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#333]">
        <p className="text-xs text-gray-400 font-mono flex justify-between items-center">
          <span>infra_multiplier:</span>
          <span className="font-bold text-blue-400 text-sm">{data.infrastructure_multiplier}x</span>
        </p>
      </div>
    </div>
  );
};
