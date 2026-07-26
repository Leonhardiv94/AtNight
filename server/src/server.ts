import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

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

// ----------------------------------------------------
// LOCAL PERSISTENT FILE DATABASE CONTROLLER (Local DB)
// ----------------------------------------------------
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface CharacterStats {
  vitalidad: { equip: number; base: number };
  sabiduria: { equip: number; base: number };
  aire: { equip: number; base: number };
  tierra: { equip: number; base: number };
  fuego: { equip: number; base: number };
  agua: { equip: number; base: number };
}

export interface SpecialStats {
  tasaMana: number;
  manaTotal: number;
  velocidad: number;
  defensa: number;
  ataque: number;
}

export interface PlayerRecord {
  characterName: string;
  ownerEmail?: string;
  characterClass: 'espadachin' | 'arquero' | 'mago' | 'amigo_sol' | 'amigo_luna';
  gender: 'masculino' | 'femenino';
  skinColor: string;
  hairColor: string;
  outfitColor: string;
  level: number;
  xp: number;
  availablePoints: number;
  elements: CharacterStats;
  specials: SpecialStats;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  inventory: Array<{ id: string; name: string; count: number }>;
  lastPosition: { x: number; y: number };
  updatedAt: string;
}

// Memory Cache synced with players.json
let localPlayersDb: Record<string, PlayerRecord> = {};

function loadLocalDb() {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const data = fs.readFileSync(PLAYERS_FILE, 'utf-8');
      localPlayersDb = JSON.parse(data);
      console.log(`📁 Base de datos local cargada: ${Object.keys(localPlayersDb).length} personajes almacenados.`);
    } else {
      localPlayersDb = {};
      saveLocalDb();
    }
  } catch (err) {
    console.error('Error cargando la base de datos local:', err);
    localPlayersDb = {};
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(localPlayersDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando en la base de datos local:', err);
  }
}

loadLocalDb();

// ----------------------------------------------------
// MONGOOSE SCHEMA (Fase de Producción futuro en MongoDB)
// ----------------------------------------------------
const PlayerSchema = new mongoose.Schema({
  characterName: { type: String, required: true, unique: true },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  availablePoints: { type: Number, default: 0 },
  elements: {
    vitalidad: { equip: { type: Number, default: 0 }, base: { type: Number, default: 0 } },
    sabiduria: { equip: { type: Number, default: 0 }, base: { type: Number, default: 0 } },
    aire: { equip: { type: Number, default: 0 }, base: { type: Number, default: 0 } },
    tierra: { equip: { type: Number, default: 0 }, base: { type: Number, default: 0 } },
    fuego: { equip: { type: Number, default: 0 }, base: { type: Number, default: 0 } },
    agua: { equip: { type: Number, default: 0 }, base: { type: Number, default: 0 } }
  },
  specials: {
    tasaMana: { type: Number, default: 0 },
    manaTotal: { type: Number, default: 0 },
    velocidad: { type: Number, default: 0 },
    defensa: { type: Number, default: 0 },
    ataque: { type: Number, default: 0 }
  },
  hp: { type: Number, default: 100 },
  maxHp: { type: Number, default: 100 },
  mana: { type: Number, default: 10 },
  maxMana: { type: Number, default: 10 },
  inventory: Array,
  lastPosition: { x: Number, y: Number },
  updatedAt: { type: Date, default: Date.now }
});

const MongoPlayer = mongoose.model('Player', PlayerSchema);
let isMongoConnected = false;

// Accounts Database Store
export interface UserAccount {
  email: string;
  passwordHash: string;
  fullName: string;
  idDocument: string;
  birthDate: string;
  country: string;
  characterName: string;
  createdAt: string;
}

let localUsersDb: Record<string, UserAccount> = {};
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsersDb() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      localUsersDb = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } else {
      localUsersDb = {};
      fs.writeFileSync(USERS_FILE, JSON.stringify(localUsersDb, null, 2), 'utf-8');
    }
  } catch (err) {
    localUsersDb = {};
  }
}

function saveUsersDb() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(localUsersDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando usuarios:', err);
  }
}

loadUsersDb();

// ----------------------------------------------------
// REST API ENDPOINTS FOR AUTH & GAME DATA
// ----------------------------------------------------

