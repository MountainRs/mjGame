const { tileKey, isLaizi } = require('./tiles');

function canHu(tiles, meldCount) {
  meldCount = meldCount || 0;
  const counts = {};
  let laizi = 0;

  for (const t of tiles) {
    if (isLaizi(t)) {
      laizi++;
    } else {
      const k = tileKey(t);
      counts[k] = (counts[k] || 0) + 1;
    }
  }

  const needMelds = 4 - meldCount;
  const needTiles = needMelds * 3 + 2;
  if (tiles.length !== needTiles) return false;

  return _tryPair(counts, laizi, needMelds);
}

function _tryPair(counts, laizi, needMelds) {
  if (laizi >= 2) {
    const c = _clone(counts);
    if (_tryMelds(c, laizi - 2, needMelds)) return true;
  }

  if (laizi >= 1) {
    for (const k of Object.keys(counts)) {
      if (counts[k] >= 1) {
        const c = _clone(counts);
        c[k] -= 1;
        if (c[k] === 0) delete c[k];
        if (_tryMelds(c, laizi - 1, needMelds)) return true;
      }
    }
  }

  for (const k of Object.keys(counts)) {
    if (counts[k] >= 2) {
      const c = _clone(counts);
      c[k] -= 2;
      if (c[k] === 0) delete c[k];
      if (_tryMelds(c, laizi, needMelds)) return true;
    }
  }

  return false;
}

function _tryMelds(counts, laizi, remaining) {
  if (remaining === 0) {
    return Object.keys(counts).every(k => counts[k] === 0);
  }

  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  if (keys.length === 0) {
    return laizi >= remaining * 3;
  }

  const k = keys[0];
  const type = k[0];
  const val = parseInt(k.substring(1));

  if (counts[k] >= 3) {
    const c = _clone(counts);
    c[k] -= 3;
    if (c[k] === 0) delete c[k];
    if (_tryMelds(c, laizi, remaining - 1)) return true;
  }

  if (counts[k] >= 2 && laizi >= 1) {
    const c = _clone(counts);
    c[k] -= 2;
    if (c[k] === 0) delete c[k];
    if (_tryMelds(c, laizi - 1, remaining - 1)) return true;
  }

  if (counts[k] >= 1 && laizi >= 2) {
    const c = _clone(counts);
    c[k] -= 1;
    if (c[k] === 0) delete c[k];
    if (_tryMelds(c, laizi - 2, remaining - 1)) return true;
  }

  if ('wtb'.includes(type)) {
    for (let pos = 0; pos < 3; pos++) {
      const startVal = val - pos;
      if (startVal < 1 || startVal + 2 > 9) continue;
      const seq = [type + startVal, type + (startVal + 1), type + (startVal + 2)];
      let need = 0;
      for (const s of seq) {
        if (!counts[s] || counts[s] <= 0) need++;
      }
      if (need <= laizi) {
        const c = _clone(counts);
        for (const s of seq) {
          if (c[s] && c[s] > 0) c[s]--;
        }
        for (const s of seq) {
          if (c[s] === 0) delete c[s];
        }
        if (_tryMelds(c, laizi - need, remaining - 1)) return true;
      }
    }
  }

  if (laizi >= 3) {
    const c = _clone(counts);
    if (_tryMelds(c, laizi - 3, remaining - 1)) return true;
  }

  return false;
}

function canHuWithTile(hand, tile, meldCount) {
  return canHu([...hand, tile], meldCount);
}

function _clone(obj) {
  const c = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] > 0) c[k] = obj[k];
  }
  return c;
}

module.exports = { canHu, canHuWithTile };
