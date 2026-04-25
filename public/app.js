let ws = null;
let playerId = null;
let roomId = null;
let myIndex = -1;
let players = [];
let myHand = [];
let currentActions = [];
let currentActionTile = null;
let currentPhase = '';
let currentPlayerIdx = -1;
let isMyTurn = false;
let ownTurnActions = false;

function tileImgUrl(t) { return `tiles/${t.type}${t.value}.svg`; }
function tileKeyStr(t) { return t.type + t.value; }

function showView(id) { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch(err) {} };
  ws.onclose = () => { setTimeout(() => { if (!ws || ws.readyState === WebSocket.CLOSED) connect(); }, 2000); };
  ws.onerror = () => {};
}
function send(msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }

function handleMessage(msg) {
  switch (msg.type) {
    case 'connected': playerId = msg.playerId; break;
    case 'roomJoined': roomId = msg.roomId; myIndex = msg.playerIndex; players = msg.players; showView('roomView'); updateRoomUI(); break;
    case 'playerJoined': players = msg.players; updateRoomUI(); break;
    case 'playerLeft': players = msg.players; updateRoomUI(); break;
    case 'gameStart': myHand = msg.hand; myIndex = msg.playerIndex; players = msg.players; showView('gameView'); renderGameStart(msg); break;
    case 'handUpdate': myHand = msg.hand; renderMyHand(); break;
    case 'drawTile': myHand.push(msg.tile); sortHand(); renderMyHand(); updateWallCount(msg.wallCount); break;
    case 'listeningHint': showListeningHint(msg.tiles); break;
    case 'playerDraw': updatePlayerTileCount(msg.playerIndex, msg.handCount); updateWallCount(msg.wallCount); break;
    case 'playerDiscard':
      addDiscardTile(msg.playerIndex, msg.tile);
      if (msg.playerIndex === myIndex) { myHand = myHand.filter(t => t.id !== msg.tile.id); renderMyHand(); }
      hideListeningHint(); break;
    case 'turnInfo': currentPlayerIdx = msg.currentPlayer; currentPhase = msg.phase; isMyTurn = msg.currentPlayer === myIndex; updateTurnDisplay(); break;
    case 'actionRequest': currentActions = msg.actions; currentActionTile = msg.tile; showActions(msg.actions); break;
    case 'peng':
      hideActions();
      if (msg.playerIndex === myIndex) { for (const t of msg.meld) myHand = myHand.filter(h => h.id !== t.id); }
      updateMelds(msg.playerIndex, msg.meld); showStatusMsg(`${getPlayerName(msg.playerIndex)} 碰！`); setTimeout(hideStatusMsg, 1500); break;
    case 'gang':
      hideActions();
      if (msg.playerIndex === myIndex) { for (const t of msg.meld) myHand = myHand.filter(h => h.id !== t.id); renderMyHand(); }
      updateMelds(msg.playerIndex, msg.meld); showStatusMsg(`${getPlayerName(msg.playerIndex)} 杠！`); setTimeout(hideStatusMsg, 1500); break;
    case 'gameOver': hideActions(); hideListeningHint(); showGameOver(msg); break;
    case 'gameReset':
      hideActions(); hideStatusMsg(); hideGameOver(); hideListeningHint();
      players = msg.players; myHand = []; showView('roomView'); updateRoomUI(); break;
    case 'error': alert(msg.message); break;
    case 'playerDisconnected': showStatusMsg(`${msg.playerName} 断线了`); break;
  }
}

function getPlayerName(idx) { if (!players[idx]) return '?'; return idx === myIndex ? '你' : players[idx].name; }

function updateRoomUI() {
  document.getElementById('roomCode').textContent = roomId;
  const list = document.getElementById('playerList'); list.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const p = players[i];
    const card = document.createElement('div'); card.className = 'player-card' + (p ? ' ready' : '');
    card.innerHTML = `<div class="p-name">${p ? p.name : '等待加入...'}</div><div class="p-status">${p ? (p.isBot ? '🤖 机器人' : '👤 玩家') : '---'}</div>`;
    list.appendChild(card);
  }
  const btnStart = document.getElementById('btnStart'), btnAddBot = document.getElementById('btnAddBot');
  btnStart.disabled = players.length < 4; btnAddBot.disabled = players.length >= 4;
  btnStart.style.opacity = players.length < 4 ? '0.5' : '1'; btnAddBot.style.opacity = players.length >= 4 ? '0.5' : '1';
  document.getElementById('roomStatus').textContent = players.length < 4 ? `还需要 ${4 - players.length} 名玩家` : '人已齐，可以开始！';
}