// 0. Autenticación: Registro
app.post('/api/auth/register', (req, res) => {
  const { email, password, confirmPassword, fullName, idDocument, birthDate, country } = req.body;

  if (!email || !password || !fullName || !idDocument || !birthDate || !country) {
    return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (localUsersDb[cleanEmail]) {
    return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado.' });
  }

  // Generar nombre de personaje derivado del nombre completo
  const charName = fullName.trim().split(' ')[0] + '_' + idDocument.slice(-4);

  const newUser: UserAccount = {
    email: cleanEmail,
    passwordHash: password, // Para dev local
    fullName,
    idDocument,
    birthDate,
    country,
    characterName: charName,
    createdAt: new Date().toISOString()
  };

  localUsersDb[cleanEmail] = newUser;
  saveUsersDb();

  // Inicializar Personaje en players.json
  const defaultPlayer: PlayerRecord = {
    characterName: charName,
    level: 1,
    xp: 0,
    availablePoints: 0,
    elements: {
      vitalidad: { equip: 0, base: 0 },
      sabiduria: { equip: 0, base: 0 },
      aire: { equip: 0, base: 0 },
      tierra: { equip: 0, base: 0 },
      fuego: { equip: 0, base: 0 },
      agua: { equip: 0, base: 0 }
    },
    specials: {
      tasaMana: 0,
      manaTotal: 0,
      velocidad: 0,
      defensa: 0,
      ataque: 0
    },
    hp: 100,
    maxHp: 100,
    mana: 10,
    maxMana: 10,
    inventory: [],
    lastPosition: { x: 0, y: 0 },
    updatedAt: new Date().toISOString()
  };

  localPlayersDb[charName] = defaultPlayer;
  saveLocalDb();

  return res.json({
    success: true,
    message: '¡Registro completado exitosamente!',
    user: newUser,
    player: defaultPlayer
  });
});

// 0. Autenticación: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Ingresa correo y contraseña.' });
  }

  loadLocalDb();
  const cleanEmail = email.trim().toLowerCase();
  const user = localUsersDb[cleanEmail];

  if (!user || user.passwordHash !== password) {
    return res.status(400).json({ success: false, message: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
  }

  // Vincular cualquier personaje sin ownerEmail a este usuario al iniciar sesión
  let hasUpdates = false;
  Object.values(localPlayersDb).forEach(p => {
    if (!p.ownerEmail) {
      p.ownerEmail = cleanEmail;
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    saveLocalDb();
  }

  const userCharacters = Object.values(localPlayersDb).filter(p => !p.ownerEmail || p.ownerEmail.toLowerCase() === cleanEmail);

  return res.json({
    success: true,
    message: `¡Bienvenido de nuevo, ${user.fullName}!`,
    user,
    characters: userCharacters
  });
});

// 0. Listar todos los personajes pertenecientes o vinculados a la cuenta del usuario
app.get('/api/player/list/:email', (req, res) => {
  loadLocalDb();
  const email = req.params.email.trim().toLowerCase();
  
  // Asignar ownerEmail a cualquier personaje que aún no tenga propietario asignado
  let hasUpdates = false;
  Object.values(localPlayersDb).forEach(p => {
    if (!p.ownerEmail) {
      p.ownerEmail = email;
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    saveLocalDb();
  }

  const characters = Object.values(localPlayersDb).filter(p => !p.ownerEmail || p.ownerEmail.toLowerCase() === email);
  return res.json({ success: true, characters });
});

// GET /api/player/:name - Obtener datos completos de un personaje por nombre
app.get('/api/player/:name', (req, res) => {
  loadLocalDb();
  const { name } = req.params;
  const cleanName = name.trim().toLowerCase();
  const player = Object.values(localPlayersDb).find(p => p.characterName.toLowerCase() === cleanName);
  if (player) {
    return res.json({ success: true, player });
  } else {
    return res.status(404).json({ success: false, message: 'Personaje no encontrado.' });
  }
});

// 0. Eliminar un personaje de la base de datos
app.post('/api/player/delete', async (req, res) => {
  const { characterName } = req.body;
  if (!characterName) {
    return res.status(400).json({ success: false, message: 'Nombre de personaje requerido para eliminar.' });
  }

  const cleanName = characterName.trim();
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Buscar coincidencia insensible a mayúsculas y tildes (Ej: HéroeAtNight vs HeroeAtNight)
  const targetNorm = normalizeStr(cleanName);
  const matchingKeys = Object.keys(localPlayersDb).filter(k => normalizeStr(k) === targetNorm);

  matchingKeys.forEach(k => {
    delete localPlayersDb[k];
  });

  if (matchingKeys.length > 0) {
    saveLocalDb();
    console.log(`🗑️ Personaje(s) "${matchingKeys.join(', ')}" eliminado(s) exitosamente de la base de datos local.`);
  }

  if (isMongoConnected) {
    try {
      await MongoPlayer.deleteMany({ characterName: new RegExp(`^${cleanName.replace(/e/gi, '[eé]')}$`, 'i') });
    } catch (err) {
      console.error('Error eliminando personaje en Mongo:', err);
    }
  }

  return res.json({ success: true, message: `El personaje "${cleanName}" fue eliminado exitosamente.` });
});

// 0. Vaciar completamente la base de datos de personajes
app.post('/api/player/wipe-all', async (req, res) => {
  localPlayersDb = {};
  saveLocalDb();
  console.log('🗑️ Todos los personajes eliminados de la memoria y players.json.');

  if (isMongoConnected) {
    try {
      await MongoPlayer.deleteMany({});
      console.log('🗑️ Todos los personajes eliminados de MongoDB.');
    } catch (err) {
      console.error('Error vaciando Mongo:', err);
    }
  }

  return res.json({ success: true, message: 'Todos los personajes han sido eliminados por completo.' });
});

// 0. Crear un nuevo personaje personalizado
app.post('/api/player/create', async (req, res) => {
  const { characterName, ownerEmail, characterClass, gender, skinColor, hairColor, outfitColor } = req.body;

  if (!characterName || !ownerEmail || !characterClass || !gender || !skinColor || !hairColor || !outfitColor) {
    return res.status(400).json({ success: false, message: 'Todos los campos de personalización son obligatorios.' });
  }

  const cleanName = characterName.trim();
  const cleanEmail = ownerEmail.trim().toLowerCase();

  // Validar si el nombre de personaje ya existe (Insensible a tildes/mayúsculas)
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const targetNorm = normalizeStr(cleanName);
  const exists = Object.keys(localPlayersDb).some(k => normalizeStr(k) === targetNorm);

  if (exists) {
    return res.status(400).json({ success: false, message: `El nombre "${cleanName}" ya existe. Por favor escoge un nombre diferente.` });
  }

  const newPlayer: PlayerRecord = {
    characterName: cleanName,
    ownerEmail: cleanEmail,
    characterClass,
    gender,
    skinColor,
    hairColor,
    outfitColor,
    level: 1,
    xp: 0,
    availablePoints: 0,
    elements: {
      vitalidad: { equip: 0, base: 0 },
      sabiduria: { equip: 0, base: 0 },
      aire: { equip: 0, base: 0 },
      tierra: { equip: 0, base: 0 },
      fuego: { equip: 0, base: 0 },
      agua: { equip: 0, base: 0 }
    },
    specials: {
      tasaMana: 0,
      manaTotal: 0,
      velocidad: 0,
      defensa: 0,
      ataque: 0
    },
    hp: 100,
    maxHp: 100,
    mana: 10,
    maxMana: 10,
    inventory: [],
    lastPosition: { x: 0, y: 0 },
    updatedAt: new Date().toISOString()
  };

  localPlayersDb[cleanName] = newPlayer;
  saveLocalDb();

  return res.json({
    success: true,
    message: `¡Personaje "${cleanName}" creado exitosamente!`,
    player: newPlayer
  });
});

// 1. Health Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    game: 'AtNight Action RPG',
    databaseMode: isMongoConnected ? 'MongoDB Cloud/Cluster' : 'Archivos Locales JSON (Development)',
    storedCharacters: Object.keys(localPlayersDb).length,
    activePlayers: connectedPlayers.size,
    timestamp: new Date()
  });
});

