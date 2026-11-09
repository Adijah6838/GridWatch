"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = startWebSocketServer;
exports.broadcastTelemetry = broadcastTelemetry;
const socket_io_1 = require("socket.io");
let io = null;
function startWebSocketServer(port = 3001) {
    io = new socket_io_1.Server(port, {
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
function broadcastTelemetry(data) {
    if (io) {
        io.emit('telemetry', data);
    }
}