function createRoom() { send({ type: 'createRoom', name: document.getElementById('playerName').value.trim() || '玩家' }); }
function joinRoom() { const rid = document.getElementById('roomId').value.trim().toUpperCase(); if (!rid) { alert('请输入房间号'); return; } send({ type: 'joinRoom', roomId: rid, name: document.getElementById('playerName').value.trim() || '玩家' }); }
function addBot() { send({ type: 'addBot' }); }
function startGame() { send({ type: 'startGame' }); }
function copyRoomLink() { const url = `${location.protocol}//${location.host}?room=${roomId}`; navigator.clipboard.writeText(url).catch(() => prompt('复制:', url)); }

function sortHand() {
  const o = { w: 0, t: 1, b: 2, f: 3, d: 4 };
  myHand.sort((a, b) => a.type !== b.type ? o[a.type] - o[b.type] : a.value - b.value);
}

function renderGameStart(msg) {
  sortHand(); renderMyHand(); updateWallCount(msg.wallCount);
  currentPlayerIdx = msg.dealer; updateTurnDisplay();
  const positions = getPlayerPositions();
  for (let i = 0; i < 4; i++) { if (i === myIndex) continue; const el = positions[i]; if (el) el.querySelector('.player-name').textContent = players[i].name; }
  document.getElementById('roomInfo').textContent = `房间: ${roomId}`;
  document.querySelector('#discardArea .discard-inner').innerHTML = '';
  for (const pos of Object.values(positions)) { const m = pos?.querySelector('.player-melds'); if (m) m.innerHTML = ''; }
}

function getPlayerPositions() {
  const r = {}; const elIds = ['playerBottom', 'playerRight', 'playerTop', 'playerLeft'];
  for (let i = 0; i < 4; i++) r[i] = document.getElementById(elIds[(i - myIndex + 4) % 4]);
  return r;
}

function renderMyHand() {
  const c = document.getElementById('myHand'); c.innerHTML = '';
  for (const tile of myHand) {
    const el = makeTileEl(tile, 'tile-hand');
    el.addEventListener('click', () => { if (!isMyTurn) return; send({ type: 'discard', tileId: tile.id }); isMyTurn = false; });
    c.appendChild(el);
  }
}

function makeTileEl(tile, cls) {
  const d = document.createElement('div');
  d.className = 'tile ' + (cls || '');
  if (tile.isLaizi) d.classList.add('laizi');
  d.dataset.id = tile.id;
  if (tile.isLaizi) d.innerHTML = '<span class="tile-badge">赖</span>';
  const img = document.createElement('img');
  img.src = tileImgUrl(tile); img.draggable = false;
  d.appendChild(img);
  return d;
}

function makeSmallTileEl(tile) { return makeTileEl(tile, 'tile-small'); }
function makeDiscardTileEl(tile) { return makeTileEl(tile, 'tile-discard'); }

function showActions(actions) {
  const bar = document.getElementById('actionBar'); bar.classList.remove('hidden');
  ownTurnActions = actions.includes('discard');
  document.getElementById('btnHu').style.display = actions.includes('hu') ? '' : 'none';
  document.getElementById('btnGang').style.display = actions.includes('gang') ? '' : 'none';
  document.getElementById('btnPeng').style.display = actions.includes('peng') ? '' : 'none';
  document.getElementById('btnPass').style.display = (actions.length > 1) ? '' : 'none';
  document.getElementById('btnPass').textContent = ownTurnActions ? '跳过' : '过';
  if (actions.length === 1 && actions[0] === 'discard') { bar.classList.add('hidden'); isMyTurn = true; }
}

function hideActions() { document.getElementById('actionBar').classList.add('hidden'); currentActions = []; }

function doAction(action) {
  if (action === 'pass') { hideActions(); if (ownTurnActions) { isMyTurn = true; } else { send({ type: 'action', action: 'pass' }); isMyTurn = false; } return; }
  send({ type: 'action', action }); hideActions();
}

function updateTurnDisplay() {
  const positions = getPlayerPositions();
  for (let i = 0; i < 4; i++) { const el = positions[i]; if (!el) continue; el.querySelector('.player-label')?.classList.toggle('active-player', i === currentPlayerIdx); }
  const ti = document.getElementById('turnInfo');
  if (currentPlayerIdx === myIndex) { ti.textContent = '轮到你出牌'; ti.style.color = '#2ecc71'; }
  else { ti.textContent = `${getPlayerName(currentPlayerIdx)} 的回合`; ti.style.color = '#fff'; }
}

