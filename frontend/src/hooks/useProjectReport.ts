import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export const useProjectReport = (projectId: string) => {
  return useQuery({
    queryKey: ['report', projectId],
    queryFn: async () => {
      // The gateway mounts the reports router under the project, not under /api/reports.
      const response = await api.get(`/api/projects/${projectId}/reports`);
      return response.data;
    },
    refetchInterval: (query) => {
      const status = query.state?.data?.data?.status;
      return (status === 'pending' || status === 'generating') ? 3000 : false;
    },
    retry: 1
  });
};
