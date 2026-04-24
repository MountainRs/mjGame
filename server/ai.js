const { tileKey, isLaizi, tileSort } = require('./tiles');
const { canHu, canHuWithTile } = require('./huChecker');

class AIPlayer {
  constructor(player, game) {
    this.player = player;
    this.game = game;
  }

  respondToDiscard(tile, actions) {
    if (actions.includes('hu')) return 'hu';
    if (actions.includes('gang')) return 'gang';
    if (actions.includes('peng')) {
      if (this._shouldPeng(tile)) return 'peng';
    }
    return 'pass';
  }

  _shouldPeng(tile) {
    const hand = this.player.hand;
    const key = tileKey(tile);
    const sameCount = hand.filter(t => tileKey(t) === key).length;
    if (sameCount >= 2) return true;
    return Math.random() > 0.3;
  }

  chooseDiscard() {
    const hand = this.player.hand;
    if (hand.length === 0) return null;

    let worstTile = hand[0];
    let worstScore = Infinity;

    for (const tile of hand) {
      const score = this._tileScore(tile, hand);
      if (score < worstScore) {
        worstScore = score;
        worstTile = tile;
      }
    }

    return worstTile;
  }

  _tileScore(tile, hand) {
    if (isLaizi(tile)) return 1000;

    let score = 0;
    const key = tileKey(tile);

    const sameCount = hand.filter(t => tileKey(t) === key).length;
    score += sameCount * 15;

    if ('wtb'.includes(tile.type)) {
      const v = tile.value;
      for (const t of hand) {
        if (t.type !== tile.type || tileKey(t) === key) continue;
        const diff = Math.abs(t.value - v);
        if (diff === 1) score += 10;
        else if (diff === 2) score += 4;
      }
    }

    if (tile.type === 'f' || (tile.type === 'd' && tile.value !== 1)) {
      if (sameCount < 2) score -= 5;
    }

    score += Math.random() * 3;

    return score;
  }

  shouldHu() {
    return true;
  }

  shouldGang(gangTiles) {
    return gangTiles.length > 0 ? gangTiles[0] : null;
  }
}

module.exports = AIPlayer;
