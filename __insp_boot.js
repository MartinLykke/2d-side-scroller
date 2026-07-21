// ── DEV-ONLY inspection harness (served by the game server) ────────────────
// Re-imported after every reload with a cache-busting query so edits take hold:
//   import('/__insp_boot.js?t='+Date.now())
// Delete this file when the enemy-animation pass is finished.
async function setup() {
  document.getElementById('btn-start')?.click();
  const [m, sp, cv, R, dev] = await Promise.all([
    import('/src/core/state.js'),
    import('/src/systems/world/SpawnSystem.js?v=biomeactive1'),
    import('/src/core/canvas.js'),
    import('/src/rendering/Renderer.js?v=biomevisual1'),
    import('/src/systems/world/AssaultSystem.js?v=biomeactive1').catch(() => null),
  ]);
  window.__S = m;
  const { Game, state } = m;
  const c = document.querySelector('canvas');
  const CV = { get W() { return cv.W; }, get gy() { return cv.groundY; } };

  window.__cap = (sx, sy, sw, sh, zoom = 2) => {
    const o = document.createElement('canvas');
    o.width = sw * zoom; o.height = sh * zoom;
    const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(c, sx, sy, sw, sh, 0, 0, sw * zoom, sh * zoom);
    return o.toDataURL('image/png');
  };
  const post = (name, url) => {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 3000);
    return fetch('http://127.0.0.1:8790/save?name=' + encodeURIComponent(name), { method: 'POST', body: url, signal: ctrl.signal })
      .then(r => r.text()).catch(e => 'ERR ' + e).finally(() => clearTimeout(to));
  };
  const applyPose = (e, o = {}) => {
    if (o.anim != null) e.anim = o.anim;
    if (o.attackAnim != null) { e.attackAnim = o.attackAnim; e.attackDur = o.attackDur || 0.25; }
    if (o.attackImpact != null) e.attackImpact = o.attackImpact;
    if (o.attackKind != null) e.attackKind = o.attackKind;
    if (o.aiState != null) { e.aiState = o.aiState; e.stateTimer = o.stateTimer ?? 0.3; e.windupDur = o.windupDur ?? 0.5; }
    if (o.moving != null) { e.moving = o.moving; e.moveSpeed = o.moveSpeed ?? (o.moving ? 60 : 0); }
    if (o.shootCd != null) e.shootCd = o.shootCd;
    if (o.siegeShootCd != null) e.siegeShootCd = o.siegeShootCd;
    if (o.spawnCd != null) e.spawnCd = o.spawnCd;
    if (o.carry != null) e.carry = o.carry;
    if (o.fy != null) e.fy = o.fy;
    if (o.hp != null) { e.hp = o.hp; e.maxHp = Math.max(e.maxHp || 0, o.hp); }
    if (o.arrowArmor != null) e.arrowArmor = o.arrowArmor;
    e.dir = o.dir ?? -1;
  };
  window.__biome = (name) => { try { window.DEV.teleportBiome(name); } catch (e) {} };
  // Contact sheet: N posed clones of `type` rendered in one frame, cropped tight.
  window.__sheet = async (type, poses, opts = {}) => {
    if (opts.biome) window.__biome(opts.biome);
    const spacing = opts.spacing || 135, N = poses.length, cx = opts.atX ?? 2600;
    const savedPX = state.player.x; state.player.x = cx - 4000;
    state.enemies.length = 0;
    for (let i = 0; i < N; i++) sp.spawnEnemy(type, { x: cx + (i - (N - 1) / 2) * spacing });
    state.enemies.forEach((e, i) => applyPose(e, poses[i]));
    Game.cam = cx - CV.W / 2;
    R.render();
    const S = c.width / CV.W, zoom = Game.zoom;
    const halfSpan = ((N - 1) / 2) * spacing * zoom + (opts.margin || 95);
    const sx = Math.round((CV.W / 2 - halfSpan) * S), sw = Math.round(halfSpan * 2 * S);
    const top = opts.top ?? 70, bot = opts.bot ?? 14;
    const sy = Math.round((CV.gy - zoom * top) * S), sh = Math.round(zoom * (top + bot) * S);
    const url = window.__cap(sx, sy, sw, sh, opts.zoom || 2);
    state.player.x = savedPX;
    return post(opts.name || type, url);
  };
  return { playState: Game.state, W: CV.W, gy: CV.gy };
}
export default setup();