function updateWallCount(c) { document.getElementById('wallCount').textContent = `余: ${c}`; }

function updatePlayerTileCount(pIdx, count) {
  const el = getPlayerPositions()[pIdx];
  if (!el || pIdx === myIndex) return;
  const t = el.querySelector('.player-tiles');
  if (t) { t.innerHTML = ''; for (let i = 0; i < count; i++) { const b = document.createElement('div'); b.className = 'tile-back'; t.appendChild(b); } }
}

function addDiscardTile(pIdx, tile) {
  const area = document.querySelector('#discardArea .discard-inner');
  area.querySelectorAll('.last-discard').forEach(t => t.classList.remove('last-discard'));
  const el = makeDiscardTileEl(tile); el.classList.add('last-discard');
  area.appendChild(el); area.scrollTop = area.scrollHeight;
}

function updateMelds(pIdx, meld) {
  const el = getPlayerPositions()[pIdx]; if (!el) return;
  const meldsEl = el.querySelector('.player-melds'); if (!meldsEl) return;
  const g = document.createElement('div'); g.className = 'meld-group';
  for (const t of meld) g.appendChild(makeSmallTileEl(t));
  meldsEl.appendChild(g);
  if (pIdx !== myIndex) {
    const t = el.querySelector('.player-tiles');
    if (t) { const backs = t.querySelectorAll('.tile-back'); for (let i = 0; i < meld.length - 1 && i < backs.length; i++) backs[i]?.remove(); }
  }
}

function showListeningHint(tiles) {
  const hint = document.getElementById('listeningHint');
  const c = document.getElementById('listeningTiles'); c.innerHTML = '';
  const suitNames = { w: '万', t: '筒', b: '条' };
  const numCN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const fNames = { f1: '东', f2: '南', f3: '西', f4: '北', d1: '中', d2: '發', d3: '白' };
  for (const t of tiles) {
    const s = document.createElement('span'); s.className = 'waiting-tile';
    if (fNames[t.key]) s.textContent = fNames[t.key];
    else s.textContent = numCN[t.value] + suitNames[t.type];
    c.appendChild(s);
  }
  hint.classList.remove('hidden');
}
function hideListeningHint() { document.getElementById('listeningHint').classList.add('hidden'); }

function showStatusMsg(m) { const e = document.getElementById('gameStatus'); e.textContent = m; e.classList.remove('hidden'); }
function hideStatusMsg() { document.getElementById('gameStatus').classList.add('hidden'); }

function showGameOver(msg) {
  const modal = document.getElementById('gameOverModal');
  const title = document.getElementById('gameOverTitle');
  if (msg.isDraw) { title.textContent = '流局'; title.style.color = '#f39c12'; }
  else { title.textContent = msg.isSelfDraw ? `${msg.winnerName} 自摸！` : `${msg.winnerName} 胡了！`; title.style.color = '#f1c40f'; }
  let html = '';
  for (const h of msg.hands) {
    html += `<div class="player-result ${h.isWinner ? 'winner' : ''}"><div class="result-name">${h.playerName}${h.isWinner ? ' 🏆' : ''}</div>`;
    html += '<div class="result-label">手牌</div><div class="hand-display">';
    for (const t of h.hand) html += tileResultHtml(t);
    html += '</div>';
    if (h.melds?.length > 0) {
      html += '<div class="result-label">副露</div><div class="meld-display">';
      for (const m of h.melds) { html += '<div class="meld-group">'; for (const t of m) html += tileResultHtml(t); html += '</div>'; }
      html += '</div>';
    }
    html += '</div>';
  }
  document.getElementById('gameOverInfo').innerHTML = html;
  modal.classList.remove('hidden');
}

function tileResultHtml(t) {
  const lc = t.isLaizi ? ' laizi' : '';
  const badge = t.isLaizi ? '<span class="tile-badge">赖</span>' : '';
  return `<div class="tile tile-result${lc}">${badge}<img src="${tileImgUrl(t)}" draggable="false"></div>`;
}

function hideGameOver() { document.getElementById('gameOverModal').classList.add('hidden'); }
function restartGame() { hideGameOver(); send({ type: 'restart' }); }

window.addEventListener('load', () => {
  connect();
  const room = new URLSearchParams(location.search).get('room');
  if (room) document.getElementById('roomId').value = room.toUpperCase();
});
