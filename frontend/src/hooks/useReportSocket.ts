import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

/**
 * Joins the project's Socket.io room and refetches the report query the
 * instant the API Gateway relays a `report_completed` event (which it
 * receives from the AI service over Redis pub/sub — see api-gateway/socket.js
 * and ai-service/services/realtime.py). This complements the 3s polling
 * fallback in useProjectReport by delivering the update immediately instead
 * of waiting for the next poll tick.
 */
export const useReportSocket = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const socket = io(WS_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
      socket.emit('join_project', projectId);
    });

    socket.on('report_completed', (payload: { project_id: string; status: string }) => {
      if (payload?.project_id === projectId) {
        queryClient.invalidateQueries({ queryKey: ['report', projectId] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, queryClient]);
};
