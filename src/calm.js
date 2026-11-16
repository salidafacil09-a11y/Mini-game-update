// Paradas jugables de Retorno (los descansos). Entre enfrentamiento y enfrentamiento, a veces el camino pasa por un
// sitio tranquilo: sin enemigos, con buena luz y algo que resolver sin prisa. Se llega desde el mapa del refugio («Ir
// a la parada») y se sale por donde se entró («Seguir el camino»): nada obliga a resolverlo todo. Dos sitios:
//  · La granja del manzano (calma_granja): la casa atrancada por dentro (hay que buscar la escalera de mano y entrar
//    por la ventana de arriba), la bodega con candado (la llave está en uno de cuatro escondites; una nota del abuelo
//    dice cuál) y un fardo colgado de un manzano (se baja de un disparo a la cuerda).
//  · La casa del pescador (calma_pescador): la cabaña cerrada con llave (se fuerza la cerradura con una horquilla),
//    el baúl con candado de combinación (las tres cifras están repartidas: la barca, el poste del muelle y una foto
//    de dentro de la cabaña) y la jaula hundida junto al muelle (gasolina para el generador y luego el cabrestante).
// En los dos, un fuego para descansar (cura una vez) y notas sueltas que se guardan en la mochila (pestaña Notas).
// Lo que se busca lleva el contorno amarillo cuando estás cerca (y, si hay que averiguarlo, cuando ya lo sabes).
(function (G) {
  'use strict';
  const U = G.Util, TAU = Math.PI * 2;
  const YEL = 0xf2c230;
  const el = (id) => document.getElementById(id);

  // ================= Notas sueltas (se guardan: la colección de la pestaña Notas) =================
  const NKEY = 'ceniza.notas';
  const LORE = {
    granja_1: { title: 'Diario de Ruth', where: 'La granja del manzano', text: '12 de abril.\nHan vuelto los del escorpión. Esta vez no han preguntado: se han llevado las dos cabras y la mitad de las conservas, y el más joven se ha reído cuando Luna se ha puesto a llorar.\nCelso dice que el año que viene plantamos el doble. Yo digo que el año que viene no estamos aquí.\nEl manzano ha florecido igual. A él le da lo mismo quién mande.' },
    granja_2: { title: 'Lista del abuelo Celso', where: 'La granja del manzano', text: 'Antes de irnos:\n— Engrasar la bomba del pozo.\n— Dejar la bodega cerrada (que no la encuentren).\n— Soltar a las gallinas. Que se apañen, como todos.\n— Decirle a Luna que el perro se queda a cuidar la casa. (Mentira. Ya se lo diré.)\n— Escalera: guardada. Nada de dejarla apoyada en la pared, que luego entra cualquiera.' },
    pesc_1: { title: 'Cuaderno de Anselmo', where: 'La casa del pescador', text: 'Día 340 (o por ahí).\nCorvinas pequeñas y una lubina que no me la creo ni yo. El mar está más limpio que nunca: es lo único bueno que ha traído el fin del mundo.\nDesde hace dos semanas el faro vuelve a encenderse de noche. Inés dice que son los del escorpión, que lo han tomado. Yo no lo he visto encendido en treinta años; ahora me da miedo mirarlo.' },
    pesc_2: { title: 'Una nota sin firma', where: 'La casa del pescador', text: 'Si lees esto: el agua del pozo de la cabaña es buena, hiérvela igual. Los del escorpión pasan los jueves por el camino de la costa.\nEn el puerto dicen que la Trece existe. Que una chica pelirroja con el brazo quemado limpió ella sola un campamento entero de Escorpiones, cerca de aquí.\nYo digo que la gente necesita cuentos. Pero, si existe, ojalá pase por aquí.' }
  };
  const Notes = {
    list() { try { const a = JSON.parse(localStorage.getItem(NKEY) || '[]'); return Array.isArray(a) ? a.filter((id) => LORE[id]) : []; } catch (e) { return []; } },
    add(id) {
      const a = this.list();
      if (!LORE[id] || a.indexOf(id) >= 0) return false;
      a.push(id);
      try { localStorage.setItem(NKEY, JSON.stringify(a)); } catch (e) { /* sin guardado */ }
      return true;
    },
    has(id) { return this.list().indexOf(id) >= 0; },
    LORE
  };

  // ================= Los sitios =================
  const SCENES = {
    granja: {
      map: 'calma_granja', name: 'La granja del manzano', tag: 'DESCANSO · NO HAY NADIE', face: Math.PI,
      teaser: 'Una granja al caer la tarde: la casa atrancada por dentro, el granero, la huerta y un manzanar. Quien vivía aquí se marchó con prisa y escondió lo que pudo.',
      build: () => buildGranja()
    },
    pescador: {
      map: 'calma_pescador', name: 'La casa del pescador', tag: 'DESCANSO · EL MAR EN CALMA', face: 0,
      teaser: 'Una cabaña de pescador en la costa de Oceanside, al amanecer, con la caseta de la barca y un muelle de tablas. El faro se ve al otro lado de la bahía.',
      build: () => buildPescador()
    }
  };

  let S = null;          // la parada en curso
  let scene = null;

  // ================= Utilidades =================
  const say = (t, k) => { if (S && S.msg) S.msg(t, k || ''); };
  const snd = (n, o) => { if (G.Audio) G.Audio.play(n, o || {}); };
  const dist = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
  const gy = (x, z, lv) => G.World.groundY(x, z, lv || 0);

  // ---------- mallas: el cuerpo (colores por vértice) y su contorno amarillo (la misma forma, algo más gorda) ----------
  let matBody = null, matHull = null, matGlow = null, matDark = null, matFlame = null;
  function mats() {
    if (matBody) return;
    matBody = new THREE.MeshLambertMaterial({ vertexColors: true });
    matHull = new THREE.MeshBasicMaterial({ color: YEL, side: THREE.BackSide, fog: false }); matHull.toneMapped = false;
    matGlow = new THREE.MeshBasicMaterial({ color: 0xffd890 }); matGlow.toneMapped = false;
    matDark = new THREE.MeshLambertMaterial({ color: 0x3a3632 });
    matFlame = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }); matFlame.toneMapped = false;
  }
  // draw(p): p.box(x, y, z, w, h, d, col, ry, rx, rz) · p.cyl(x, y, z, r0, r1, h, col, seg, rx, ry, rz) · p.sph(x, y, z, sx, sy, sz, col)
  function geo(draw, k) {
    const M = new G.Mesher();
    draw({
      box: (x, y, z, w, h, d, c, ry, rx, rz) => M.box(x, y, z, w + 2 * k, h + 2 * k, d + 2 * k, c, ry || 0, undefined, rx || 0, rz || 0),
      cyl: (x, y, z, r0, r1, h, c, seg, rx, ry, rz) => M.cyl(x, y, z, r0 + k, r1 + k, h + 2 * k, c, seg || 8, undefined, rx || 0, ry || 0, rz || 0),
      sph: (x, y, z, sx, sy, sz, c) => M.sphere(x, y, z, sx + k, sy + k, sz + k, c, 1)
    });
    return M.build();
  }
  // Un objeto: { g (grupo: posición y giro), body, hull (escondido) }. o: { k (grosor del contorno), noHull, hullOnly, lv }
  function thing(draw, x, y, z, ry, o) {
    mats(); o = o || {};
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry || 0;
    let body = null, hull = null;
    if (!o.hullOnly) { body = new THREE.Mesh(geo(draw, 0), matBody); body.castShadow = true; body.receiveShadow = true; g.add(body); }
    if (!o.noHull) { hull = new THREE.Mesh(geo(draw, o.k || 0.035), matHull); hull.visible = false; g.add(hull); }
    S.group.add(g);
    return { g, body, hull, lv: o.lv || 0 };
  }
  // contorno: se ve si on() y estás a menos de r (y en la misma planta)
  function hint(t, r, on) { if (t && t.hull) S.hints.push({ t, r: r || 4.5, on: on || (() => true) }); }
  // un objeto con el que se interactúa (con el botón de Recoger)
  // (lab: el texto cambia según cómo esté: una función)
  function prop(p) {
    const q = Object.assign({ kind: 'calm', reach: 1.7 }, p);
    if (p.lab) Object.defineProperty(q, 'label', { get: p.lab, enumerable: true });
    G.Props.add(q); S.props.push(q);
    return q;
  }
  // algo que se mueve solo: fn(dt) devuelve false al terminar
  function anim(fn) { S.anims.push(fn); }
  // una acción con la animación de registrar (dur s): al acabar, fn()
  function act(p, dur, x, z, fn, low) {
    if (p.busy() || p.dead) return false;
    p.action = { kind: 'search', t: 0, dur, impact: 0.92, face: Math.atan2(x - p.pos.x, z - p.pos.z), low: low !== false, done: false, onDone: fn };
    return true;
  }
  // lo que te llevas (monedas, piezas, suplementos, vida, objetos, balas): al momento
  function give(out, head) {
    const lines = G.Run && G.Run.calmGive ? G.Run.calmGive(out, S.player) : [];
    for (const l of lines) S.gains.push(l);
    snd('pickup');
    say((head ? head + ': ' : '') + (lines.length ? lines.join(' · ') : 'nada que te sirva'), 'good');
    return lines;
  }
  function found() { S.found++; hud(); if (S.found >= S.total) setTimeout(() => say('No queda nada por descubrir aquí. Cuando quieras, sigue el camino', 'good'), 2600); }
  // ¿lleva algo con lo que disparar a distancia?
  function canShoot(p) { return p.weapons.some((w) => { const d = G.Weapons.get(w.id); return d && G.Weapons.isGun(d); }); }
  // un trozo de papel (las notas)
  function paper(x, y, z, ry) {
    return thing((p) => { p.box(0, 0.006, 0, 0.21, 0.012, 0.28, 0xe8e0cc); p.box(0.02, 0.014, -0.02, 0.16, 0.004, 0.003, 0x6a6458); p.box(0.01, 0.014, 0.04, 0.17, 0.004, 0.003, 0x6a6458); }, x, y, z, ry, { k: 0.03 });
  }
  // una textura con letras (los números pintados o grabados)
  function textTex(lines, o) {
    o = o || {};
    const cv = document.createElement('canvas'); cv.width = o.w || 256; cv.height = o.h || 128;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    x.fillStyle = o.col || '#efe8d8'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = o.size || 54;
    lines.forEach((l, i) => { x.font = (o.bold === false ? '' : '700 ') + (i && o.size2 ? o.size2 : fs) + 'px ' + (o.font || 'Georgia, serif'); x.fillText(l, cv.width / 2, cv.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.05); });
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 2;
    return t;
  }
  function decal(tex, w, h, x, y, z, ry, opa) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: opa || 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); m.rotation.y = ry || 0; m.renderOrder = 2;
    S.group.add(m);
    return m;
  }

  // ---------- edificios: las aristas de fuera (puertas y ventanas) de una planta ----------
  function bldNear(x, z, lv) {
    const W = G.World;
    for (let r = 0; r <= 2; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const b = W.bldAt(Math.floor(x) + dx, Math.floor(z) + dz, lv || 0); if (b) return b; }
    return null;
  }
  const sameB = (a, b) => !!a && !!b && a.x0 === b.x0 && a.z0 === b.z0;
  function inB(B, x, z, lv) { return sameB(G.World.bldAt(Math.floor(x), Math.floor(z), lv || 0), B); }
  // cada arista que separa una casilla del edificio de una de fuera: { ref, mx, mz, nx, nz } (n: hacia fuera)
  function outerEdges(B, lv) {
    const out = [];
    for (let z = B.z0 - 1; z <= B.z0 + B.h; z++) for (let x = B.x0 - 1; x <= B.x0 + B.w; x++) {
      if (!inB(B, x + 0.5, z + 0.5, lv)) continue;
      if (!inB(B, x + 0.5, z - 0.5, lv)) out.push({ ref: { o: 'N', x, z, lv }, mx: x + 0.5, mz: z, nx: 0, nz: -1 });
      if (!inB(B, x + 0.5, z + 1.5, lv)) out.push({ ref: { o: 'N', x, z: z + 1, lv }, mx: x + 0.5, mz: z + 1, nx: 0, nz: 1 });
      if (!inB(B, x - 0.5, z + 0.5, lv)) out.push({ ref: { o: 'W', x, z, lv }, mx: x, mz: z + 0.5, nx: -1, nz: 0 });
      if (!inB(B, x + 1.5, z + 0.5, lv)) out.push({ ref: { o: 'W', x: x + 1, z, lv }, mx: x + 1, mz: z + 0.5, nx: 1, nz: 0 });
    }
    return out;
  }
  const isDoor = (e, E) => e === E.DOOR || e === E.DOOR_OPEN || e === E.DOOR_BROKEN;
  const isWin = (e, E) => e === E.WIN || e === E.WIN_OPEN || e === E.WIN_BROKEN;
  // cierra la planta baja de un edificio: las puertas (y los huecos de entrada), cerradas y atrancadas (kind: 'tranca'
  // o 'ganzua'); las ventanas, cerradas y que no se rompan (y claveteadas, si boards). Devuelve las puertas
  function shut(B, kind, boards) {
    const W = G.World, E = W.E, doors = [];
    for (const q of outerEdges(B, 0)) {
      const e = W.edgeGet(q.ref);
      // (en los mapas, las entradas suelen ser huecos sin hoja: aquí, puerta cerrada)
      if (isDoor(e, E) || e === E.ARCH) {
        W.setEdge(q.ref, E.DOOR); W.lockEdge(q.ref);
        const d = Object.assign({ kind, B, open: false }, q);
        S.doors[W.edgeKey(q.ref)] = d; doors.push(d);
      } else if (isWin(e, E)) {
        if (e !== E.WIN) { W.setEdge(q.ref, E.WIN); if (W.clearGlass) W.clearGlass(q.ref); }
        W.lockEdge(q.ref);
        if (boards) plank(q);
      } else if (e === E.NONE) { W.setEdge(q.ref, E.WALL); W.lockEdge(q.ref); }
    }
    return doors;
  }
  // tablones clavados en cruz sobre una ventana de la planta baja
  function plank(q) {
    const y = gy(q.mx + q.nx * 0.3, q.mz + q.nz * 0.3) + 1.45, ry = Math.atan2(q.nx, q.nz);
    thing((p) => {
      p.box(0, 0, 0, 1.15, 0.13, 0.035, 0x7a6248, 0, 0, 0.42);
      p.box(0, 0.02, 0.01, 1.15, 0.13, 0.035, 0x6a5440, 0, 0, -0.38);
      p.box(0, -0.3, 0.005, 1.05, 0.12, 0.035, 0x84694c);
    }, q.mx + q.nx * 0.09, y, q.mz + q.nz * 0.09, ry, { noHull: true });
  }
  // abre una puerta atrancada (la tranca que se quita, la cerradura forzada)
  function unlock(d) {
    const W = G.World;
    W.unlockEdge(d.ref); W.setEdge(d.ref, W.E.DOOR_OPEN);
    d.open = true;
    snd('doorOpen', { x: d.mx, z: d.mz, lv: 0 });
  }
  // casillas libres dentro de un edificio (planta lv), sin muebles ni escalera: [{ x, z, d (lejos de from) }]
  function spotsIn(B, lv, from) {
    const W = G.World, out = [];
    for (let z = B.z0; z < B.z0 + B.h; z++) for (let x = B.x0; x < B.x0 + B.w; x++) {
      const cx = x + 0.5, cz = z + 0.5;
      if (!inB(B, cx, cz, lv) || W.stairAt(cx, cz) || W.circleBlocked(cx, cz, 0.42, lv)) continue;
      // (pegada a algo: a una pared o a un mueble; no en medio del paso)
      let walls = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (W.circleBlocked(cx + dx * 0.6, cz + dz * 0.6, 0.2, lv)) walls++;
      out.push({ x: cx, z: cz, d: from ? Math.hypot(cx - from.x, cz - from.z) : 0, walls });
    }
    return out;
  }

  // ================= La granja del manzano =================
  const LAD_L = 4.3;
  function ladderDraw(p) {
    const wd = 0x8a7050, wd2 = 0x6e583e;
    for (const s2 of [-1, 1]) p.box(s2 * 0.22, LAD_L / 2, 0, 0.06, LAD_L, 0.07, wd);
    for (let y = 0.3; y < LAD_L - 0.1; y += 0.32) p.box(0, y, 0, 0.44, 0.045, 0.045, wd2);
  }
  function buildGranja() {
    const C = S.cfg, W = G.World, E = W.E, rng = S.rng, p0 = S.player;
    // ---------------- la casa: atrancada por dentro; se entra por la ventana de arriba con la escalera ----------------
    const H = C.house, B = bldNear((H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2, 0);
    const casa = { state: 'lying', B, doors: [], win: null, tipT: 0 };
    S.casa = casa;
    if (B) {
      casa.doors = shut(B, 'tranca', true);
      // la ventana de arriba: la más cercana al sitio pensado, con sitio fuera para la escalera
      let best = null, bd = Infinity;
      for (const q of outerEdges(B, 1)) {
        const e = W.edgeGet(q.ref);
        if (!isWin(e, E)) continue;
        const fx = q.mx + q.nx * 1.7, fz = q.mz + q.nz * 1.7;
        if (W.circleBlocked(fx, fz, 0.45, 0) || W.circleBlocked(q.mx + q.nx * 0.8, q.mz + q.nz * 0.8, 0.35, 0)) continue;
        const d = Math.hypot(q.mx - H.win.x, q.mz - H.win.z);
        if (d < bd) { bd = d; best = q; }
      }
      if (best) {
        W.setEdge(best.ref, E.WIN_OPEN); if (W.clearGlass) W.clearGlass(best.ref);
        casa.win = best;
        const g0 = gy(best.mx + best.nx * 1.6, best.mz + best.nz * 1.6), ins = { x: best.mx - best.nx * 0.62, z: best.mz - best.nz * 0.62 };
        const hUp = gy(ins.x, ins.z, 1) - g0, top = hUp + 1.0, th = Math.acos(Math.min(0.99, top / LAD_L)), hor = Math.sqrt(Math.max(0, LAD_L * LAD_L - top * top));
        casa.lean = { th, hor, hUp, g0, ins, foot: { x: best.mx + best.nx * (hor + 0.06), z: best.mz + best.nz * (hor + 0.06) }, face: Math.atan2(-best.nx, -best.nz) };
      }
    }
    // la escalera: tirada en uno de sus sitios (al azar)
    const L0 = C.ladders[Math.floor(rng() * C.ladders.length)];
    const lyaw = Math.atan2(L0[2], L0[3]);
    const lad = thing(ladderDraw, L0[0] - Math.sin(lyaw) * LAD_L / 2, gy(L0[0], L0[1]) + 0.05, L0[1] - Math.cos(lyaw) * LAD_L / 2, lyaw, { k: 0.04 });
    lad.inner = new THREE.Group(); lad.g.add(lad.inner);
    lad.inner.add(lad.body); lad.inner.add(lad.hull);
    lad.inner.rotation.set(Math.PI / 2, 0, 0);
    lad.cx = L0[0]; lad.cz = L0[1];
    casa.lad = lad;
    hint(lad, 6, () => casa.state === 'lying');
    // dónde va (un contorno de la escalera apoyada), mientras la llevas
    if (casa.lean) {
      const ghost = thing(ladderDraw, casa.lean.foot.x, casa.lean.g0, casa.lean.foot.z, casa.lean.face, { hullOnly: true, k: 0.03 });
      ghost.hull.rotation.x = casa.lean.th;
      hint(ghost, 14, () => casa.state === 'carried');
    }
    prop({ x: lad.cx, z: lad.cz, reach: 2.0, label: 'Coger la escalera',
      off: () => casa.state !== 'lying' || !!S.carry,
      use: (p) => { carryStart(p, 'escalera', lad, 0.74); casa.state = 'carried'; snd('drag', { vol: 0.5 }); return casa.lean ? 'Llevas la escalera: búscale una pared con la ventana abierta' : null; } });
    prop({ x: 0, z: 0, reach: 1.2, label: 'Dejar la escalera en el suelo', id: 'drop',
      off: () => casa.state !== 'carried' || (casa.lean && dist(S.player, casa.lean.foot.x, casa.lean.foot.z) < 2.6),
      use: (p) => { ladderLay(p); return null; } });
    if (casa.lean) {
      const Ln = casa.lean;
      prop({ x: Ln.foot.x, z: Ln.foot.z, reach: 2.4, label: 'Apoyar la escalera',
        off: () => casa.state !== 'carried',
        use: (p) => { ladderLean(); return 'Apoyada bajo la ventana de arriba'; } });
      prop({ x: Ln.foot.x + casa.win.nx * 0.35, z: Ln.foot.z + casa.win.nz * 0.35, reach: 1.6, label: 'Subir por la escalera',
        off: () => casa.state !== 'placed',
        use: (p) => (p.startLadder && p.startLadder(ladderParams(false)) ? null : 'Ahora no puedes') });
      prop({ x: Ln.ins.x, z: Ln.ins.z, lv: 1, reach: 1.5, label: 'Bajar por la escalera',
        off: () => casa.state !== 'placed',
        use: (p) => (p.startLadder && p.startLadder(ladderParams(true)) ? null : 'Ahora no puedes') });
      // arriba: el arcón del dormitorio (lo mejor de la casa)
      const sp = spotsIn(B, 1, Ln.ins).filter((s) => s.walls > 0 && s.d > 2.5).sort((a, b) => b.d - a.d)[0] || spotsIn(B, 1, Ln.ins).sort((a, b) => b.d - a.d)[0];
      if (sp) chest(sp.x, sp.z, 1, Math.atan2(Ln.ins.x - sp.x, Ln.ins.z - sp.z), 'Abrir el arcón del dormitorio', 'El arcón',
        { monedas: 5, piezas: 20, items: { venda: 1 }, balas: 1 }, 'Debajo de las mantas: una caja de munición, vendas y el dinero de la familia, atado con una goma.');
    }
    // las puertas atrancadas: desde dentro se quita la tranca
    for (const d of casa.doors) {
      prop({ x: d.mx - d.nx * 0.5, z: d.mz - d.nz * 0.5, lv: 0, reach: 1.5, label: 'Quitar la tranca',
        off: () => d.open || !inB(B, S.player.pos.x, S.player.pos.z, 0),
        use: () => { unlock(d); return 'Quitas la tranca: la puerta ya se abre'; } });
    }

    // ---------------- la bodega: la llave está en uno de cuatro escondites ----------------
    const KEYS = { caseta: ['Buscar en la caseta del perro', 'Una manta vieja con pelos de perro. Nada más.', 'Bajo la manta de la caseta, envuelta en un trapo: la llave de la bodega.'],
      pozo: ['Mirar en el pozo', 'Solo el cubo, vacío, y el agua muy abajo.', 'Colgada de un clavo por dentro del brocal, debajo del cubo: la llave de la bodega.'],
      espantapajaros: ['Registrar el espantapájaros', 'Paja y un pañuelo. En los bolsillos, nada.', 'En el bolsillo del abrigo del espantapájaros: la llave de la bodega.'],
      buzon: ['Abrir el buzón', 'Telarañas. Hace años que nadie deja nada aquí.', 'Al fondo del buzón, entre cartas viejas: la llave de la bodega.'] };
    const ids = Object.keys(C.keys);
    const key = { at: ids[Math.floor(rng() * ids.length)], clue: false, have: false, open: false };
    S.key = key;
    const CLUE = {
      caseta: 'la guarda Canelo. Está en su caseta, debajo de la manta (a él no se la quita nadie).',
      pozo: 'está colgada de un clavo por dentro del pozo, debajo del cubo. No se te caiga al agua.',
      espantapajaros: 'va en el bolsillo del espantapájaros, que para algo le puse mi abrigo viejo.',
      buzon: 'está en el buzón de la cancela. Ya nadie trae cartas.'
    };
    const hideHull = {
      caseta: (p) => { p.box(0, 0.33, 0, 0.8, 0.62, 1.0, 0); p.box(0, 0.8, 0, 0.62, 0.3, 1.12, 0); },
      pozo: (p) => { p.cyl(0, 0.43, 0, 0.84, 0.84, 0.86, 0, 14); p.box(0, 2.0, 0, 1.2, 0.32, 1.8, 0); for (const s2 of [-1, 1]) p.box(0, 1.36, s2 * 0.7, 0.11, 1.1, 0.11, 0); },
      espantapajaros: (p) => { p.cyl(0, 0.9, 0, 0.05, 0.05, 1.8, 0, 6); p.box(0, 1.25, 0, 0.5, 0.62, 0.26, 0); p.box(0, 1.43, 0, 1.4, 0.15, 0.17, 0); p.sph(0, 1.72, 0, 0.16, 0.18, 0.15, 0); p.cyl(0, 1.9, 0, 0.27, 0.15, 0.12, 0, 10); },
      buzon: (p) => { p.box(0, 0.55, 0, 0.1, 1.1, 0.1, 0); p.box(0, 1.12, 0, 0.3, 0.26, 0.42, 0); }
    };
    for (const id of ids) {
      const k = C.keys[id], h = thing(hideHull[id], k[0], gy(k[0], k[1]), k[1], k[2] || 0, { hullOnly: true, k: 0.035 });
      hint(h, 7, () => key.clue && !key.have && key.at === id);
      const tx = KEYS[id];
      prop({ x: k[0], z: k[1], reach: id === 'pozo' ? 1.9 : 1.6, label: tx[0],
        off: () => key.open || !!S.carry,
        use: (p) => {
          act(p, 1.1, k[0], k[1], () => {
            if (id === key.at && !key.have) { key.have = true; snd('pickup'); say(tx[2], 'good'); }
            else if (id === key.at) say('Aquí estaba la llave. Ya la llevas.');
            else { snd('rustle', { vol: 0.5 }); say(tx[1]); }
          }, id !== 'buzon');
          return null;
        } });
    }
    // la nota del abuelo, en el banco del porche
    const cl = paper(C.clue.x, gy(C.clue.x, C.clue.z) + 0.47, C.clue.z, 0.4);
    hint(cl, 4, () => !key.clue);
    prop({ x: C.clue.x, z: C.clue.z, reach: 1.6, label: 'Leer la nota del banco',
      use: () => {
        key.clue = true;
        noteUI({ title: 'Una nota, sujeta con una piedra', text: 'Ruth:\nHe cambiado el candado de la bodega. La llave ' + CLUE[key.at] + '\nNo se la des a nadie, ni a los del escorpión aunque pregunten bonito.\nLas conservas buenas están al fondo, detrás de las patatas.\n— Celso' }, true);
        return null;
      } });
    // la trampilla de la bodega, en el suelo junto a la casa (dos hojas de madera con el candado)
    const ce = C.cellar, cy = gy(ce.x, ce.z);
    const cel = thing((p) => {
      p.box(0, 0.06, 0, 1.7, 0.12, 1.5, 0x8a8478);
      p.box(0, 0.13, 0, 1.46, 0.02, 1.28, 0x1c1a18);
    }, ce.x, cy, ce.z, ce.face, { k: 0.04 });
    const leaves = [];
    for (const s2 of [-1, 1]) {
      const hg = new THREE.Group(); hg.position.set(s2 * 0.72, 0.15, 0); cel.g.add(hg);
      mats();
      const lf = new THREE.Mesh(geo((p) => {
        p.box(-s2 * 0.36, 0.03, 0, 0.7, 0.05, 1.24, 0x6a5038);
        for (let k = 0; k < 4; k++) p.box(-s2 * 0.36, 0.06, -0.45 + k * 0.3, 0.68, 0.012, 0.02, 0x4a3828);
        p.box(-s2 * 0.6, 0.075, 0, 0.12, 0.04, 0.3, 0x3a3a3a);
      }, 0), matBody);
      lf.castShadow = true; hg.add(lf); leaves.push({ hg, s2 });
    }
    const lock = thing((p) => { p.box(0, 0, 0, 0.12, 0.13, 0.05, 0x8a7a3a); p.box(0, 0.09, 0, 0.08, 0.06, 0.02, 0x9a9a9a); }, 0, 0.27, 0, 0, { noHull: true });
    S.group.remove(lock.g); cel.g.add(lock.g);
    hint(cel, 6, () => key.have && !key.open);
    prop({ x: ce.x, z: ce.z, reach: 1.9, lab: () => (key.have ? 'Abrir la bodega con la llave' : 'La trampilla de la bodega'),
      off: () => key.open,
      use: (p) => {
        if (!key.have) { snd('clang', { vol: 0.4 }); return 'Un candado grueso cierra la trampilla. Hace falta la llave'; }
        key.open = true; lock.g.visible = false;
        snd('doorOpen', { x: ce.x, z: ce.z });
        let t = 0;
        anim((dt) => { t = Math.min(1, t + dt * 1.2); for (const L of leaves) L.hg.rotation.z = -L.s2 * 1.9 * U.smooth(t); return t < 1; });
        setTimeout(() => { if (!S) return; give({ suplementos: 30, piezas: 15, items: { molotov: 1 } }, 'La bodega'); found(); say('En los escalones de la bodega: conservas, una botella de alcohol preparada y herramientas del abuelo', 'good'); }, 900);
        return null;
      } });

    // ---------------- el fardo del manzano: un disparo a la cuerda ----------------
    const T = C.tree, top = T.y + 2.4;
    const fardo = { state: 'hang', y: T.y, vy: 0, x: T.hx, z: T.hz, tip: false };
    S.fardo = fardo;
    const rope = thing((p) => p.cyl(0, 0, 0, 0.018, 0.018, 1, 0xb8a888, 5), T.hx, 0, T.hz, 0, { noHull: true });
    const ropeSet = (y0, y1) => { rope.g.position.y = (y0 + y1) / 2; rope.g.scale.y = Math.max(0.01, y1 - y0); };
    const gT = gy(T.hx, T.hz);
    ropeSet(gT + T.y + 0.38, gT + top);
    const bun = thing((p) => {
      p.sph(0, 0, 0, 0.32, 0.4, 0.28, 0x6a5a3e);
      p.box(0, 0.05, 0.2, 0.3, 0.3, 0.12, 0x5a4a30);
      p.cyl(0, -0.28, 0, 0.16, 0.16, 0.62, 0x4a5a3a, 8, 0, 0, Math.PI / 2);
      p.box(0, 0.36, 0, 0.06, 0.12, 0.06, 0xb8a888);
    }, T.hx, gT + T.y, T.hz, 0.6, { k: 0.04 });
    hint(bun, 16, () => fardo.state === 'hang' || fardo.state === 'down');
    const drop = () => {
      if (fardo.state !== 'hang') return;
      fardo.state = 'fall'; fardo.vy = 0;
      snd('rip', { x: T.hx, z: T.hz, vol: 0.5 });
      ropeSet(gT + T.y + 1.4, gT + top);
      anim((dt) => {
        fardo.vy -= 9.8 * dt; fardo.y += fardo.vy * dt;
        bun.g.rotation.z += dt * 2.5;
        if (fardo.y <= 0.32) { fardo.y = 0.32; fardo.state = 'down'; bun.g.rotation.z = 1.2; snd('land', { x: T.hx, z: T.hz }); say('El fardo ha caído'); }
        bun.g.position.y = gT + fardo.y;
        return fardo.state === 'fall';
      });
    };
    S.targets.push({ seg: [[T.hx, gT + T.y + 0.35, T.hz], [T.hx, gT + top, T.hz]], r: 0.13, on: () => fardo.state === 'hang', hit: drop });
    S.targets.push({ sph: [T.hx, gT + T.y, T.hz], r: 0.46, on: () => fardo.state === 'hang', hit: drop });
    S.near.push({ x: T.x, z: T.z, r: 9, once: true, fn: () => say('En el manzano grande cuelga un fardo, muy alto. La cuerda está gastada: un disparo bastaría' + (canShoot(S.player) ? '' : ' (pero no llevas nada con lo que disparar)')) });
    prop({ x: T.hx, z: T.hz, reach: 1.8, label: 'Abrir el fardo',
      off: () => fardo.state !== 'down',
      use: () => { fardo.state = 'open'; bun.g.visible = false; give({ monedas: 3, balas: 1.5, items: { mina: 1 } }, 'El fardo'); found(); return null; } });
    prop({ x: T.hx, z: T.hz, reach: 2.2, label: 'Mirar el fardo colgado',
      off: () => fardo.state !== 'hang',
      use: () => (canShoot(S.player) ? 'No llegas ni subiéndote a algo. La cuerda, en cambio, tiene mala pinta: un disparo' : 'No llegas. Con un arma de fuego o un arco se podría cortar la cuerda') });

    // ---------------- el descanso, las notas y la salida ----------------
    common();
    // al acercarte a la casa: lo que pasa con las puertas
    if (casa.doors.length) {
      const d0 = casa.doors[0];
      S.near.push({ x: d0.mx + d0.nx, z: d0.mz + d0.nz, r: 3.2, once: true, fn: () => say('La casa está atrancada por dentro y las ventanas de abajo, claveteadas. Arriba, una se quedó abierta...') });
    }
  }
  // la escalera, al hombro (la llevas tú)
  function carryStart(p, kind, t, slow) {
    S.carry = { kind, t, slow };
    p.carry = kind; p.carrySlow = slow;
    if (p.cur !== -1 && p.equip) p.equip(-1);
    p.aiming = false;
  }
  function carryEnd(p) { S.carry = null; p.carry = null; p.carrySlow = 1; }
  function ladderLay(p) {
    const casa = S.casa, lad = casa.lad;
    carryEnd(p);
    const yaw = p.facing, fx = Math.sin(yaw), fz = Math.cos(yaw);
    // en el suelo, a tu lado (a lo largo de hacia donde miras)
    const cx = p.pos.x + Math.cos(yaw) * 0.6, cz = p.pos.z - Math.sin(yaw) * 0.6;
    lad.g.position.set(cx - fx * LAD_L / 2, gy(cx, cz) + 0.05, cz - fz * LAD_L / 2);
    lad.g.rotation.set(0, yaw, 0);
    lad.inner.rotation.set(Math.PI / 2, 0, 0); lad.inner.position.set(0, 0, 0);
    lad.cx = cx; lad.cz = cz;
    const q = S.props.find((o) => o.label === 'Coger la escalera');
    if (q) { q.x = cx; q.z = cz; }
    casa.state = 'lying';
    snd('drag', { vol: 0.4 });
  }
  function ladderLean() {
    const casa = S.casa, lad = casa.lad, Ln = casa.lean;
    carryEnd(S.player);
    lad.g.position.set(Ln.foot.x, Ln.g0, Ln.foot.z);
    lad.g.rotation.set(0, Ln.face, 0);
    lad.inner.position.set(0, 0, 0);
    lad.inner.rotation.set(Ln.th, 0, 0);
    casa.state = 'placed';
    snd('hitBlunt', { vol: 0.35 });
  }
  function ladderParams(down) {
    const casa = S.casa, Ln = casa.lean, w = casa.win;
    return {
      down, face: Ln.face, h: Ln.hUp,
      foot: { x: Ln.foot.x + w.nx * 0.42, z: Ln.foot.z + w.nz * 0.42 },
      top: { x: w.mx + w.nx * 0.42, z: w.mz + w.nz * 0.42 },
      ins: Ln.ins
    };
  }
  // un arcón con su tapa (se abre al usarlo): lo que da, la primera vez
  function chest(x, z, lv, ry, label, head, out, text) {
    const y = gy(x, z, lv);
    const c = thing((p) => {
      p.box(0, 0.24, 0, 1.0, 0.46, 0.52, 0x6e4a32);
      for (const s2 of [-1, 1]) p.box(s2 * 0.42, 0.24, 0, 0.06, 0.47, 0.53, 0x4a3a2a);
      p.box(0, 0.06, 0, 1.02, 0.06, 0.54, 0x4a3a2a);
    }, x, y, z, ry, { k: 0.035, lv });
    const lid = new THREE.Group(); lid.position.set(0, 0.47, -0.26); c.g.add(lid);
    const lm = new THREE.Mesh(geo((p) => { p.box(0, 0.05, 0.26, 1.02, 0.1, 0.54, 0x7a5238); p.box(0, 0.05, 0.53, 0.12, 0.12, 0.03, 0x8a7a3a); }, 0), matBody);
    lm.castShadow = true; lid.add(lm);
    const st = { open: false };
    hint(c, 5, () => !st.open);
    prop({ x, z, lv, reach: 1.6, label, off: () => st.open,
      use: (p) => {
        st.open = true;
        snd('doorOpen', { x, z, lv, vol: 0.6 });
        let t = 0;
        anim((dt) => { t = Math.min(1, t + dt * 1.6); lid.rotation.x = -1.7 * U.smooth(t); return t < 1; });
        setTimeout(() => { if (!S) return; if (text) say(text, 'good'); give(out, head); found(); }, 700);
        return null;
      } });
    return c;
  }

  // ================= La casa del pescador =================
  function buildPescador() {
    const C = S.cfg, W = G.World, rng = S.rng;
    const dg = () => 1 + Math.floor(rng() * 9);
    const code = [dg(), dg(), dg()];
    S.code = code;
    // ---------------- la cabaña: cerrada con llave; se fuerza la cerradura ----------------
    const Cb = C.cabin, B = bldNear((Cb.x0 + Cb.x1) / 2, (Cb.z0 + Cb.z1) / 2, 0);
    const cab = { B, doors: [] };
    S.cab = cab;
    if (B) {
      cab.doors = shut(B, 'ganzua', false);
      for (const d of cab.doors) {
        prop({ x: d.mx + d.nx * 0.45, z: d.mz + d.nz * 0.45, reach: 1.5, label: 'Forzar la cerradura',
          fx: d.mx + d.nx * 0.3, fz: d.mz + d.nz * 0.3,
          off: () => d.open || !!S.lock || !!S.carry,
          use: (p) => pickStart(p, d) });
      }
      // dentro: la alacena (lo que guardaba Anselmo) y la caja de las fotos (la tercera cifra)
      const d0 = cab.doors[0] || { mx: (B.x0 + B.w / 2), mz: B.z0 + B.h };
      const sp = spotsIn(B, 0, { x: d0.mx, z: d0.mz }).filter((s) => s.walls > 0).sort((a, b) => b.d - a.d);
      if (sp[0]) chest(sp[0].x, sp[0].z, 0, Math.atan2(d0.mx - sp[0].x, d0.mz - sp[0].z), 'Abrir la alacena', 'La alacena',
        { suplementos: 25, items: { venda: 1 }, monedas: 2 }, 'Latas de sardinas, un botiquín de barco y unas monedas en un bote de café.');
      const ph = sp.find((s) => sp[0] && Math.hypot(s.x - sp[0].x, s.z - sp[0].z) > 1.8) || sp[1];
      if (ph) {
        const box = thing((p) => { p.box(0, 0.06, 0, 0.32, 0.12, 0.22, 0x8a8e6a); p.box(0, 0.125, 0, 0.26, 0.01, 0.17, 0xe6dcc4); }, ph.x, gy(ph.x, ph.z), ph.z, rng() * 3, { k: 0.03 });
        hint(box, 5, () => S.locker.read && !S.locker.open);
        prop({ x: ph.x, z: ph.z, reach: 1.5, label: 'Mirar la caja de las fotos',
          use: () => { S.locker.seen[2] = true; noteUI({ title: 'Una caja de lata con fotos', text: 'La de arriba: Inés de niña, mojada hasta las orejas, con un pez casi tan grande como ella.\nDetrás, a lápiz: «' + code[2] + '»' }); return null; } });
      }
    }
    // ---------------- el baúl con candado de combinación ----------------
    const Lk = C.locker, ly = gy(Lk.x, Lk.z);
    const locker = { read: false, open: false, seen: [false, false, false], dial: [0, 0, 0] };
    S.locker = locker;
    const bau = thing((p) => {
      p.box(0, 0.22, 0, 1.1, 0.42, 0.56, 0x3e5a6a);
      for (const s2 of [-1, 1]) p.box(s2 * 0.5, 0.22, 0, 0.05, 0.43, 0.57, 0x2a3a44);
      p.box(0, 0.03, 0, 1.12, 0.06, 0.58, 0x2a3a44);
    }, Lk.x, ly, Lk.z, Lk.face, { k: 0.035 });
    const lid = new THREE.Group(); lid.position.set(0, 0.43, -0.28); bau.g.add(lid);
    const lidM = new THREE.Mesh(geo((p) => { p.box(0, 0.05, 0.28, 1.12, 0.1, 0.58, 0x44627a); }, 0), matBody); lidM.castShadow = true; lid.add(lidM);
    const pad = new THREE.Mesh(geo((p) => { p.box(0, -0.09, 0.6, 0.11, 0.13, 0.05, 0x8a7a3a); p.box(0, -0.02, 0.6, 0.07, 0.06, 0.02, 0x9a9a9a); }, 0), matBody); lid.add(pad);
    const note = paper(0, 0.11, 0.28, 0.2); S.group.remove(note.g); lid.add(note.g); note.g.position.set(0.1, 0.105, 0.3);
    hint(bau, 5, () => !locker.open);
    prop({ x: Lk.x, z: Lk.z, reach: 1.7, label: 'Leer la nota del baúl',
      off: () => locker.read,
      use: () => {
        locker.read = true;
        noteUI({ title: 'Clavada en la tapa del baúl', text: 'Inés:\nLe he puesto un candado nuevo al baúl, que el de antes lo abría cualquiera. Para que no se te olvide:\n— La primera cifra es la de la barca (la Rosa).\n— La segunda la grabé en el primer poste del muelle.\n— La tercera, detrás de tu foto con el pez grande, en la caja de lata de casa.\n— Papá' }, true);
        return null;
      } });
    prop({ x: Lk.x, z: Lk.z, reach: 1.7, label: 'Abrir el candado del baúl',
      off: () => !locker.read || locker.open,
      use: () => { codeUI(); return null; } });
    locker.openIt = () => {
      locker.open = true; pad.visible = false;
      snd('doorOpen', { x: Lk.x, z: Lk.z, vol: 0.6 });
      let t = 0;
      anim((dt) => { t = Math.min(1, t + dt * 1.5); lid.rotation.x = -1.75 * U.smooth(t); return t < 1; });
      setTimeout(() => { if (!S) return; say('Dentro, envueltos en hule: los ahorros de Anselmo y piezas de recambio del motor de la barca', 'good'); give({ monedas: 6, piezas: 25, balas: 1 }, 'El baúl'); found(); }, 800);
    };
    // la barca varada (la primera cifra, pintada en el costado)
    const Bt = C.boat, by = gy(Bt.x, Bt.z);
    const bh = thing((p) => p.box(0, 0.38, 0, 3.4, 0.72, 1.3, 0), Bt.x, by, Bt.z, Math.PI / 2, { hullOnly: true, k: 0.04 });
    hint(bh, 6, () => locker.read && !locker.open);
    decal(textTex(['ROSA', String(code[0])], { size: 46, col: '#f2ece0', font: 'Arial, sans-serif' }), 0.9, 0.45, Bt.x + 0.72, by + 0.44, Bt.z - 0.5, Math.PI / 2);
    prop({ x: Bt.x + 1.1, z: Bt.z - 0.3, reach: 2.2, label: 'Mirar la barca', fx: Bt.x + 0.75, fz: Bt.z - 0.3,
      use: () => { locker.seen[0] = true; return 'En el costado, con pintura blanca: ROSA ' + code[0]; } });
    // el muelle de tablas (se adentra en el mar) y su primer poste (la segunda cifra, grabada)
    dock(C.dock);
    const Pt = C.post, pty = gy(Pt.x, Pt.z);
    const post = thing((p) => { p.cyl(0, 0.65, 0, 0.13, 0.11, 1.3, 0x5a4a38, 8); p.box(0, 1.32, 0, 0.3, 0.04, 0.3, 0x4a3a2a); }, Pt.x, pty, Pt.z, 0, { k: 0.035 });
    hint(post, 5, () => locker.read && !locker.open);
    decal(textTex([String(code[1])], { size: 96, col: '#2a2018', w: 128, h: 128 }), 0.16, 0.16, Pt.x - 0.135, pty + 0.95, Pt.z, -Math.PI / 2, 0.8);
    prop({ x: Pt.x - 0.4, z: Pt.z, reach: 1.7, label: 'Mirar el poste del muelle', fx: Pt.x - 0.2, fz: Pt.z,
      use: () => { locker.seen[1] = true; return 'Grabado a navaja en la madera del poste: un ' + code[1]; } });

    // ---------------- la jaula hundida: gasolina, el generador y el cabrestante ----------------
    const jaula = { can: false, fuel: false, pulls: 0, power: false, state: 'sunk', t: 0 };
    S.jaula = jaula;
    const cs = C.cans[Math.floor(rng() * C.cans.length)];
    const can = thing((p) => {
      p.box(0, 0.24, 0, 0.18, 0.46, 0.34, 0xa8321e);
      p.box(0, 0.5, -0.06, 0.06, 0.07, 0.16, 0x7a2416);
      p.cyl(0, 0.52, 0.12, 0.03, 0.03, 0.08, 0x2a2a2a, 6);
    }, cs[0], gy(cs[0], cs[1]), cs[1], rng() * 3, { k: 0.03 });
    hint(can, 5, () => !jaula.can && !jaula.fuel);
    prop({ x: cs[0], z: cs[1], reach: 1.5, label: 'Coger el bidón de gasolina',
      off: () => jaula.can || jaula.fuel || !!S.carry,
      use: (p) => { jaula.can = true; carryStart(p, 'bidon', can, 0.9); snd('pickup', { vol: 0.6 }); return 'Pesa: aún le queda gasolina'; } });
    const Gn = C.gen;
    const genH = thing((p) => p.box(0, 0.62, 0, 1.75, 1.26, 0.95, 0), Gn.x, gy(Gn.x, Gn.z), Gn.z, 0, { hullOnly: true, k: 0.035 });
    hint(genH, 6, () => jaula.can || (jaula.fuel && !jaula.power));
    prop({ x: Gn.x, z: Gn.z + 0.75, reach: 1.7, lab: () => (jaula.can ? 'Llenar el depósito' : (jaula.fuel ? 'Arrancar el generador' : 'Mirar el generador')), fx: Gn.x, fz: Gn.z + 0.5,
      off: () => jaula.power,
      use: (p) => {
        if (jaula.can) {
          act(p, 1.8, Gn.x, Gn.z, () => {
            jaula.can = false; jaula.fuel = true; carryEnd(p);
            can.g.position.set(Gn.x + 1.1, gy(Gn.x + 1.1, Gn.z), Gn.z + 0.2);
            snd('slide', { vol: 0.4 });
            say('Depósito lleno. Ahora, a arrancarlo');
          }, true);
          return null;
        }
        if (!jaula.fuel) return 'El depósito está seco. Hace falta gasolina';
        jaula.pulls++;
        snd('slide', { x: Gn.x, z: Gn.z, vol: 0.8 });
        if (jaula.pulls < 2) { setTimeout(() => snd('hitBlunt', { x: Gn.x, z: Gn.z, vol: 0.4 }), 250); return 'Tiras de la cuerda: tose y se ahoga. Otra vez'; }
        jaula.power = true;
        lightsOn();
        setTimeout(() => snd('crackle', { x: Gn.x, z: Gn.z, vol: 0.5 }), 200);
        return 'El generador arranca. Se encienden las bombillas del muelle';
      } });
    // las bombillas: de la caseta al muelle (apagadas hasta que hay corriente)
    S.bulbs = [];
    const Wn = C.winch, bx0 = 37.6, bz0 = 30.6, bx1 = C.dock.x, bz1 = C.dock.z0 + 4;
    mats();
    for (let k = 0; k <= 9; k++) {
      const u = k / 9, x = U.lerp(bx0, bx1, u), z = U.lerp(bz0, bz1, u), y = U.lerp(2.4, 2.0, u) - Math.sin(u * Math.PI) * 0.5 + gy(x, z) * (1 - u) + C.dock.y * u;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), matDark); b.position.set(x, y, z); S.group.add(b); S.bulbs.push(b);
    }
    for (const [x, z, h] of [[bx0, bz0, 2.6], [bx1 - 0.9, bz1, 2.3]]) thing((p) => p.cyl(0, h / 2, 0, 0.05, 0.05, h, 0x4a4038, 6), x, x === bx0 ? gy(x, z) : C.dock.y, z, 0, { noHull: true });
    // el cable de las bombillas, de poste a poste (de bombilla en bombilla)
    const pts = [new THREE.Vector3(bx0, gy(bx0, bz0) + 2.6, bz0)].concat(S.bulbs.map((b) => b.position.clone().add(new THREE.Vector3(0, 0.07, 0))), [new THREE.Vector3(bx1 - 0.9, C.dock.y + 2.3, bz1)]);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = a.distanceTo(b);
      const w = thing((p) => p.box(0, 0, 0.5, 0.018, 0.018, 1, 0x2a2622), a.x, a.y, a.z, 0, { noHull: true });
      w.g.scale.set(1, 1, L); w.g.lookAt(b);
    }
    // el cabrestante (en la arena, junto al muelle) y la jaula en el fondo, atada al cabo
    const win = thing((p) => {
      p.box(0, 0.12, 0, 0.9, 0.24, 0.7, 0x5a5a56);
      for (const s2 of [-1, 1]) p.box(s2 * 0.36, 0.5, 0, 0.08, 0.6, 0.5, 0x4a4a46);
      p.cyl(0, 0.62, 0, 0.18, 0.18, 0.64, 0x8a6a3a, 10, 0, 0, Math.PI / 2);
      p.box(-0.55, 0.45, 0, 0.3, 0.32, 0.36, 0x2e5a3a);
      p.box(0.2, 0.35, 0.36, 0.2, 0.2, 0.04, 0x3a3a36);
    }, Wn.x, gy(Wn.x, Wn.z), Wn.z, 0, { k: 0.035 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), matDark); lamp.position.set(0.2, 0.47, 0.39); win.g.add(lamp);
    S.winLamp = lamp;
    hint(win, 6, () => jaula.power && jaula.state === 'sunk');
    const Cg = C.cage;
    const cage = thing((p) => {
      const c = 0x6a6e70;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(sx * 0.45, 0, sz * 0.35, 0.05, 0.9, 0.05, c);
      for (const y of [-0.43, 0.43]) { p.box(0, y, 0.35, 0.95, 0.05, 0.05, c); p.box(0, y, -0.35, 0.95, 0.05, 0.05, c); p.box(0.45, y, 0, 0.05, 0.05, 0.75, c); p.box(-0.45, y, 0, 0.05, 0.05, 0.75, c); }
      for (let k = -2; k <= 2; k++) { p.box(k * 0.18, 0, 0.35, 0.015, 0.86, 0.015, c); p.box(k * 0.18, 0, -0.35, 0.015, 0.86, 0.015, c); }
      p.box(0, -0.2, 0, 0.7, 0.4, 0.5, 0x4a5a5e);
      p.box(0.1, 0.1, 0.05, 0.4, 0.22, 0.3, 0x8a5a3a);
    }, Cg.x0, cageY(Cg.x0, Cg.z0), Cg.z0, 0.3, { k: 0.04 });
    const cable = thing((p) => p.box(0, 0, 0.5, 0.025, 0.025, 1, 0xc8bca0), 0, 0, 0, 0, { noHull: true });
    const cableSet = () => {
      const ax = Wn.x, ay = gy(Wn.x, Wn.z) + 0.62, az = Wn.z, b = cage.g.position;
      const dx = b.x - ax, dy = (b.y + 0.4) - ay, dz = b.z - az, L = Math.hypot(dx, dy, dz);
      cable.g.position.set(ax, ay, az); cable.g.scale.set(1, 1, L);
      cable.g.rotation.set(0, 0, 0); cable.g.lookAt(ax + dx, ay + dy, az + dz);
    };
    cableSet();
    hint(cage, 5, () => jaula.state === 'up');
    prop({ x: Wn.x, z: Wn.z + 0.7, reach: 1.7, lab: () => (jaula.power ? 'Poner en marcha el cabrestante' : 'Mirar el cabrestante'), fx: Wn.x, fz: Wn.z,
      off: () => jaula.state !== 'sunk',
      use: (p) => {
        if (!jaula.power) return 'Es eléctrico: sin corriente no se mueve. El cable va al generador de la caseta';
        jaula.state = 'pull'; jaula.t = 0;
        act(p, 3.8, Wn.x, Wn.z, () => {}, false);
        snd('drag', { x: Wn.x, z: Wn.z });
        say('El cabo se tensa y algo grande sale del agua, arrastrándose por la arena');
        anim((dt) => {
          jaula.t = Math.min(1, jaula.t + dt / 3.8);
          const u = U.smooth(jaula.t), x = U.lerp(Cg.x0, Cg.x1, u), z = U.lerp(Cg.z0, Cg.z1, u);
          cage.g.position.set(x, cageY(x, z), z); cage.g.rotation.y = 0.3 + u * 0.4;
          cableSet();
          if (Math.random() < dt * 2.5) snd('drag', { x, z, vol: 0.35 });
          if (jaula.t >= 1) { jaula.state = 'up'; snd('hitBlunt', { x, z, vol: 0.5 }); }
          return jaula.t < 1;
        });
        return null;
      } });
    prop({ x: Cg.x1, z: Cg.z1 - 0.7, reach: 1.7, label: 'Abrir la jaula', fx: Cg.x1, fz: Cg.z1,
      off: () => jaula.state !== 'up',
      use: () => { jaula.state = 'open'; snd('clang', { x: Cg.x1, z: Cg.z1, vol: 0.5 }); give({ monedas: 4, piezas: 20, items: { molotov: 1 }, balas: 1 }, 'La jaula'); found(); say('Un bidón estanco: lo que Anselmo no quería que encontrara nadie', 'good'); return null; } });

    common();
    if (cab.doors.length) {
      const d0 = cab.doors[0];
      S.near.push({ x: d0.mx + d0.nx, z: d0.mz + d0.nz, r: 3.0, once: true, fn: () => say('La cabaña está cerrada con llave. La cerradura es vieja: con una horquilla se podría forzar') });
    }
    S.near.push({ x: Lk.x, z: Lk.z, r: 3.0, once: true, fn: () => say('Un baúl con candado de combinación y una nota clavada en la tapa') });
    S.near.push({ x: Wn.x, z: Wn.z, r: 4.0, once: true, fn: () => say('Un cabrestante, y el cabo se pierde en el agua: algo hay atado al fondo') });
  }
  // la jaula sigue el fondo (bajo el agua) y luego la arena
  function cageY(x, z) { const t = G.World.terrainAt(x, z); return t + 0.46 - (t < 0 ? 0.4 : 0); }
  // el muelle: tablas sobre postes, desde la arena mar adentro
  function dock(D) {
    thing((p) => {
      const wd = 0x7a6650, dk = 0x4e4234, L = D.z1 - D.z0;
      for (let z = 0; z <= L; z += 2.4) for (const s2 of [-1, 1]) p.cyl(s2 * 1.05, -1.4 - D.y / 2, z, 0.13, 0.12, 2.8 + D.y, dk, 7);
      for (const s2 of [-0.6, 0.6]) p.box(s2, -0.18, L / 2, 0.16, 0.2, L, dk);
      for (let z = 0.2; z < L; z += 0.48) p.box(0, 0, z, 2.4, 0.07, 0.42, U.shade(wd, 0.86 + ((z * 7.3) % 1) * 0.28));
      for (let z = 2; z < L; z += 4.8) p.box(1.1, 0.2, z, 0.14, 0.3, 0.14, dk);
    }, D.x, D.y, D.z0, 0, { noHull: true });
  }
  function lightsOn() {
    mats();
    for (const b of S.bulbs) b.material = matGlow;
    if (S.winLamp) S.winLamp.material = matGlow;
  }

  // ================= Lo de las dos: el fuego, las notas y la salida =================
  function common() {
    const C = S.cfg;
    // el fuego (encendido: las llamas y las brasas, sin luz propia para no recompilar nada)
    const R = C.rest, ry = gy(R.x, R.z);
    mats();
    const fl = new THREE.Group(); fl.position.set(R.x, ry, R.z); S.group.add(fl);
    const flames = [];
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 - k * 0.015, 0.6 - k * 0.05, 6), matFlame);
      const a = k / 5 * TAU;
      m.position.set(Math.sin(a) * (k ? 0.14 : 0), 0.3, Math.cos(a) * (k ? 0.14 : 0)); fl.add(m);
      flames.push({ m, ph: k * 1.7, b: 0.6 - k * 0.05 });
    }
    const embers = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), new THREE.MeshBasicMaterial({ color: 0xc84a1a, transparent: true, opacity: 0.55, depthWrite: false }));
    embers.material.toneMapped = false; embers.rotation.x = -Math.PI / 2; embers.position.y = 0.05; fl.add(embers);
    let crk = 1;
    anim((dt) => {
      for (const f of flames) { const s = 0.75 + 0.3 * Math.sin(S.t * 7 + f.ph) + 0.15 * Math.sin(S.t * 13 + f.ph * 2); f.m.scale.set(1, s, 1); f.m.position.y = f.b * s / 2 + 0.06; }
      // (cerca, el fuego crepita)
      if ((crk -= dt) <= 0) { crk = 1.8 + Math.random() * 2.2; if (dist(S.player, R.x, R.z) < 9) snd('crackle', { x: R.x, z: R.z, vol: 0.35 }); }
      return true;
    });
    S.near.push({ x: R.x, z: R.z, r: 3.5, once: true, fn: () => { if (S.player.health < 95) say('Un fuego encendido hace poco. Puedes sentarte un rato a descansar'); } });
    prop({ x: R.x, z: R.z, reach: 2.4, label: 'Descansar junto al fuego',
      off: () => S.restUsed || !!S.carry,
      use: (p) => {
        if (p.health >= 99) return 'Ahora no te hace falta: guárdalo para cuando estés tocado';
        S.restUsed = true;
        rest(() => { give({ vida: 60 }, 'Descansas junto al fuego'); });
        return null;
      } });
    // las notas sueltas (se guardan en la mochila)
    for (const [x, z, id] of C.lore || []) {
      const t = paper(x, gy(x, z) + (S.loreY && S.loreY[id] || 0.02), z, (x * 7) % 3);
      const st = { read: false };
      hint(t, 3.5, () => !st.read);
      prop({ x, z, reach: 1.5, label: 'Leer la nota',
        use: () => {
          const N = LORE[id];
          noteUI({ title: N.title, text: N.text });
          if (!st.read) { st.read = true; found(); if (Notes.add(id)) setTimeout(() => say('Nota guardada en la mochila (pestaña Notas)', 'good'), 300); }
          return null;
        } });
    }
    // la salida: por donde se llegó
    const X = C.exit;
    prop({ x: X.x, z: X.z, reach: 2.6, label: 'Seguir el camino',
      off: () => !!S.carry,
      use: () => {
        const left = S.total - S.found;
        if (left > 0 && S.exitAsk <= 0) { S.exitAsk = 5; return 'Aún quedan cosas por descubrir aquí (' + left + '). Vuelve a pulsar para seguir el camino'; }
        endUI();
        return null;
      } });
  }

  // ================= Ganzúa (forzar la cerradura de la cabaña) =================
  function pickStart(p, d) {
    if (p.busy() || p.dead || S.lock) return null;
    p.aiming = false;
    p.action = { kind: 'pack', t: 0, dur: 1e9, impact: 2, face: Math.atan2(d.mx - p.pos.x, d.mz - p.pos.z), done: false, calmLock: true };
    S.lock = { d, a: p.action };
    if (G.SafeCrack) G.SafeCrack.start({ kind: 'pick', tier: 0.35 });
    return 'Mueve la horquilla con el joystick y toca Girar. Para dejarlo, salta o esquiva';
  }
  function pickStop(msg) {
    const L = S.lock; if (!L) return;
    S.lock = null;
    if (G.SafeCrack) G.SafeCrack.stop();
    if (S.player.action === L.a) S.player.action = null;
    if (msg) say(msg);
  }
  function pickUpdate(dt) {
    const L = S.lock, p = S.player;
    if (!L) return;
    if (p.dead || p.action !== L.a) { pickStop('Lo dejas'); return; }
    const I = G.Input;
    if (I && (I.jump || I.dodge || I.crouch || I.pack)) { pickStop('Lo dejas'); return; }
    const r = G.SafeCrack ? G.SafeCrack.update(dt) : 'done';
    if (r === 'done') {
      pickStop(null);
      unlock(L.d);
      say('Clic. La cerradura cede: la cabaña está abierta', 'good');
    }
  }

  // ================= Pantallas: notas, el candado de combinación y el final =================
  let uiRoot = null, hudEl = null, fadeEl = null, keyBound = false;
  function ensureUI() {
    if (uiRoot) return;
    uiRoot = document.createElement('div'); uiRoot.id = 'calm-ui'; uiRoot.className = 'hidden';
    document.body.appendChild(uiRoot);
    uiRoot.addEventListener('pointerdown', (e) => e.stopPropagation());
    uiRoot.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b || !S || !S.ui) return;
      e.preventDefault();
      uiKey(b.dataset.k, b.dataset.d != null ? +b.dataset.d : null);
    });
    hudEl = document.createElement('div'); hudEl.id = 'calm-hud'; hudEl.className = 'hidden';
    document.body.appendChild(hudEl);
    fadeEl = document.createElement('div'); fadeEl.id = 'calm-fade';
    document.body.appendChild(fadeEl);
    if (!keyBound) {
      keyBound = true;
      document.addEventListener('keydown', (e) => {
        if (!S || !S.ui) return;
        const K = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
          Enter: 'ok', Space: 'ok', KeyE: 'ok', KeyT: 'ok', KeyF: 'ok', Escape: 'back', Backspace: 'back', KeyQ: 'back', KeyB: 'back' }[e.code];
        e.preventDefault(); e.stopPropagation();
        if (!K || e.repeat || performance.now() - S.ui.t0 < 250) return;
        uiKey(K);
      }, true);
    }
  }
  function openUI(o) {
    ensureUI();
    o.t0 = performance.now();
    S.ui = o;
    uiRoot.className = 'cu-' + o.kind;
    o.render();
    if (G.Audio && G.Audio.ui) G.Audio.ui('uiOk');
    if (!G.Input.isTouch && G.Input.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  }
  function closeUI() {
    if (!S || !S.ui) return;
    const o = S.ui; S.ui = null;
    uiRoot.className = 'hidden'; uiRoot.innerHTML = '';
    if (G.Audio && G.Audio.ui) G.Audio.ui('uiBack');
    if (!G.Input.isTouch && G.Input.enabled && G.Input.requestLock) G.Input.requestLock();
    if (o.onClose) o.onClose();
  }
  function uiKey(k, d) { if (S && S.ui && S.ui.key) S.ui.key(k, d); }
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const para = (t) => esc(t).split('\n').map((l) => '<p>' + l + '</p>').join('');
  const hintKeys = () => (G.Input.isTouch ? '' : ' <small>(Esc)</small>');
  // una nota: here = es de esta parada (se ve en la mochila mientras sigas aquí)
  function noteUI(n, here) {
    if (here && !S.notes.some((x) => x.title === n.title)) S.notes.push({ title: n.title, text: n.text });
    snd('rustle', { vol: 0.35 });
    openUI({ kind: 'note',
      render() { uiRoot.innerHTML = '<div class="cu-card cu-paper"><h3>' + esc(n.title) + '</h3><div class="cu-txt">' + para(n.text) + '</div><div class="cu-ft"><button type="button" data-k="back">Cerrar' + hintKeys() + '</button></div></div>'; },
      key(k) { if (k === 'back' || k === 'ok') closeUI(); } });
  }
  // el candado: tres ruedas (0 a 9); ← → elige la rueda, ↑ ↓ cambia el número
  function codeUI() {
    const L = S.locker, o = { kind: 'code', sel: 0, msg: '', shake: 0 };
    o.render = () => {
      const seen = ['la barca', 'el poste', 'la foto'];
      uiRoot.innerHTML = '<div class="cu-card cu-lock"><small>CANDADO DE COMBINACIÓN</small><div class="cu-dials' + (o.shake ? ' shake' : '') + '">' +
        L.dial.map((v, i) => '<div class="cu-dial' + (i === o.sel ? ' sel' : '') + '"><button type="button" data-k="inc" data-d="' + i + '">▲</button><b>' + v + '</b><button type="button" data-k="dec" data-d="' + i + '">▼</button><em>' + (L.seen[i] ? seen[i] : '?') + '</em></div>').join('') +
        '</div><p class="cu-msg">' + (o.msg || (G.Input.isTouch ? 'Toca las flechas para girar cada rueda' : '← → elige la rueda · ↑ ↓ cambia el número')) + '</p>' +
        '<div class="cu-ft"><button type="button" data-k="ok">Abrir</button><button type="button" data-k="back">Dejarlo' + hintKeys() + '</button></div></div>';
    };
    o.key = (k, d) => {
      if (d != null && d !== undefined && !isNaN(d)) o.sel = d;
      if (k === 'left') o.sel = (o.sel + 2) % 3;
      else if (k === 'right') o.sel = (o.sel + 1) % 3;
      else if (k === 'up' || k === 'inc') { L.dial[o.sel] = (L.dial[o.sel] + 1) % 10; snd('slide', { vol: 0.18 }); }
      else if (k === 'down' || k === 'dec') { L.dial[o.sel] = (L.dial[o.sel] + 9) % 10; snd('slide', { vol: 0.18 }); }
      else if (k === 'back') { closeUI(); return; }
      else if (k === 'ok') {
        if (L.dial.every((v, i) => v === S.code[i])) { closeUI(); L.openIt(); return; }
        o.msg = 'No abre.'; o.shake = 1; snd('clang', { vol: 0.35 });
        setTimeout(() => { if (S && S.ui === o) { o.shake = 0; o.render(); } }, 420);
      }
      o.render();
    };
    openUI(o);
  }
  // el final: lo que te llevas, y seguir (o quedarte un rato más)
  function endUI() {
    const o = { kind: 'end' };
    o.render = () => {
      const D = S.def, rows = S.gains.length ? S.gains.map((l) => '<li' + (l.charAt(0) === '−' ? ' class="m"' : '') + '>' + esc(l) + '</li>').join('') : '<li class="z">Nada que llevarse</li>';
      uiRoot.innerHTML = '<div class="cu-card cu-end"><small>DESCANSO' + (S.step ? ' · TRAMO ' + S.step : '') + '</small><h3>' + esc(D.name) + '</h3>' +
        '<p class="cu-f">Hallazgos: ' + S.found + ' de ' + S.total + (S.restUsed ? ' · has descansado' : '') + '</p><ul class="cu-got">' + rows + '</ul>' +
        '<div class="cu-ft"><button type="button" data-k="ok">Seguir el camino</button><button type="button" data-k="back">Quedarme un rato' + hintKeys() + '</button></div></div>';
    };
    o.key = (k) => {
      if (k === 'back') { closeUI(); return; }
      if (k === 'ok') { const fn = S.done; closeUI(); if (fn) fn(); }
    };
    openUI(o);
  }
  // descansar: fundido a negro, lo que cura y vuelta
  function rest(fn) {
    ensureUI();
    const p = S.player;
    p.action = { kind: 'pack', t: 0, dur: 1e9, impact: 2, face: p.facing, done: false, calmRest: true };
    fadeEl.classList.add('on');
    setTimeout(() => {
      if (!S) return;
      fn();
      setTimeout(() => { fadeEl.classList.remove('on'); if (S && S.player.action && S.player.action.calmRest) S.player.action = null; }, 1300);
    }, 1100);
  }
  function hud() {
    if (!hudEl || !S) return;
    const D = S.def;
    hudEl.innerHTML = '<b>' + esc(D.name) + '</b><span>' + D.tag + '</span><em>Hallazgos ' + S.found + ' / ' + S.total + '</em>';
  }

  // mando: ↑ ↓ ← → (cruceta o joystick), A acepta, B vuelve
  function padUI() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : [];
    let pd = null; for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { pd = ps[i]; break; }
    if (!pd) return;
    const ax = pd.axes || [], bt = (i) => !!(pd.buttons[i] && pd.buttons[i].pressed);
    const now = { up: bt(12) || ax[1] < -0.6, down: bt(13) || ax[1] > 0.6, left: bt(14) || ax[0] < -0.6, right: bt(15) || ax[0] > 0.6, ok: bt(0), back: bt(1) };
    const prev = S.padPrev || {};
    S.padPrev = now;
    if (performance.now() - S.ui.t0 < 250) return;
    for (const k in now) if (now[k] && !prev[k]) { uiKey(k); return; }
  }

  // ================= Lo que lleva el juego =================
  const Calm = {
    SCENES, Notes,
    // empieza la parada (el mapa ya está cargado): info { scene, seed, step }; o { msg, done }
    begin(sc, player, info, o) {
      this.stop();
      const def = SCENES[info && info.scene];
      const mp = def && G.Maps.get(def.map);
      if (!def || !mp || G.World.layout !== def.map) return false;
      scene = sc;
      ensureUI();
      S = {
        id: info.scene, def, mp, cfg: mp.calm, player, msg: o && o.msg, done: o && o.done, step: info.step || 0,
        rng: U.mulberry32((info.seed || 1) * 7919 + 13),
        group: new THREE.Group(), hints: [], props: [], anims: [], targets: [], near: [], doors: {}, notes: [],
        gains: [], found: 0, total: 0, carry: null, ui: null, lock: null, restUsed: false, exitAsk: 0, t: 0, padPrev: {}
      };
      scene.add(S.group);
      player.carry = null; player.carrySlow = 1;
      def.build();
      S.total = 3 + (S.cfg.lore || []).length;
      player.facing = def.face; if (G.Camera) { G.Camera.yaw = def.face; G.Camera.pitch = 0.06; }
      hud();
      hudEl.className = '';
      setTimeout(() => { if (S && hudEl) hudEl.className = 'compact'; }, 7500);
      document.body.classList.add('calma');
      return true;
    },
    stop() {
      if (!S) return;
      if (S.lock) pickStop(null);
      if (S.ui) { S.ui = null; if (uiRoot) { uiRoot.className = 'hidden'; uiRoot.innerHTML = ''; } }
      for (const q of S.props) { const i = G.Props.list.indexOf(q); if (i >= 0) G.Props.list.splice(i, 1); }
      if (S.player) { S.player.carry = null; S.player.carrySlow = 1; }
      if (scene && S.group) {
        scene.remove(S.group);
        const shared = [matBody, matHull, matGlow, matDark, matFlame];
        S.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material && shared.indexOf(o.material) < 0) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } } });
      }
      if (hudEl) hudEl.className = 'hidden';
      if (fadeEl) fadeEl.classList.remove('on');
      document.body.classList.remove('calma');
      S = null;
    },
    get active() { return !!S; },
    // una pantalla abierta (la nota, el candado, el final): el personaje se queda quieto
    get busy() { return !!(S && S.ui); },
    get carrying() { return S && S.carry ? S.carry.kind : null; },
    get info() { return S ? { scene: S.id, found: S.found, total: S.total, gains: S.gains.slice() } : null; },
    update(dt, player) {
      if (!S) return;
      S.player = player;
      S.t += dt;
      if (S.exitAsk > 0) S.exitAsk -= dt;
      if (S.ui) padUI();
      // los contornos
      for (const h of S.hints) {
        const t = h.t, p = t.g.position, lvOk = (t.lv || 0) === (player.lv || 0);
        const hx = t.cx != null ? t.cx : p.x, hz = t.cz != null ? t.cz : p.z;
        t.hull.visible = lvOk && h.on() && Math.hypot(hx - player.pos.x, hz - player.pos.z) < h.r;
      }
      // lo que llevas encima
      const C = S.carry;
      if (C) {
        const f = player.facing, fx = Math.sin(f), fz = Math.cos(f), rx = Math.cos(f), rz = -Math.sin(f);
        const y = player.y != null ? player.y : gy(player.pos.x, player.pos.z, player.lv);
        if (C.kind === 'escalera') {
          const t = C.t;
          // al hombro derecho, a lo largo: un poco más por delante que por detrás
          t.g.position.set(player.pos.x - rx * 0.28 - fx * (LAD_L * 0.42), y + 1.38, player.pos.z - rz * 0.28 - fz * (LAD_L * 0.42));
          t.g.rotation.set(0, f, 0);
          t.inner.rotation.set(Math.PI / 2 - 0.08, 0, 0); t.inner.position.set(0, 0, 0);
        } else {
          C.t.g.position.set(player.pos.x - rx * 0.3 + fx * 0.05, y + 0.32, player.pos.z - rz * 0.3 + fz * 0.05);
          C.t.g.rotation.set(0, f + Math.PI / 2, 0);
        }
        // (dejarla en el suelo: el objeto delante de ti)
        const dq = S.props.find((q) => q.id === 'drop');
        if (dq) { dq.x = player.pos.x + fx * 0.5; dq.z = player.pos.z + fz * 0.5; }
      }
      // lo que se mueve
      for (let i = S.anims.length - 1; i >= 0; i--) if (!S.anims[i](dt)) S.anims.splice(i, 1);
      // avisos al acercarte
      for (const n of S.near) {
        if (n.done || (player.lv || 0)) continue;
        if (Math.hypot(n.x - player.pos.x, n.z - player.pos.z) < n.r) { n.done = true; n.fn(); }
      }
      pickUpdate(dt);
    },
    // los disparos (y las flechas): ¿le dan a algo de la parada (la cuerda del fardo)? t o -1
    rayT(o, d, t0, t1, lv) {
      if (!S || (lv || 0)) return -1;
      let best = -1;
      S.lastHit = null;
      for (const T of S.targets) {
        if (T.on && !T.on()) continue;
        const t = T.seg ? raySeg(o, d, T.seg[0], T.seg[1], T.r, t0, t1) : raySph(o, d, T.sph, T.r, t0, t1);
        if (t >= 0 && (best < 0 || t < best)) { best = t; S.lastHit = T; }
      }
      return best;
    },
    hit() { if (S && S.lastHit) { const T = S.lastHit; S.lastHit = null; if (!T.on || T.on()) T.hit(); } },
    // puertas atrancadas o cerradas con llave (el botón de la puerta)
    doorLabel(ref, p) {
      const d = S && S.doors[G.World.edgeKey(ref)];
      if (!d || d.open) return null;
      if (d.kind === 'tranca') return inB(d.B, p.pos.x, p.pos.z, 0) ? 'Quitar la tranca' : 'Puerta atrancada';
      return S.lock || S.carry ? 'Cerrada con llave' : 'Forzar la cerradura';
    },
    doorUse(ref, p) {
      const d = S && S.doors[G.World.edgeKey(ref)];
      if (!d || d.open) return null;
      if (d.kind === 'tranca') {
        if (inB(d.B, p.pos.x, p.pos.z, 0)) { unlock(d); return 'Quitas la tranca: la puerta ya se abre'; }
        snd('bang', { x: d.mx, z: d.mz, vol: 0.4 });
        return 'Atrancada por dentro. Tendrás que entrar por otro sitio';
      }
      if (S.carry) return 'Primero suelta lo que llevas';
      return pickStart(p, d);
    },
    // las notas de esta parada y las guardadas (para la mochila)
    notes() {
      const here = S ? S.notes.map((n) => ({ title: n.title, text: n.text, where: 'Esta parada', here: true })) : [];
      return here.concat(Notes.list().map((id) => ({ title: LORE[id].title, text: LORE[id].text, where: LORE[id].where })));
    },
    // (pruebas)
    get dbg() { return S; }
  };

  // ---------- rayos ----------
  function raySeg(o, d, a, b, r, t0, t1) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = o.x - a[0], wy = o.y - a[1], wz = o.z - a[2];
    const B = d.x * ux + d.y * uy + d.z * uz, Cc = ux * ux + uy * uy + uz * uz, D = d.x * wx + d.y * wy + d.z * wz, E = ux * wx + uy * wy + uz * wz;
    const den = Cc - B * B;
    let s = den > 1e-8 ? (E - B * D) / den : 0;
    s = U.clamp(s, 0, 1);
    const t = B * s - D;
    if (t < t0 || t > t1) return -1;
    const px = o.x + d.x * t - (a[0] + ux * s), py = o.y + d.y * t - (a[1] + uy * s), pz = o.z + d.z * t - (a[2] + uz * s);
    return px * px + py * py + pz * pz <= r * r ? t : -1;
  }
  function raySph(o, d, c, r, t0, t1) {
    const wx = o.x - c[0], wy = o.y - c[1], wz = o.z - c[2];
    const b = wx * d.x + wy * d.y + wz * d.z, cc = wx * wx + wy * wy + wz * wz - r * r, h = b * b - cc;
    if (h < 0) return -1;
    const t = -b - Math.sqrt(h);
    return t >= t0 && t <= t1 ? t : -1;
  }

  G.Calm = Calm;
})(window.Game = window.Game || {});