// 2. Cargar personaje por nombre
app.get('/api/player/:characterName', async (req, res) => {
  loadLocalDb();
  const name = req.params.characterName;
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const targetNorm = normalizeStr(name);

  if (isMongoConnected) {
    try {
      const doc = await MongoPlayer.findOne({ characterName: new RegExp(`^${name.replace(/e/gi, '[eé]')}$`, 'i') });
      if (doc) return res.json({ success: true, player: doc });
    } catch (err) {
      console.error('Error buscando personaje en MongoDB:', err);
    }
  }

  // Buscar en la base de datos local JSON sin re-crear personajes fantasma
  const foundKey = Object.keys(localPlayersDb).find(k => normalizeStr(k) === targetNorm);
  if (foundKey && localPlayersDb[foundKey]) {
    return res.json({ success: true, player: localPlayersDb[foundKey] });
  }

  return res.status(404).json({ success: false, message: 'Personaje no encontrado' });
});

// 3. Guardar estado del personaje manteniendo clase, sexo, colores y progresos intactos
app.post('/api/player/save', async (req, res) => {
  const playerData: Partial<PlayerRecord> = req.body;

  if (!playerData || !playerData.characterName) {
    return res.status(400).json({ success: false, message: 'Datos de personaje inválidos' });
  }

  const name = playerData.characterName;
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const foundKey = Object.keys(localPlayersDb).find(k => normalizeStr(k) === normalizeStr(name)) || name;

  const existing = localPlayersDb[foundKey] || {};
  const mergedPlayer: PlayerRecord = {
    ...existing,
    ...playerData,
    characterName: existing.characterName || name,
    characterClass: playerData.characterClass || existing.characterClass || 'espadachin',
    gender: playerData.gender || existing.gender || 'masculino',
    skinColor: playerData.skinColor || existing.skinColor || '#f5c6a5',
    hairColor: playerData.hairColor || existing.hairColor || '#451a03',
    outfitColor: playerData.outfitColor || existing.outfitColor || '#1d4ed8',
    ownerEmail: playerData.ownerEmail || existing.ownerEmail || '',
    updatedAt: new Date().toISOString()
  } as PlayerRecord;

  localPlayersDb[foundKey] = mergedPlayer;
  saveLocalDb();

  if (isMongoConnected) {
    try {
      await MongoPlayer.findOneAndUpdate(
        { characterName: foundKey },
        mergedPlayer,
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Error sincronizando con MongoDB:', err);
    }
  }

  return res.json({ success: true, message: 'Progreso y personalización guardados correctamente', timestamp: mergedPlayer.updatedAt });
});

// ----------------------------------------------------
// SOCKET.IO MULTIPLAYER REAL-TIME SYNC
// ----------------------------------------------------
interface ConnectedPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  level: number;
  hp: number;
  maxHp: number;
}

