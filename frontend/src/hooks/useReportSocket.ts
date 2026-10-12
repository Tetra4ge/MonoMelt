import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

/**
 * Joins the project's Socket.io room and refetches the report query the
 * instant the API Gateway relays a `report_completed` event (which it
 * receives from the AI service over Redis pub/sub - see api-gateway/socket.js
 * and ai-service/services/realtime.py). This complements the 3s polling
 * fallback in useProjectReport by delivering the update immediately instead
 * of waiting for the next poll tick.
 *
 * The gateway only accepts authenticated sockets and only lets a user join
 * rooms for projects they own, so the Supabase access token is sent on connect.
 */
export const useReportSocket = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    let socket: ReturnType<typeof io> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (cancelled || !token) return;

      socket = io(WS_URL, { transports: ['websocket'], auth: { token } });

      socket.on('connect', () => {
        socket?.emit('join_project', projectId);
      });

      socket.on('report_completed', (payload: { project_id: string; status: string }) => {
        if (payload?.project_id === projectId) {
          queryClient.invalidateQueries({ queryKey: ['report', projectId] });
        }
      });
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [projectId, queryClient]);
};
