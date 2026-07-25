import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/atnight';

// In-Memory Player Store for Real-Time Sync
interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  level: number;
  hp: number;
  maxHp: number;
}

const connectedPlayers = new Map<string, PlayerData>();

// Health & Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    game: 'AtNight Action RPG',
    onlinePlayers: connectedPlayers.size,
    timestamp: new Date()
  });
});

// Socket.io Real-Time Game Event Handling
io.on('connection', (socket: Socket) => {
  console.log(`🎮 Jugador conectado a AtNight: ${socket.id}`);

  // Create initial player state
  const newPlayer: PlayerData = {
    id: socket.id,
    name: `Héroe_${socket.id.substring(0, 4)}`,
    x: 0,
    y: 0,
    level: 1,
    hp: 100,
    maxHp: 100
  };

  connectedPlayers.set(socket.id, newPlayer);

  // Send current player list to newly connected player
  socket.emit('currentPlayers', Array.from(connectedPlayers.values()));

  // Broadcast new player to all other connected clients
  socket.broadcast.emit('playerJoined', newPlayer);

  // Handle player movement update
  socket.on('playerMove', (data: { x: number; y: number }) => {
    const player = connectedPlayers.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  // Handle player attack
  socket.on('playerAttack', (data: { x: number; y: number; damage: number }) => {
    socket.broadcast.emit('playerAttacked', { id: socket.id, x: data.x, y: data.y, damage: data.damage });
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`🚪 Jugador desconectado: ${socket.id}`);
    connectedPlayers.delete(socket.id);
    io.emit('playerLeft', socket.id);
  });
});

// Start Server & Connect MongoDB (optional fallback if offline)
httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🌌 Servidor de Juego AtNight activo en puerto ${PORT}`);
  console.log(`=========================================`);

  mongoose.connect(MONGODB_URI)
    .then(() => console.log('🍃 Conectado a MongoDB (Base de datos AtNight)'))
    .catch(err => console.log('ℹ️ Operando con almacenamiento local/memoria (MongoDB no detectado en local)'));
});
