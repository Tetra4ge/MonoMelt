import { Loader2 } from 'lucide-react';

interface GenerationStatusProps {
  status: string;
}

export default function GenerationStatus({ status }: GenerationStatusProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-[#111] border border-[#222] rounded-md shadow-2xl">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-6" />
      <h3 className="text-xl font-bold text-white mb-2">Generating Infrastructure...</h3>
      <p className="text-gray-400 text-sm">
        {status === 'generating' 
          ? 'Translating your architectural plan into production-ready Terraform modules and microservice boilerplates...'
          : 'Finalizing blueprint artifacts...'}
      </p>
    </div>
  );
}
