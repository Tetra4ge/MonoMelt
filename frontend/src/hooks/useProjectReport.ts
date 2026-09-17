import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export const useProjectReport = (projectId: string) => {
  return useQuery({
    queryKey: ['report', projectId],
    queryFn: async () => {
      const response = await api.get(`/api/reports/${projectId}`);
      return response.data;
    },
    refetchInterval: (query) => {
      const status = query.state?.data?.data?.status;
      return (status === 'pending' || status === 'generating') ? 3000 : false;
    },
    retry: 1
  });
};