const connectedPlayers = new Map<string, ConnectedPlayer>();

io.on('connection', (socket: Socket) => {
  console.log(`🎮 Jugador conectado a AtNight: ${socket.id}`);

  socket.on('joinGame', (data: { characterName: string; x?: number; y?: number; level?: number }) => {
    const player: ConnectedPlayer = {
      id: socket.id,
      name: data.characterName || `Héroe_${socket.id.substring(0, 4)}`,
      x: data.x || 0,
      y: data.y || 0,
      level: data.level || 1,
      hp: 100,
      maxHp: 100
    };

    connectedPlayers.set(socket.id, player);
    socket.emit('currentPlayers', Array.from(connectedPlayers.values()));
    socket.broadcast.emit('playerJoined', player);
  });

  socket.on('playerMove', (data: { x: number; y: number }) => {
    const player = connectedPlayers.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  socket.on('playerAttack', (data: { x: number; y: number; damage: number }) => {
    socket.broadcast.emit('playerAttacked', { id: socket.id, x: data.x, y: data.y, damage: data.damage });
  });

  socket.on('disconnect', () => {
    console.log(`🚪 Jugador desconectado: ${socket.id}`);
    connectedPlayers.delete(socket.id);
    io.emit('playerLeft', socket.id);
  });
});

// ----------------------------------------------------
// SERVIDOR HTTP LISTEN
// ----------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌌 Servidor de Juego AtNight activo en puerto ${PORT}`);
  console.log(`📁 Modo Local: Almacenamiento JSON listo en server/data/players.json`);
  console.log(`=======================================================`);

  // Intentar conectar con MongoDB local/remoto (si existe)
  mongoose.connect(MONGODB_URI)
    .then(() => {
      isMongoConnected = true;
      console.log('🍃 Conectado exitosamente a MongoDB (Base de datos AtNight)');
    })
    .catch(() => {
      isMongoConnected = false;
      console.log('ℹ️ Operando en MODO DESARROLLO LOCAL con archivos JSON (MongoDB no activo).');
    });
});

