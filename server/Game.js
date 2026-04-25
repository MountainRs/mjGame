const { createDeck, shuffle, tileKey, tileName, isLaizi, tileSort } = require('./tiles');
const { canHu, canHuWithTile, getListeningTiles } = require('./huChecker');
const AIPlayer = require('./ai');

class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.wall = [];
    this.currentPlayer = -1;
    this.dealer = 0;
    this.state = 'idle';
    this.turnPhase = '';
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.pendingActions = {};
    this.respondedActions = {};
    this.actionTimer = null;
    this.sendToPlayer = null;
    this.broadcast = null;
    this.turnCount = 0;
  }

  _sendToPlayer(playerIdx, msg) {
    if (this.sendToPlayer) {
      const p = this.players[playerIdx];
      if (p && !p.isBot) {
        this.sendToPlayer(p.id, msg);
      }
    }
  }

  _broadcast(msg, excludeIdx) {
    if (this.broadcast) {
      this.broadcast(msg, excludeIdx !== undefined ? this.players[excludeIdx]?.id : null);
    }
  }

  addPlayer(id, name, isBot) {
    if (this.players.length >= 4) return false;
    if (this.state !== 'idle') return false;
    this.players.push({
      id, name, isBot: !!isBot,
      hand: [], melds: [], discards: []
    });
    return true;
  }

  removePlayer(id) {
    if (this.state !== 'idle') return false;
    const idx = this.players.findIndex(p => p.id === id);
    if (idx >= 0) { this.players.splice(idx, 1); return true; }
    return false;
  }

  getPlayerIndex(id) {
    return this.players.findIndex(p => p.id === id);
  }

  start() {
    if (this.players.length !== 4) return false;
    if (this.state !== 'idle') return false;

    this.state = 'playing';
    this.wall = shuffle(createDeck());
    this.dealer = Math.floor(Math.random() * 4);
    this.turnCount = 0;

    for (const p of this.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
    }

    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 4; i++) {
        const pIdx = (this.dealer + i) % 4;
        for (let j = 0; j < 4; j++) {
          this.players[pIdx].hand.push(this.wall.pop());
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const pIdx = (this.dealer + i) % 4;
      this.players[pIdx].hand.push(this.wall.pop());
    }

    for (const p of this.players) p.hand.sort(tileSort);

    const dealerTile = this.wall.pop();
    this.players[this.dealer].hand.push(dealerTile);
    this.players[this.dealer].hand.sort(tileSort);

    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      this._sendToPlayer(i, {
        type: 'gameStart',
        hand: p.hand.map(t => this._tileInfo(t)),
        playerIndex: i,
        dealer: this.dealer,
        players: this.players.map((pp, idx) => ({
          id: pp.id, name: pp.name, isBot: pp.isBot, index: idx
        })),
        wallCount: this.wall.length
      });
    }

    this._broadcast({
      type: 'turnInfo',
      currentPlayer: this.dealer,
      phase: 'discard',
      wallCount: this.wall.length
    });

    this.currentPlayer = this.dealer;
    this.turnPhase = 'discard';
    this._processCurrentTurn();
    return true;
  }

  _tileInfo(tile) {
    return {
      id: tile.id, type: tile.type, value: tile.value,
      key: tileKey(tile), name: tileName(tile),
      isLaizi: isLaizi(tile)
    };
  }

  _processCurrentTurn() {
    const pIdx = this.currentPlayer;
    const player = this.players[pIdx];
    const hand = player.hand;
    const meldCount = player.melds.length;

    if (canHu(hand, meldCount)) {
      if (player.isBot) {
        setTimeout(() => this._doHu(pIdx, null), 600);
      } else {
        this._sendToPlayer(pIdx, {
          type: 'actionRequest',
          actions: ['hu', 'discard'],
          tile: null,
          fromPlayer: -1,
          message: '你可以自摸胡牌！'
        });
      }
      return;
    }

    const gangTiles = this._findAnGang(hand);
    if (gangTiles.length > 0) {
      if (player.isBot) {
        const ai = new AIPlayer(player, this);
        const g = ai.shouldGang(gangTiles);
        if (g) {
          setTimeout(() => this._doAnGang(pIdx, g.key), 800);
          return;
        }
      } else {
        this._sendToPlayer(pIdx, {
          type: 'actionRequest',
          actions: ['gang', 'discard'],
          gangTiles: gangTiles,
          tile: null,
          fromPlayer: -1,
          message: '你可以暗杠！'
        });
        return;
      }
    }

    const jiaGang = this._findJiaGang(hand, player.melds);
    if (jiaGang.length > 0) {
      if (player.isBot) {
        setTimeout(() => this._doJiaGang(pIdx, jiaGang[0].key), 800);
        return;
      } else {
        this._sendToPlayer(pIdx, {
          type: 'actionRequest',
          actions: ['gang', 'discard'],
          gangTiles: jiaGang,
          tile: null,
          fromPlayer: -1,
          message: '你可以加杠！'
        });
        return;
      }
    }

    if (player.isBot) {
      const ai = new AIPlayer(player, this);
      const discardTile = ai.chooseDiscard();
      setTimeout(() => {
        this._doDiscard(pIdx, discardTile.id);
      }, 800 + Math.random() * 700);
    } else {
      this._sendToPlayer(pIdx, {
        type: 'actionRequest',
        actions: ['discard'],
        tile: null,
        fromPlayer: -1,
        message: '请出牌'
      });
    }
  }

  _findAnGang(hand) {
    const counts = {};
    for (const t of hand) {
      const k = tileKey(t);
      if (!counts[k]) counts[k] = { count: 0, tile: t };
      counts[k].count++;
    }
    return Object.values(counts)
      .filter(c => c.count === 4)
      .map(c => ({ key: tileKey(c.tile), tile: this._tileInfo(c.tile) }));
  }

  _findJiaGang(hand, melds) {
    const results = [];
    for (const meld of melds) {
      if (meld.length !== 3) continue;
      const k = tileKey(meld[0]);
      if (hand.some(t => tileKey(t) === k)) {
        const tileInHand = hand.find(t => tileKey(t) === k);
        results.push({ key: k, tile: this._tileInfo(tileInHand) });
      }
    }
    return results;
  }

  _doDiscard(playerIdx, tileId) {
    if (this.state !== 'playing') return;
    if (this.currentPlayer !== playerIdx) return;
    if (this.turnPhase !== 'discard') return;

    const player = this.players[playerIdx];
    const tileIdx = player.hand.findIndex(t => t.id === tileId);
    if (tileIdx < 0) return;

    const tile = player.hand.splice(tileIdx, 1)[0];
    player.discards.push(tile);
    this.lastDiscard = tile;
    this.lastDiscardPlayer = playerIdx;
    this.turnCount++;

    this._broadcast({
      type: 'playerDiscard',
      playerIndex: playerIdx,
      tile: this._tileInfo(tile),
      wallCount: this.wall.length
    });

    this._sendToPlayer(playerIdx, {
      type: 'handUpdate',
      hand: player.hand.map(t => this._tileInfo(t))
    });

    this.turnPhase = 'action';
    this._checkDiscardActions(tile, playerIdx);
  }

  _checkDiscardActions(tile, fromPlayerIdx) {
    this.pendingActions = {};
    this.respondedActions = {};
    let hasAction = false;

    for (let i = 1; i <= 3; i++) {
      const pIdx = (fromPlayerIdx + i) % 4;
      const player = this.players[pIdx];
      const actions = [];

      if (canHuWithTile(player.hand, tile, player.melds.length)) {
        actions.push('hu');
      }

      const sameCount = player.hand.filter(t => tileKey(t) === tileKey(tile)).length;
      if (sameCount >= 3) actions.push('gang');
      if (sameCount >= 2) actions.push('peng');

      if (actions.length > 0) {
        this.pendingActions[pIdx] = actions;
        hasAction = true;

        if (player.isBot) {
          const ai = new AIPlayer(player, this);
          const action = ai.respondToDiscard(tile, actions);
          this.respondedActions[pIdx] = action;
        } else {
          this._sendToPlayer(pIdx, {
            type: 'actionRequest',
            actions,
            tile: this._tileInfo(tile),
            fromPlayer: fromPlayerIdx,
            message: this._actionMsg(actions, tile)
          });
        }
      }
    }

    if (!hasAction) {
      this._nextTurn();
      return;
    }

    const hasPendingHuman = Object.keys(this.pendingActions).some(
      pIdx => !this.players[pIdx].isBot && !this.respondedActions[pIdx]
    );

    if (!hasPendingHuman) {
      setTimeout(() => this._resolveActions(), 300);
    } else {
      this.actionTimer = setTimeout(() => {
        for (const pIdx of Object.keys(this.pendingActions)) {
          if (!this.respondedActions[pIdx]) {
            this.respondedActions[pIdx] = 'pass';
          }
        }
        this._resolveActions();
      }, 12000);
    }
  }

  _actionMsg(actions, tile) {
    const n = tileName(tile);
    if (actions.includes('hu')) return `可以胡 ${n}！`;
    if (actions.includes('gang')) return `可以杠 ${n}！`;
    if (actions.includes('peng')) return `可以碰 ${n}！`;
    return '';
  }

  playerAction(playerId, action, tileId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx < 0) return;
    if (this.turnPhase !== 'action') return;
    if (!this.pendingActions[pIdx]) return;
    if (!this.pendingActions[pIdx].includes(action)) return;

    this.respondedActions[pIdx] = action;

    if (action === 'hu') {
      if (this.actionTimer) { clearTimeout(this.actionTimer); this.actionTimer = null; }
      this._doHu(pIdx, this.lastDiscard);
      return;
    }

    const hasPendingHuman = Object.keys(this.pendingActions).some(
      idx => !this.players[idx].isBot && !this.respondedActions[idx]
    );
    if (!hasPendingHuman) {
      if (this.actionTimer) { clearTimeout(this.actionTimer); this.actionTimer = null; }
      setTimeout(() => this._resolveActions(), 100);
    }
  }

  _resolveActions() {
    const priority = ['hu', 'gang', 'peng'];
    for (const act of priority) {
      for (let i = 1; i <= 3; i++) {
        const pIdx = (this.lastDiscardPlayer + i) % 4;
        if (this.respondedActions[pIdx] === act) {
          switch (act) {
            case 'hu': this._doHu(pIdx, this.lastDiscard); return;
            case 'gang': this._doMingGang(pIdx); return;
            case 'peng': this._doPeng(pIdx); return;
          }
        }
      }
    }
    this._nextTurn();
  }

  _doHu(playerIdx, discardTile) {
    const player = this.players[playerIdx];
    if (discardTile) {
      const fromPlayer = this.players[this.lastDiscardPlayer];
      fromPlayer.discards.pop();
      player.hand.push(discardTile);
    }

    this.state = 'finished';
    if (this.actionTimer) { clearTimeout(this.actionTimer); this.actionTimer = null; }

    this._broadcast({
      type: 'gameOver',
      winner: playerIdx,
      winnerId: player.id,
      winnerName: player.name,
      isSelfDraw: !discardTile,
      hands: this.players.map((p, idx) => ({
        playerId: p.id, playerName: p.name,
        hand: p.hand.map(t => this._tileInfo(t)),
        melds: p.melds.map(meld => meld.map(t => this._tileInfo(t))),
        discards: p.discards.map(t => this._tileInfo(t)),
        isWinner: idx === playerIdx
      }))
    });
  }

  _doPeng(playerIdx) {
    const player = this.players[playerIdx];
    const tile = this.lastDiscard;
    const key = tileKey(tile);

    const toRemove = [];
    for (let i = player.hand.length - 1; i >= 0; i--) {
      if (tileKey(player.hand[i]) === key && toRemove.length < 2) {
        toRemove.push(i);
      }
    }

    const meld = [tile];
    for (const idx of toRemove) {
      meld.push(player.hand.splice(idx, 1)[0]);
    }
    player.melds.push(meld);

    const fromPlayer = this.players[this.lastDiscardPlayer];
    fromPlayer.discards.pop();

    this._broadcast({
      type: 'peng',
      playerIndex: playerIdx,
      meld: meld.map(t => this._tileInfo(t)),
      fromPlayer: this.lastDiscardPlayer
    });

    this._sendToPlayer(playerIdx, {
      type: 'handUpdate',
      hand: player.hand.map(t => this._tileInfo(t))
    });

    this.currentPlayer = playerIdx;
    this.turnPhase = 'discard';
    this._broadcast({
      type: 'turnInfo', currentPlayer: playerIdx, phase: 'discard',
      wallCount: this.wall.length
    });

    if (player.isBot) {
      const ai = new AIPlayer(player, this);
      const discardTile = ai.chooseDiscard();
      setTimeout(() => this._doDiscard(playerIdx, discardTile.id), 800);
    } else {
      this._sendToPlayer(playerIdx, {
        type: 'actionRequest', actions: ['discard'], tile: null,
        fromPlayer: -1, message: '你碰了，请出牌'
      });
    }
  }

  _doMingGang(playerIdx) {
    const player = this.players[playerIdx];
    const tile = this.lastDiscard;
    const key = tileKey(tile);

    const toRemove = [];
    for (let i = player.hand.length - 1; i >= 0; i--) {
      if (tileKey(player.hand[i]) === key && toRemove.length < 3) {
        toRemove.push(i);
      }
    }

    const meld = [tile];
    for (const idx of toRemove) {
      meld.push(player.hand.splice(idx, 1)[0]);
    }
    player.melds.push(meld);

    const fromPlayer = this.players[this.lastDiscardPlayer];
    fromPlayer.discards.pop();

    this._broadcast({
      type: 'gang',
      playerIndex: playerIdx,
      meld: meld.map(t => this._tileInfo(t)),
      isMingGang: true,
      fromPlayer: this.lastDiscardPlayer
    });

    this._sendToPlayer(playerIdx, {
      type: 'handUpdate',
      hand: player.hand.map(t => this._tileInfo(t))
    });

    this.currentPlayer = playerIdx;
    this._drawForPlayer(playerIdx, true);
  }

  _doAnGang(playerIdx, tileKeyStr) {
    const player = this.players[playerIdx];
    const toRemove = [];
    for (let i = player.hand.length - 1; i >= 0; i--) {
      if (tileKey(player.hand[i]) === tileKeyStr && toRemove.length < 4) {
        toRemove.push(i);
      }
    }

    const meld = [];
    for (const idx of toRemove) {
      meld.push(player.hand.splice(idx, 1)[0]);
    }
    player.melds.push(meld);

    this._broadcast({
      type: 'gang',
      playerIndex: playerIdx,
      meld: meld.map(t => this._tileInfo(t)),
      isMingGang: false,
      fromPlayer: -1
    });

    this._sendToPlayer(playerIdx, {
      type: 'handUpdate',
      hand: player.hand.map(t => this._tileInfo(t))
    });

    this.currentPlayer = playerIdx;
    this._drawForPlayer(playerIdx, true);
  }

  _doJiaGang(playerIdx, tileKeyStr) {
    const player = this.players[playerIdx];
    const tileIdx = player.hand.findIndex(t => tileKey(t) === tileKeyStr);
    if (tileIdx < 0) return;

    const tile = player.hand.splice(tileIdx, 1)[0];
    const meld = player.melds.find(m => m.length === 3 && tileKey(m[0]) === tileKeyStr);
    if (meld) meld.push(tile);

    this._broadcast({
      type: 'gang',
      playerIndex: playerIdx,
      meld: meld ? meld.map(t => this._tileInfo(t)) : [],
      isMingGang: false,
      isJiaGang: true,
      fromPlayer: -1
    });

    this._sendToPlayer(playerIdx, {
      type: 'handUpdate',
      hand: player.hand.map(t => this._tileInfo(t))
    });

    this.currentPlayer = playerIdx;
    this._drawForPlayer(playerIdx, true);
  }

  _drawForPlayer(playerIdx, afterGang) {
    if (this.wall.length === 0) {
      this.state = 'finished';
      this._broadcast({
        type: 'gameOver',
        winner: -1,
        isDraw: true,
        hands: this.players.map(p => ({
          playerId: p.id, playerName: p.name,
          hand: p.hand.map(t => this._tileInfo(t)),
          melds: p.melds.map(meld => meld.map(t => this._tileInfo(t))),
          discards: p.discards.map(t => this._tileInfo(t)),
          isWinner: false
        }))
      });
      return;
    }

    const tile = this.wall.pop();
    this.players[playerIdx].hand.push(tile);
    this.players[playerIdx].hand.sort(tileSort);

    this._sendToPlayer(playerIdx, {
      type: 'drawTile',
      tile: this._tileInfo(tile),
      wallCount: this.wall.length
    });

    const listening = getListeningTiles(this.players[playerIdx].hand, this.players[playerIdx].melds.length);
    if (listening.length > 0 && listening.length <= 10) {
      this._sendToPlayer(playerIdx, {
        type: 'listeningHint',
        tiles: listening
      });
    }

    this._broadcast({
      type: 'playerDraw',
      playerIndex: playerIdx,
      handCount: this.players[playerIdx].hand.length,
      wallCount: this.wall.length
    }, playerIdx);

    this.currentPlayer = playerIdx;
    this.turnPhase = 'discard';

    this._broadcast({
      type: 'turnInfo', currentPlayer: playerIdx, phase: 'discard',
      wallCount: this.wall.length
    }, playerIdx);

    this._processCurrentTurn();
  }

  _nextTurn() {
    const nextPlayer = (this.currentPlayer + 1) % 4;
    this.currentPlayer = nextPlayer;
    this.turnPhase = 'draw';
    this._drawForPlayer(nextPlayer, false);
  }

  handleDiscard(playerId, tileId) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx < 0) return;
    if (this.currentPlayer !== pIdx) return;
    if (this.turnPhase !== 'discard') return;
    this._doDiscard(pIdx, tileId);
  }

  handleAction(playerId, action, data) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx < 0) return;

    if (this.currentPlayer === pIdx && this.turnPhase === 'discard') {
      if (action === 'hu') {
        this._doHu(pIdx, null);
        return;
      }
      if (action === 'gang' && data && data.tileKey) {
        const hand = this.players[pIdx].hand;
        const sameCount = hand.filter(t => tileKey(t) === data.tileKey).length;
        if (sameCount === 4) {
          this._doAnGang(pIdx, data.tileKey);
        } else {
          this._doJiaGang(pIdx, data.tileKey);
        }
        return;
      }
      if (action === 'pass') return;
    }

    if (this.turnPhase === 'action') {
      this.playerAction(playerId, action);
    }
  }

  handleGang(playerId, tileKeyStr) {
    const pIdx = this.getPlayerIndex(playerId);
    if (pIdx < 0) return;
    if (this.currentPlayer !== pIdx) return;
    if (this.turnPhase !== 'discard') return;

    const hand = this.players[pIdx].hand;
    const sameCount = hand.filter(t => tileKey(t) === tileKeyStr).length;
    if (sameCount === 4) {
      this._doAnGang(pIdx, tileKeyStr);
    } else {
      this._doJiaGang(pIdx, tileKeyStr);
    }
  }

  reset() {
    this.state = 'idle';
    this.wall = [];
    this.currentPlayer = -1;
    this.turnPhase = '';
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.pendingActions = {};
    this.respondedActions = {};
    this.turnCount = 0;
    if (this.actionTimer) { clearTimeout(this.actionTimer); this.actionTimer = null; }
    for (const p of this.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
    }
  }

  getState() {
    return {
      roomId: this.roomId,
      state: this.state,
      players: this.players.map(p => ({
        id: p.id, name: p.name, isBot: p.isBot,
        handCount: p.hand.length,
        meldCount: p.melds.length,
        discardCount: p.discards.length
      })),
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      wallCount: this.wall.length,
      turnCount: this.turnCount
    };
  }
}

module.exports = Game;
