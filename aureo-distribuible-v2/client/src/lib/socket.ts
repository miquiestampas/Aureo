import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';

interface SocketStore {
  socket: Socket | null;
  connected: boolean;
  watcherActive: boolean;
  recentEvents: any[];
  initSocket: () => void;
  disconnect: () => void;
  addEvent: (event: any) => void;
  setWatcherActive: (active: boolean) => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  connected: false,
  watcherActive: false,
  recentEvents: [],
  initSocket: () => {
    if (get().socket) return;
    
    const socket = io();
    
    socket.on('connect', () => {
      set({ socket, connected: true });
      console.log('Socket.IO connected');
    });
    
    socket.on('disconnect', () => {
      set({ connected: false });
      console.log('Socket.IO disconnected');
    });
    
    socket.on('watcherStatus', (data) => {
      set({ watcherActive: data.active });
      console.log('Watcher status:', data.active);
    });
    
    socket.on('fileDetected', (data) => {
      get().addEvent({ 
        type: 'fileDetected',
        time: new Date(),
        data
      });
    });
    
    socket.on('fileProcessingStatus', (data) => {
      get().addEvent({
        type: 'fileProcessingStatus',
        time: new Date(),
        data
      });
    });
    
    set({ socket });
  },
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },
  addEvent: (event) => {
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, 20) // Keep last 20 events
    }));
  },
  setWatcherActive: (active) => {
    set({ watcherActive: active });
  }
}));
