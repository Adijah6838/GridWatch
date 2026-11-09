import { Server } from 'socket.io';

let io: Server | null = null;

export function startWebSocketServer(port: number = 3001) {
  io = new Server(port, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('Client connected to WebSocket:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  console.log(`WebSocket server running on port ${port}`);
  return io;
}

export function broadcastTelemetry(data: any) {
  if (io) {
    io.emit('telemetry', data);
  }
}
