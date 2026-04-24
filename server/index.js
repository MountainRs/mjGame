const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const Game = require('./Game');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../public')));

const rooms = {};
const connections = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generatePlayerId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function sendToConnection(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on('connection', (ws) => {
  const playerId = generatePlayerId();
  connections.set(ws, { playerId, roomId: null, name: null });

  sendToConnection(ws, { type: 'connected', playerId });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }

    const conn = connections.get(ws);
    if (!conn) return;

    switch (msg.type) {
      case 'createRoom': {
        const roomId = generateRoomId();
        const game = new Game(roomId);
        const name = msg.name || '玩家';
        conn.roomId = roomId;
        conn.name = name;
        game.addPlayer(playerId, name, false);
        game.sendToPlayer = (pid, m) => {
          for (const [w, c] of connections) {
            if (c.playerId === pid) { sendToConnection(w, m); break; }
          }
        };
        game.broadcast = (m, excludePid) => {
          for (const [w, c] of connections) {
            if (c.roomId === roomId && c.playerId !== excludePid) {
              sendToConnection(w, m);
            }
          }
        };
        rooms[roomId] = game;
        sendToConnection(ws, { type: 'roomJoined', roomId, playerIndex: 0, players: game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })) });
        break;
      }

      case 'joinRoom': {
        const roomId = (msg.roomId || '').toUpperCase();
        const game = rooms[roomId];
        if (!game) {
          sendToConnection(ws, { type: 'error', message: '房间不存在' });
          return;
        }
        if (game.players.length >= 4) {
          sendToConnection(ws, { type: 'error', message: '房间已满' });
          return;
        }
        if (game.state !== 'idle') {
          sendToConnection(ws, { type: 'error', message: '游戏已开始' });
          return;
        }
        const name = msg.name || '玩家';
        conn.roomId = roomId;
        conn.name = name;
        game.addPlayer(playerId, name, false);
        const pIdx = game.players.length - 1;
        game.sendToPlayer = (pid, m) => {
          for (const [w, c] of connections) {
            if (c.playerId === pid) { sendToConnection(w, m); break; }
          }
        };
        sendToConnection(ws, { type: 'roomJoined', roomId, playerIndex: pIdx, players: game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })) });
        game.broadcast({ type: 'playerJoined', players: game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })) });
        break;
      }

      case 'addBot': {
        const roomId = conn.roomId;
        if (!roomId) return;
        const game = rooms[roomId];
        if (!game) return;
        if (game.players.length >= 4) {
          sendToConnection(ws, { type: 'error', message: '房间已满' });
          return;
        }
        const botId = 'bot_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 3);
        const botNames = ['机器人A', '机器人B', '机器人C', '机器人D'];
        const botName = botNames[game.players.filter(p => p.isBot).length] || '机器人';
        game.addPlayer(botId, botName, true);
        game.broadcast({ type: 'playerJoined', players: game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })) });
        break;
      }

      case 'startGame': {
        const roomId = conn.roomId;
        if (!roomId) return;
        const game = rooms[roomId];
        if (!game) return;
        if (game.players.length !== 4) {
          sendToConnection(ws, { type: 'error', message: '需要4名玩家' });
          return;
        }
        const ok = game.start();
        if (!ok) {
          sendToConnection(ws, { type: 'error', message: '无法开始游戏' });
        }
        break;
      }

      case 'discard': {
        const roomId = conn.roomId;
        if (!roomId) return;
        const game = rooms[roomId];
        if (!game) return;
        game.handleDiscard(playerId, msg.tileId);
        break;
      }

      case 'action': {
        const roomId = conn.roomId;
        if (!roomId) return;
        const game = rooms[roomId];
        if (!game) return;
        game.handleAction(playerId, msg.action, msg);
        break;
      }

      case 'gang': {
        const roomId = conn.roomId;
        if (!roomId) return;
        const game = rooms[roomId];
        if (!game) return;
        game.handleAction(playerId, 'gang', msg);
        break;
      }

      case 'restart': {
        const roomId = conn.roomId;
        if (!roomId) return;
        const game = rooms[roomId];
        if (!game) return;
        game.reset();
        game.broadcast({ type: 'gameReset', players: game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })) });
        break;
      }
    }
  });

  ws.on('close', () => {
    const conn = connections.get(ws);
    if (conn && conn.roomId) {
      const game = rooms[conn.roomId];
      if (game) {
        if (game.state === 'idle') {
          game.removePlayer(conn.playerId);
          if (game.players.length === 0) {
            delete rooms[conn.roomId];
          } else {
            game.broadcast({
              type: 'playerLeft',
              playerId: conn.playerId,
              players: game.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot }))
            });
          }
        } else {
          game.broadcast({
            type: 'playerDisconnected',
            playerId: conn.playerId,
            playerName: conn.name
          });
        }
      }
    }
    connections.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('========================================');
  console.log('  🀄 麻将游戏服务器已启动！');
  console.log(`  本机访问: http://localhost:${PORT}`);
  console.log(`  局域网访问: http://${ip}:${PORT}`);
  console.log('========================================');
});
