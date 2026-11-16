/* 煎心鍋貼｜3D 街景（Three.js r149 低多邊形）
 * 由 index.html 在街景區段接近畫面時才載入。
 * 內容：鍋貼店、街道擺設、車流、12 位各具造型與配件的行人（路過／逛看板／排隊進店／從店裡走出）。
 */
window.initStreet3D = function (sec, reduce) {
  const T = THREE;
  const canvas = document.createElement('canvas'); canvas.className = 'street-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const small = innerWidth < 640;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !small; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 2, 0.1, 120);

  /* ---------- 小工具 ---------- */
  const M = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o));
  const B = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o));
  const mesh = (geo, mat, x, y, z, parent) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const cylM = (rt, rb, h, mat, x, y, z, parent, seg) => mesh(new T.CylinderGeometry(rt, rb, h, seg || 10), mat, x, y, z, parent);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = c => { const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const SERIF = '"Noto Serif TC","Songti TC","PMingLiU",serif', SANS = '"Noto Sans TC","Microsoft JhengHei",sans-serif';
  const glowTex = (() => { const c = cv(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return tex(c); })();
  const sprite = (color, size, x, y, z, op, add) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s); return s;
  };
  // 需等字型載入後重繪的文字貼圖
  const redraws = [];
  function textTex(w, h, draw) { const c = cv(w, h), t = tex(c); const f = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; }; f(); redraws.push(f); return t; }

  /* ---------- 燈光 ---------- */
  scene.add(new T.HemisphereLight(0xffd9a8, 0x3a2417, 0.95));
  const sun = new T.DirectionalLight(0xffb070, 0.75); sun.position.set(-6, 9, 9); sun.castShadow = !small;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 9, bottom: -9, near: 1, far: 32 });
  scene.add(sun);
  const shopLight = new T.PointLight(0xffa550, 1.3, 9, 2); shopLight.position.set(-0.8, 1.6, 0.4); scene.add(shopLight);

  /* ---------- 地面：人行道、路緣、馬路、對向人行道 ---------- */
  const tileC = cv(128, 128), tg = tileC.getContext('2d');
  tg.fillStyle = '#5a3a25'; tg.fillRect(0, 0, 128, 128); tg.strokeStyle = 'rgba(255,255,255,.10)'; tg.lineWidth = 3; tg.strokeRect(0, 0, 128, 128);
  const tileT = tex(tileC); tileT.wrapS = tileT.wrapT = T.RepeatWrapping; tileT.repeat.set(36, 3);
  box(60, 0.2, 5.6, M(0xffffff, { map: tileT }), 0, -0.1, 1.6);
  box(60, 0.3, 0.3, M(0x7a5238), 0, -0.05, 4.55);
  box(60, 0.1, 5.4, M(0x2a1d15), 0, -0.2, 7.3);
  for (let x = -28; x < 30; x += 4) box(1.8, 0.02, 0.16, B(0xd9c9a8), x, -0.14, 7.2);
  box(60, 0.3, 8, M(0x3a2417), 0, -0.15, 13.9);
  // 斑馬線
  for (let i = 0; i < 7; i++) box(0.5, 0.02, 5.2, B(0xe6dccb), 11.5 + i * 0.9, -0.14, 7.3);

  /* ---------- 背景建築 ---------- */
  const winC = cv(64, 128), wg = winC.getContext('2d');
  wg.fillStyle = '#000'; wg.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 20) for (let x = 8; x < 56; x += 18) if (Math.random() < .5) { wg.fillStyle = Math.random() < .5 ? '#f3a461' : '#ffd9a0'; wg.fillRect(x, y, 9, 11); }
  const winT = tex(winC);
  [[-13, 4.5, 8, -4, 0x2a1710], [-8.6, 4, 5.4, -3.2, 0x331c12], [-5.7, 3.4, 4.6, -2, 0x3a2417],
   [5.7, 3.4, 5.6, -2, 0x3a2417], [9, 4, 7.4, -4, 0x2a1710], [13.2, 4.6, 6, -3, 0x331c12], [-17, 5, 10, -5, 0x1f120a], [17.5, 5, 11, -5, 0x1f120a]]
    .forEach(([x, w, h, z, col]) => box(w, h, 2.6, M(col, { emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: .7 }), x, h / 2, z - 0.4));

  /* ---------- 鍋貼店 ---------- */
  const SHOP_Z = -0.75;
  box(7, 3.5, 2.5, M(0x3a2417), 0, 1.75, -2.0);
  box(7.4, 0.3, 2.9, M(0x2a1710), 0, 3.65, -2.0);
  box(0.5, 0.9, 0.5, M(0x2a1710), -2.6, 4.2, -2.2);
  const signT = textTex(640, 160, (g, w, h) => {
    g.fillStyle = '#2e1b10'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f3a461'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#faf3e8'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = '900 78px ' + SERIF; g.fillText('煎心鍋貼', 270, 84);
    g.fillStyle = '#f3a461'; g.font = '700 26px ' + SANS; g.fillText('JIAN XIN', 535, 90);
  });
  box(5.2, 1.0, 0.15, M(0xf3a461), 0, 3.0, SHOP_Z + 0.05);
  const sign = new T.Mesh(new T.PlaneGeometry(5, 0.8), B(0xffffff, { map: signT })); sign.position.set(0, 3.0, SHOP_Z + 0.14); scene.add(sign);
  const awC = cv(64, 16), ag = awC.getContext('2d'); ag.fillStyle = '#d9782b'; ag.fillRect(0, 0, 32, 16); ag.fillStyle = '#faf3e8'; ag.fillRect(32, 0, 32, 16);
  const awT = tex(awC); awT.wrapS = T.RepeatWrapping; awT.repeat.set(7, 1); awT.magFilter = T.NearestFilter;
  box(6.4, 0.1, 1.5, M(0xffffff, { map: awT }), 0, 2.45, SHOP_Z + 0.6).rotation.x = 0.28;
  // 櫥窗、櫃檯、蒸籠
  box(3.2, 1.75, 0.08, B(0xf3a461), -1.45, 1.35, SHOP_Z + 0.02);
  box(3.5, 0.12, 0.12, M(0x2e1b10), -1.45, 2.25, SHOP_Z + 0.07); box(3.5, 0.12, 0.12, M(0x2e1b10), -1.45, 0.45, SHOP_Z + 0.07);
  box(0.12, 1.9, 0.12, M(0x2e1b10), -3.2, 1.35, SHOP_Z + 0.07); box(0.12, 1.9, 0.12, M(0x2e1b10), 0.3, 1.35, SHOP_Z + 0.07);
  box(3.5, 0.55, 0.5, M(0x7a5238), -1.45, 0.28, SHOP_Z + 0.5);
  [[-2.65, 2], [-0.25, 3]].forEach(([x, h]) => {
    for (let k = 0; k < h; k++) cylM(0.36, 0.36, 0.18, M(k % 2 ? 0xd9a85f : 0xc9965a), x, 0.65 + k * 0.2, SHOP_Z + 0.5, scene, 12);
    cylM(0.2, 0.38, 0.12, M(0xb98245), x, 0.65 + h * 0.2, SHOP_Z + 0.5, scene, 12);
  });
  // 「營業中」霓虹
  const neonT = textTex(256, 96, (g, w, h) => { g.fillStyle = '#1a0d08'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ff7a59'; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#ffb08a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 44px ' + SERIF; g.fillText('營業中', w / 2, h / 2 - 6); g.font = '700 16px ' + SANS; g.fillText('OPEN', w / 2, h - 18); });
  const neon = new T.Mesh(new T.PlaneGeometry(0.8, 0.3), B(0xffffff, { map: neonT })); neon.position.set(-2.55, 2.0, SHOP_Z + 0.1); scene.add(neon);
  // 門＋門簾
  box(1.5, 2.3, 0.08, B(0x6b3410), 2.1, 1.15, SHOP_Z + 0.02);
  box(1.7, 0.14, 0.14, M(0x2e1b10), 2.1, 2.35, SHOP_Z + 0.07); box(0.14, 2.4, 0.14, M(0x2e1b10), 1.25, 1.2, SHOP_Z + 0.07); box(0.14, 2.4, 0.14, M(0x2e1b10), 2.95, 1.2, SHOP_Z + 0.07);
  const norens = ['煎', '心'].map((ch, i) => {
    const t = textTex(128, 160, (g) => { g.fillStyle = '#faf3e8'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#d9782b'; g.fillRect(0, 140, 128, 20);
      g.fillStyle = '#b95f18'; g.font = '900 96px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 68); });
    const geo = new T.PlaneGeometry(0.72, 0.9); geo.translate(0, -0.45, 0);
    const m = new T.Mesh(geo, M(0xffffff, { map: t, side: T.DoubleSide })); m.position.set(1.74 + i * 0.74, 2.28, SHOP_Z + 0.22); m.castShadow = true; scene.add(m); return m;
  });
  // 燈籠
  const lanterns = [-3.35, 3.35].map(x => {
    box(0.04, 0.5, 0.04, M(0x2e1b10), x, 3.15, SHOP_Z + 0.4);
    const l = new T.Mesh(new T.SphereGeometry(0.24, 12, 10), B(0xff6a3d)); l.scale.set(0.9, 1.2, 0.9); l.position.set(x, 2.75, SHOP_Z + 0.4); scene.add(l);
    return { l, gl: sprite(0xff8a50, 1.6, x, 2.75, SHOP_Z + 0.4, 0.6, true) };
  });
  const steams = Array.from({ length: 9 }, (_, i) => ({ s: sprite(0xffffff, 0.6, 0, 0, 0, 0, false), ph: i / 9, x: [-2.65, -1.45, -0.25][i % 3] }));
  const chim = Array.from({ length: 4 }, (_, i) => ({ s: sprite(0xffffff, 0.8, 0, 0, 0, 0, false), ph: i / 4 }));

  /* ---------- 街道擺設 ---------- */
  // 路燈
  const lampBulbs = [];
  [-8.2, 8.2].forEach(x => {
    cylM(0.06, 0.08, 4.2, M(0x2e1b10), x, 2.1, 4.2, scene, 8);
    box(0.6, 0.06, 0.06, M(0x2e1b10), x + (x < 0 ? 0.3 : -0.3), 4.2, 4.2);
    const bx = x + (x < 0 ? 0.6 : -0.6);
    mesh(new T.SphereGeometry(0.16, 10, 8), B(0xffe0a0), bx, 4.1, 4.2); sprite(0xffcf80, 2.4, bx, 4.1, 4.2, 0.55, true);
  });
  // 彩燈串（店面屋簷 → 路燈）
  const bulbs = [];
  [[-3.5, -8.0], [3.5, 8.0]].forEach(([x0, x1]) => {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new T.Vector3(x0 + (x1 - x0) * t, 3.55 + (4.1 - 3.55) * t - Math.sin(Math.PI * t) * 0.55, 0.5 + (4.2 - 0.5) * t)); }
    scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x1a0d08 })));
    pts.forEach((p, i) => { if (i % 2) { const b = new T.Mesh(new T.SphereGeometry(0.06, 6, 5), B(i % 4 === 1 ? 0xffd9a0 : 0xff9f66)); b.position.copy(p); scene.add(b); bulbs.push(b); } });
  });
  // 行道樹
  [[-6.5, 3.95], [6.9, 3.95]].forEach(([x, z]) => {
    cylM(0.1, 0.15, 2.6, M(0x4a2f1f), x, 1.3, z, scene, 7);
    [[0, 3.0, 0, 0.78], [0.45, 3.4, -0.2, 0.58], [-0.4, 3.3, 0.2, 0.6]].forEach(([dx, dy, dz, r]) => mesh(new T.IcosahedronGeometry(r, 0), M(0x4c6b3a), x + dx, dy, z + dz));
  });
  // 盆栽
  [-3.6, 3.6].forEach(x => { cylM(0.22, 0.17, 0.4, M(0xb95f18), x, 0.2, -0.05, scene, 8); mesh(new T.IcosahedronGeometry(0.3, 0), M(0x4c8a4a), x, 0.65, -0.05); });
  // 回收桶
  [[4.75, 0x2f7d4f], [5.3, 0x2f5f9a]].forEach(([x, col]) => { box(0.46, 0.8, 0.46, M(col), x, 0.4, 0.0); box(0.5, 0.07, 0.5, M(0x222222), x, 0.84, 0.0); });
  // 長椅
  box(1.6, 0.08, 0.45, M(0x8a5a32), -5.4, 0.45, 0.15); box(1.6, 0.5, 0.06, M(0x8a5a32), -5.4, 0.8, -0.05);
  [-0.7, 0.7].forEach(dx => box(0.08, 0.45, 0.4, M(0x2e1b10), -5.4 + dx, 0.22, 0.15));
  // 自動販賣機
  const vmT = textTex(128, 256, (g, w, h) => { g.fillStyle = '#14202c'; g.fillRect(0, 0, w, h); const cols = ['#e0452b', '#f3a461', '#4aa3d9', '#7cc576', '#e8c06a'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = cols[(r * 3 + c) % cols.length]; g.fillRect(12 + c * 38, 14 + r * 44, 30, 36); } g.fillStyle = '#ffd9a0'; g.fillRect(12, 196, 104, 40); });
  box(0.95, 1.85, 0.7, M(0x2a5c8a), -7.1, 0.92, -0.2);
  const vm = new T.Mesh(new T.PlaneGeometry(0.75, 1.5), B(0xffffff, { map: vmT })); vm.position.set(-7.1, 1.05, 0.16); scene.add(vm);
  // 旗幟（鍋貼）
  cylM(0.04, 0.04, 3.4, M(0x2e1b10), -4.15, 1.7, 0.55, scene, 6); box(0.7, 0.04, 0.04, M(0x2e1b10), -3.8, 3.3, 0.55);
  const flagT = textTex(96, 256, (g, w, h) => { g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe8c2'; g.font = '900 64px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('鍋', w / 2, 70); g.fillText('貼', w / 2, 150); g.fillStyle = '#f3a461'; g.fillRect(0, 214, w, 8); });
  const flagGeo = new T.PlaneGeometry(0.55, 1.5, 4, 1); flagGeo.translate(0.275, -0.75, 0);
  const flag = new T.Mesh(flagGeo, M(0xffffff, { map: flagT, side: T.DoubleSide })); flag.position.set(-3.95, 3.28, 0.55); flag.castShadow = true; scene.add(flag);
  // 立牌
  const boardT = textTex(256, 320, (g, w, h) => { g.fillStyle = '#1f2d24'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a5a32'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
    g.fillStyle = '#faf3e8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 46px ' + SERIF; g.fillText('今日現包', w / 2, 70);
    g.font = '700 34px ' + SANS; g.fillText('招牌鍋貼 10 入', w / 2, 140); g.fillStyle = '#f3a461'; g.font = '900 56px ' + SERIF; g.fillText('NT$ 95', w / 2, 215);
    g.fillStyle = '#faf3e8'; g.font = '500 24px ' + SANS; g.fillText('現點現煎・熱騰騰', w / 2, 278); });
  [0, 1].forEach(i => { const p = new T.Mesh(new T.BoxGeometry(0.62, 0.92, 0.04), M(0x6b4a30)); p.position.set(0.75, 0.46, 0.25 + (i ? -0.12 : 0.12)); p.rotation.x = i ? 0.2 : -0.2; p.castShadow = true; scene.add(p); });
  const bp = new T.Mesh(new T.PlaneGeometry(0.54, 0.84), B(0xffffff, { map: boardT })); bp.position.set(0.75, 0.47, 0.25 + 0.12 + 0.03); bp.rotation.x = -0.2; scene.add(bp);
  // 停放的機車
  function makeScooter(col, rider) {
    const g = new T.Group();
    box(1.0, 0.18, 0.3, M(col), 0, 0.42, 0, g); box(0.5, 0.1, 0.32, M(0x222222), -0.15, 0.62, 0, g); box(0.2, 0.55, 0.22, M(col), 0.5, 0.7, 0, g);
    box(0.08, 0.08, 0.6, M(0x222222), 0.52, 1.0, 0, g); box(0.1, 0.12, 0.2, B(0xfff2c0), 0.64, 0.82, 0, g);
    [0.55, -0.5].forEach(x => { const w = cylM(0.22, 0.22, 0.12, M(0x1a1a1a), x, 0.22, 0, g, 12); w.rotation.x = Math.PI / 2; });
    if (rider) {
      box(0.42, 0.55, 0.3, M(0xd9782b), -0.1, 0.98, 0, g);
      const h = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), M(0xf2f2f2)); h.position.set(-0.02, 1.45, 0); h.castShadow = true; g.add(h);
      box(0.4, 0.4, 0.4, M(0xe8742a), -0.7, 0.95, 0, g);
    }
    return g;
  }
  [[-10.5, 0x3a7ca5, 0], [9.6, 0xc0504d, Math.PI], [-4.4, 0x6b6b6b, 0]].forEach(([x, col, ry]) => { const s = makeScooter(col, false); s.position.set(x, 0, 3.95); s.rotation.y = ry; scene.add(s); });
  // 腳踏車（靠樹）
  (function () { const g = new T.Group(); [-0.5, 0.5].forEach(x => { const t = new T.Mesh(new T.TorusGeometry(0.32, 0.03, 6, 14), M(0x222222)); t.position.set(x, 0.35, 0); g.add(t); });
    box(1.0, 0.04, 0.04, M(0x3d8bd9), 0, 0.62, 0, g); box(0.04, 0.4, 0.04, M(0x3d8bd9), -0.15, 0.5, 0, g); box(0.3, 0.04, 0.04, M(0x222222), 0.45, 0.9, 0, g); box(0.2, 0.05, 0.1, M(0x222222), -0.2, 0.85, 0, g);
    g.position.set(7.5, 0, 3.95); scene.add(g); })();

  /* ---------- 車流 ---------- */
  function makeCar(col) {
    const g = new T.Group();
    box(2.4, 0.5, 1.1, M(col), 0, 0.5, 0, g); box(1.3, 0.42, 1.0, M(0x20262e), -0.1, 0.96, 0, g); box(1.2, 0.06, 1.02, M(col), -0.1, 1.2, 0, g);
    [[0.75, 0.55], [0.75, -0.55], [-0.75, 0.55], [-0.75, -0.55]].forEach(([x, z]) => { const w = cylM(0.26, 0.26, 0.18, M(0x151515), x, 0.26, z, g, 12); w.rotation.x = Math.PI / 2; });
    [-0.35, 0.35].forEach(z => { box(0.06, 0.12, 0.22, B(0xfff2c0), 1.2, 0.55, z, g); box(0.06, 0.1, 0.22, B(0xff3b2a), -1.2, 0.55, z, g); });
    return g;
  }
  const CAR_COLORS = [0xd9d4c7, 0x7c8b99, 0xb44a3e, 0x3d5a8c, 0xe8c06a, 0x2f2f33];
  const vehicles = []; let spawnT = 1.5;
  function spawnVehicle() {
    const dir = Math.random() < 0.5 ? 1 : -1, lane = dir > 0 ? 8.2 : 6.2;
    if (vehicles.some(v => v.dir === dir && Math.abs(v.o.position.x - (-dir * 22)) < 6)) return;
    const isScooter = Math.random() < 0.3, o = isScooter ? makeScooter(pick([0x2f2f33, 0x3a7ca5, 0xc0504d]), true) : makeCar(pick(CAR_COLORS));
    o.rotation.y = dir > 0 ? 0 : Math.PI; o.position.set(-dir * 22, 0, lane); scene.add(o);
    const head = sprite(0xfff2c0, 2.2, 0, 0.55, 0, 0.5, true); o.add(head); head.position.set(1.8, 0.55, 0);
    vehicles.push({ o, dir, v: isScooter ? rnd(5.5, 7.5) : rnd(4.5, 7), head });
  }
  function updateVehicles(dt) {
    spawnT -= dt; if (spawnT <= 0) { spawnVehicle(); spawnT = rnd(4, 11); }
    for (let i = vehicles.length - 1; i >= 0; i--) { const v = vehicles[i]; v.o.position.x += v.dir * v.v * dt; if (Math.abs(v.o.position.x) > 24) { scene.remove(v.o); vehicles.splice(i, 1); } }
  }

  /* ---------- 人物 ---------- */
  const SKINS = [0xf6d1b0, 0xe8b48a, 0xc98d62, 0x8d5a3a, 0xffe0c4];
  function makePerson(c) {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const skin = M(SKINS[c.skin]), top = M(c.top), bot = M(c.bot), hair = M(c.hc);
    const male = c.sex === 'm', sx = male ? 1.25 : 1;
    const has = a => c.acc && c.acc.indexOf(a) >= 0;
    const cyl = (rt, rb, h, mat, y, parent) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, 8), mat); m.position.y = y; m.castShadow = true; parent.add(m); return m; };
    const legs = [-1, 1].map(s => {
      const lg = new T.Group(); lg.position.set(s * 0.1, 0.9, 0); body.add(lg);
      const upper = c.out === 'pants' ? 0.84 : c.out === 'shorts' ? 0.4 : 0;
      if (upper) cyl(0.082, 0.072, upper, bot, -upper / 2, lg);
      if (upper < 0.84) cyl(0.066, 0.056, 0.84 - upper, skin, -upper - (0.84 - upper) / 2, lg);
      const shoe = new T.Mesh(new T.BoxGeometry(0.12, 0.07, 0.22), M(c.shoe || (c.sex === 'f' && c.out !== 'pants' ? 0xf0ece4 : 0x2a2a2a))); shoe.position.set(0, -0.87, 0.04); shoe.castShadow = true; lg.add(shoe);
      return lg;
    });
    const torso = new T.Mesh(new T.CapsuleGeometry(0.17, 0.32, 4, 8), top); torso.scale.set(sx, 1, 0.8); torso.position.y = 1.2; torso.castShadow = true; body.add(torso);
    if (c.out === 'skirt') cyl(0.19, 0.31, 0.42, bot, 0.78, body);
    if (c.out === 'dress') cyl(0.19, 0.32, 0.55, top, 0.72, body);
    if (c.staff) { const ap = new T.Mesh(new T.BoxGeometry(0.34, 0.5, 0.03), M(0xfaf3e8)); ap.position.set(0, 1.08, 0.15); body.add(ap); }
    const sh = 0.17 * sx + 0.08;
    const arms = [-1, 1].map(s => {
      const ar = new T.Group(); ar.position.set(s * sh, 1.45, 0); body.add(ar);
      const sl = new T.Mesh(new T.CapsuleGeometry(0.052, 0.28, 3, 6), top); sl.position.y = -0.2; sl.castShadow = true; ar.add(sl);
      const hand = new T.Mesh(new T.SphereGeometry(0.052, 8, 6), skin); hand.position.y = -0.43; ar.add(hand);
      return ar;
    });
    // 外帶袋（右手，出店時才顯示）
    const bag = new T.Group(); bag.position.set(0, -0.5, 0.04); arms[1].add(bag);
    bag.add(new T.Mesh(new T.BoxGeometry(0.13, 0.17, 0.08), M(0xfaf3e8)));
    const bs = new T.Mesh(new T.BoxGeometry(0.135, 0.04, 0.085), M(0xd9782b)); bs.position.y = 0.05; bag.add(bs); bag.visible = false;
    // 頭、臉
    const head = new T.Group(); head.position.y = 1.72; body.add(head);
    const hm = new T.Mesh(new T.SphereGeometry(0.17, 14, 10), skin); hm.castShadow = true; head.add(hm);
    [-1, 1].forEach(s => { const e = new T.Mesh(new T.SphereGeometry(0.02, 6, 6), M(0x111111)); e.position.set(s * 0.06, -0.005, 0.155); head.add(e); });
    const cap = (r, th, mat) => new T.Mesh(new T.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, th), mat);
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; head.add(m); return m; };
    const bx = (w, h, d, mat, x, y, z) => add(new T.Mesh(new T.BoxGeometry(w, h, d), mat), x, y, z);
    switch (c.hair) {
      case 'short': add(cap(0.185, Math.PI * 0.42, hair), 0, 0.01, -0.005); break;
      case 'long': add(cap(0.185, Math.PI * 0.42, hair), 0, 0.01, -0.005); bx(0.36, 0.5, 0.1, hair, 0, -0.24, -0.13); bx(0.05, 0.34, 0.2, hair, -0.18, -0.12, -0.03); bx(0.05, 0.34, 0.2, hair, 0.18, -0.12, -0.03); break;
      case 'ponytail': add(cap(0.185, Math.PI * 0.42, hair), 0, 0.01, -0.005); add(new T.Mesh(new T.SphereGeometry(0.06, 8, 6), hair), 0, 0.02, -0.19); add(new T.Mesh(new T.CapsuleGeometry(0.045, 0.2, 3, 6), hair), 0, -0.14, -0.21); break;
      case 'bun': add(cap(0.185, Math.PI * 0.42, hair), 0, 0.01, -0.005); add(new T.Mesh(new T.SphereGeometry(0.09, 8, 6), hair), 0, 0.2, -0.03); break;
      case 'bob': add(cap(0.19, Math.PI * 0.45, hair), 0, 0.01, -0.005); add(new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.2, 14, 1, true), M(c.hc, { side: T.DoubleSide })), 0, -0.07, -0.02); break;
      case 'curly': add(cap(0.23, Math.PI * 0.5, hair), 0, 0.045, -0.01); break;
      case 'pigtails': add(cap(0.185, Math.PI * 0.42, hair), 0, 0.01, -0.005); add(new T.Mesh(new T.SphereGeometry(0.075, 8, 6), hair), -0.21, -0.02, -0.02); add(new T.Mesh(new T.SphereGeometry(0.075, 8, 6), hair), 0.21, -0.02, -0.02); break;
      case 'cap': add(cap(0.19, Math.PI * 0.45, hair), 0, 0.012, -0.005); bx(0.22, 0.02, 0.15, hair, 0, 0.07, 0.19); break;
      case 'buzz': add(cap(0.178, Math.PI * 0.38, hair), 0, 0.01, -0.005); break;
      default: break;
    }
    // 配件：眼鏡、太陽眼鏡、耳機、口罩、帽子
    if (has('glasses')) { [-1, 1].forEach(s => { const t = new T.Mesh(new T.TorusGeometry(0.036, 0.007, 5, 10), M(0x222222)); add(t, s * 0.06, -0.003, 0.166); }); bx(0.03, 0.008, 0.008, M(0x222222), 0, 0.005, 0.168); }
    if (has('sunglasses')) { [-1, 1].forEach(s => bx(0.07, 0.04, 0.01, M(0x0d0d0d), s * 0.06, -0.003, 0.168)); bx(0.17, 0.01, 0.01, M(0x0d0d0d), 0, 0.01, 0.168); }
    if (has('headphones')) { const hb = new T.Mesh(new T.TorusGeometry(0.19, 0.016, 6, 16, Math.PI), M(0x222222)); add(hb, 0, 0, 0); [-1, 1].forEach(s => { const e = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.05, 10), M(0xd9782b)); e.rotation.z = Math.PI / 2; add(e, s * 0.185, 0, 0); }); }
    if (has('mask')) bx(0.2, 0.09, 0.05, M(0xf2f2f2), 0, -0.075, 0.14);
    if (has('beanie')) { add(cap(0.2, Math.PI * 0.48, M(0xc0504d)), 0, 0.015, -0.005); add(new T.Mesh(new T.SphereGeometry(0.045, 8, 6), M(0xfaf3e8)), 0, 0.2, 0); }
    if (has('sunhat')) { add(cap(0.19, Math.PI * 0.4, M(0xe8d4a0)), 0, 0.05, 0); add(new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 0.015, 18), M(0xe8d4a0)), 0, 0.075, 0); }
    if (c.staff) { add(new T.Mesh(new T.CylinderGeometry(0.14, 0.13, 0.2, 10), M(0xffffff)), 0, 0.24, 0); add(new T.Mesh(new T.SphereGeometry(0.15, 8, 6), M(0xffffff)), 0, 0.36, 0); }
    // 身上配件
    if (has('backpack')) { const b = new T.Mesh(new T.BoxGeometry(0.28, 0.36, 0.14), M(0xd9782b)); b.position.set(0, 1.22, -0.2); b.castShadow = true; body.add(b); }
    if (has('scarf')) { const s = new T.Mesh(new T.TorusGeometry(0.13, 0.045, 6, 12), M(0xc0504d)); s.rotation.x = Math.PI / 2; s.position.y = 1.55; body.add(s); }
    if (has('tote')) { const t = new T.Mesh(new T.BoxGeometry(0.07, 0.32, 0.28), M(0xe8d4a0)); t.position.set(-(sh + 0.04), 0.98, 0.0); body.add(t); const st = new T.Mesh(new T.BoxGeometry(0.02, 0.5, 0.02), M(0xc9b27c)); st.position.set(-(sh + 0.02), 1.3, 0); body.add(st); }
    if (has('handbag')) { const hbag = new T.Mesh(new T.BoxGeometry(0.2, 0.15, 0.07), M(0x8e4a3a)); hbag.position.set(0, -0.55, 0.05); arms[0].add(hbag); }
    if (has('umbrella')) { const u = new T.Group(); u.position.set(0, -0.43, 0.02); arms[0].add(u);
      const sf = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.9, 5), M(0x222222)); sf.position.y = -0.4; u.add(sf);
      const cn = new T.Mesh(new T.CylinderGeometry(0.01, 0.05, 0.55, 8), M(0x2d3e6b)); cn.position.y = 0.2; u.add(cn); }
    let phone = null;
    if (has('phone')) { phone = new T.Mesh(new T.BoxGeometry(0.05, 0.1, 0.012), B(0xbfe4ff)); phone.position.set(0, -0.47, 0.05); arms[1].add(phone); }
    g.scale.setScalar(c.h);
    return { g, body, legs, arms, bag, head, phone: !!phone };
  }

  const CAST = [
    { sex: 'f', hair: 'long',     hc: 0x1b1210, skin: 0, top: 0xfaf3e8, bot: 0x3d5a8c, out: 'skirt', acc: ['backpack', 'glasses'], h: 1 },
    { sex: 'm', hair: 'short',    hc: 0x1b1210, skin: 1, top: 0x2f4f7f, bot: 0x555a63, out: 'pants', acc: ['phone', 'headphones'], h: 1.03 },
    { sex: 'f', hair: 'ponytail', hc: 0x6b3a1f, skin: 4, top: 0xc0504d, bot: 0xc0504d, out: 'dress', acc: ['sunglasses', 'handbag'], h: 0.98 },
    { sex: 'm', hair: 'curly',    hc: 0x151010, skin: 3, top: 0x4f8a5b, bot: 0xc2a878, out: 'shorts', acc: ['headphones'], h: 1.05 },
    { sex: 'f', hair: 'bun',      hc: 0xcfcfcf, skin: 0, top: 0x8a8f4a, bot: 0x5a3a25, out: 'skirt', acc: ['tote', 'glasses'], h: 0.93 },
    { sex: 'm', hair: 'cap',      hc: 0xd9782b, skin: 2, top: 0xe8c06a, bot: 0x3b5f8f, out: 'pants', acc: ['backpack', 'mask'], h: 1 },
    { sex: 'f', hair: 'bob',      hc: 0xe8c06a, skin: 4, top: 0x8e6bb8, bot: 0xf0ece4, out: 'pants', acc: ['phone', 'beanie'], h: 0.99 },
    { sex: 'm', hair: 'bald',     hc: 0x000000, skin: 2, top: 0x1f1f24, bot: 0x2e2e36, out: 'pants', acc: ['scarf', 'umbrella', 'sunglasses'], h: 1.06 },
    { sex: 'f', hair: 'pigtails', hc: 0x3a2417, skin: 1, top: 0xf48fb1, bot: 0x6fa8dc, out: 'shorts', acc: [], h: 0.72 },
    { sex: 'm', hair: 'short',    hc: 0x6b3a1f, skin: 0, top: 0x3d8bd9, bot: 0xd8d2c4, out: 'shorts', acc: ['backpack'], h: 0.7 },
    { sex: 'f', hair: 'long',     hc: 0x7a4a2a, skin: 2, top: 0x7fcdbb, bot: 0x3d5a8c, out: 'pants', acc: ['tote', 'sunhat'], h: 1.0 },
    { sex: 'm', hair: 'short',    hc: 0xbdbdbd, skin: 1, top: 0xc8b799, bot: 0x6b4a30, out: 'pants', acc: ['scarf', 'glasses', 'umbrella'], h: 0.97 },
    { sex: 'f', hair: 'ponytail', hc: 0x151010, skin: 1, top: 0xe8742a, bot: 0x2e2e36, out: 'pants', acc: ['mask', 'headphones'], h: 1.0 },
    { sex: 'm', hair: 'buzz',     hc: 0x1b1210, skin: 3, top: 0xb0463a, bot: 0x4a5a3a, out: 'pants', acc: ['phone', 'tote'], h: 1.02 }
  ];

  // 店員（櫃檯後方）
  const staff = makePerson({ sex: 'm', hair: 'short', hc: 0x1b1210, skin: 1, top: 0xfaf3e8, bot: 0x2e2e36, out: 'pants', acc: [], h: 1, staff: true });
  staff.g.position.set(-1.45, 0, SHOP_Z + 0.15); scene.add(staff.g);

  /* ---------- 行人行為 ---------- */
  const DOOR_X = 2.1, FRONT_Z = -0.62, EDGE = 15, SIGN_X = 0.75;
  const BAND = { right: [2.5, 3.3], left: [1.0, 1.9] };   // 向右走靠近馬路、向左走靠近店面，避免迎面重疊
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const queue = []; let browserBusy = false;
  const agents = CAST.map((c, i) => {
    const p = makePerson(c); scene.add(p.g); p.g.visible = false;
    return { c, p, base: (c.h < 0.8 ? 0.85 : 1.0) + (i % 5) * 0.1 + rnd(0, 0.08), v: 0, phase: Math.random() * 6, wps: [], wait: rnd(0, 10), inside: false,
             rot: 0, state: 'wait', idleT: 0, queueing: false, atDoor: false, browser: false, sway: Math.random() * 6 };
  });
  const doorFree = () => !agents.some(o => o.atDoor);
  const laneFor = dir => { const b = dir > 0 ? BAND.right : BAND.left; return rnd(b[0], b[1]); };
  const place = (a, x, z) => a.p.g.position.set(x, 0, z);
  function plan(a) {
    a.p.g.visible = true; a.state = 'walk'; a.v = 0;
    if (a.inside) {                                             // 從店裡走出，提著外帶袋
      a.inside = false; const dir = Math.random() < .5 ? 1 : -1;
      place(a, DOOR_X, FRONT_Z - 0.2); a.rot = 0; a.p.g.rotation.y = 0; a.atDoor = true; a.p.bag.visible = !a.p.phone;
      a.wps = [{ x: DOOR_X, z: 0.7, exit: true }, { x: dir * EDGE, z: laneFor(dir), lane: true }];
      return;
    }
    const dir = Math.random() < .5 ? 1 : -1, z = laneFor(dir); a.p.bag.visible = false;
    place(a, -dir * EDGE, z); a.rot = dir > 0 ? Math.PI / 2 : -Math.PI / 2; a.p.g.rotation.y = a.rot; a.v = a.base;
    const r = Math.random();
    if (r < 0.34 && queue.length < 2) { a.queueing = true; queue.push(a); a.wps = []; }          // 排隊進店
    else if (r < 0.5 && !browserBusy) { browserBusy = true; a.browser = true;                       // 在立牌前看菜單
      a.wps = [{ x: SIGN_X, z: 1.15, wait: rnd(3, 5.5), face: Math.PI, browse: true }, { x: dir * EDGE, z: laneFor(dir), lane: true }]; }
    else a.wps = [{ x: dir * EDGE, z, lane: true }];
  }
  function hide(a) { a.p.g.visible = false; a.state = 'wait'; a.atDoor = false; a.v = 0; }

  function updateAgent(a, dt, t) {
    const g = a.p.g, P = g.position;
    if (a.state === 'wait') {
      a.wait -= dt;
      if (a.wait <= 0) { if (a.inside && !doorFree()) { a.wait = 0.4; return; } plan(a); }
      return;
    }
    let tx, tz, w = null, moving = true, faceTo = null;
    if (a.queueing) { const idx = queue.indexOf(a); tx = DOOR_X; tz = 1.65 + idx * 0.85; }
    else { w = a.wps[0]; tx = w.x; tz = w.z; }
    let dx = tx - P.x, dz = tz - P.z; const dist = Math.hypot(dx, dz) || 1e-6;

    if (a.queueing) {
      if (dist < 0.15) { moving = false; faceTo = Math.PI; if (queue[0] === a && doorFree()) { queue.shift(); a.queueing = false; a.atDoor = true; a.wps = [{ x: DOOR_X, z: FRONT_Z, enter: true }]; } }
    } else if (a.state === 'idle') {
      moving = false; faceTo = w.face; a.idleT -= dt;
      if (a.idleT <= 0) { a.wps.shift(); a.state = 'walk'; if (w.browse) { browserBusy = false; a.browser = false; } }
    } else if (dist < 0.14) {
      if (w.wait) { a.state = 'idle'; a.idleT = w.wait; moving = false; }
      else {
        a.wps.shift();
        if (w.exit) a.atDoor = false;
        if (w.enter) { hide(a); a.inside = true; a.wait = rnd(4, 9); return; }
        if (!a.wps.length) { hide(a); a.wait = rnd(1, 6); return; }
        w = a.wps[0]; dx = w.x - P.x; dz = w.z - P.z;
      }
    }

    // 與鄰近行人保持距離：側閃，前方有人時放慢
    let sx = 0, sz = 0, slow = 1; const fx = Math.sin(a.rot), fz = Math.cos(a.rot);
    for (let i = 0; i < agents.length; i++) {
      const o = agents[i]; if (o === a || !o.p.g.visible) continue;
      const ox = P.x - o.p.g.position.x, oz = P.z - o.p.g.position.z, d = Math.hypot(ox, oz);
      if (d < 1.0 && d > 1e-4) {
        const k = (1.0 - d) / 1.0; sx += ox / d * k; sz += oz / d * k;
        const ahead = (-ox * fx - oz * fz) / d, lat = Math.abs(-ox * fz + oz * fx);
        if (ahead > 0.4 && lat < 0.55 && d < 1.5) slow = Math.min(slow, Math.max(0.08, (d - 0.5) / 1.0));
      }
    }
    const nd = Math.hypot(dx, dz) || 1e-6;
    let vx = dx / nd, vz = dz / nd;
    if (w && w.lane) vz += clamp((w.z - P.z) * 0.9, -0.6, 0.6);   // 回到自己的行走線
    vx += sx * 1.7; vz += sz * 1.7;
    let want = Math.atan2(vx, vz) + (w && w.lane ? Math.sin(t * 0.8 + a.sway) * 0.05 : 0);
    if (faceTo != null) want = faceTo;
    const diff = angDiff(a.rot, want);
    a.rot += clamp(diff, -5.5 * dt, 5.5 * dt); g.rotation.y = a.rot;
    const target = moving ? a.base * slow * (Math.abs(diff) < 0.9 ? 1 : 0.2) : 0;
    a.v += (target - a.v) * Math.min(1, 3.2 * dt);
    if (a.v > 0.02) { P.x += Math.sin(a.rot) * a.v * dt; P.z += Math.cos(a.rot) * a.v * dt; }

    // 動作：步幅與速度成正比；停下時肢體回正
    const p = a.p, mv = a.v / a.base;
    a.phase += a.v * dt * 5.2;
    const sw = Math.sin(a.phase) * 0.6 * Math.min(1, mv);
    if (mv > 0.05) {
      p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
      p.arms[0].rotation.x = -sw * 0.8; p.arms[1].rotation.x = p.phone ? -1.25 : sw * 0.8;
    } else {
      p.legs[0].rotation.x *= 0.8; p.legs[1].rotation.x *= 0.8; p.arms[0].rotation.x *= 0.85;
      p.arms[1].rotation.x = p.phone ? -1.25 : p.arms[1].rotation.x * 0.85;
    }
    p.body.position.y = Math.abs(Math.cos(a.phase)) * 0.035 * Math.min(1, mv);
    p.body.rotation.z = Math.sin(a.phase) * 0.025 * Math.min(1, mv);
    p.head.rotation.x = p.phone ? 0.35 : (a.state === 'idle' ? Math.sin(t * 1.5 + a.sway) * 0.08 - 0.05 : 0);
    if (!a.queueing && a.state !== 'idle') { if (a.wps[0] && a.wps[0].enter) a.atDoor = true; }
  }

  /* ---------- 視角、視差、尺寸 ---------- */
  const base = new T.Vector3(0, 2.6, 13), look = new T.Vector3(0, 1.4, 0), par = { x: 0, y: 0, tx: 0, ty: 0 };
  function resize() {
    const w = sec.clientWidth, h = sec.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const D = camera.aspect < 1.8 ? Math.max(15, 21 / camera.aspect) : Math.max(13, 32 / camera.aspect); base.set(0, 2.1 + D * 0.05, D);
    camera.updateProjectionMatrix();
  }
  addEventListener('pointermove', e => { par.tx = e.clientX / innerWidth - 0.5; par.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(sec); else addEventListener('resize', resize);

  /* ---------- 迴圈 ---------- */
  let time = 0;
  const flagPos = flagGeo.attributes.position, flagBase = Array.from(flagPos.array);
  function animateDecor(t) {
    norens.forEach((n, i) => { n.rotation.z = Math.sin(t * 1.6 + i) * 0.04; });
    lanterns.forEach((o, i) => { const k = 0.85 + Math.sin(t * 2.2 + i * 1.7) * 0.15; o.gl.material.opacity = 0.5 * k; o.gl.scale.setScalar(1.5 * k); });
    steams.forEach(o => { const p = (t / 4.5 + o.ph) % 1; o.s.position.set(o.x + Math.sin(p * 6 + o.ph * 9) * 0.12, 1.1 + p * 1.6, SHOP_Z + 0.5); o.s.scale.setScalar(0.4 + p * 0.9); o.s.material.opacity = Math.sin(p * Math.PI) * 0.35; });
    chim.forEach(o => { const p = (t / 6 + o.ph) % 1; o.s.position.set(-2.6 + Math.sin(p * 5) * 0.2 + p * 0.6, 4.7 + p * 2.2, -2.2); o.s.scale.setScalar(0.6 + p * 1.4); o.s.material.opacity = Math.sin(p * Math.PI) * 0.3; });
    bulbs.forEach((b, i) => b.scale.setScalar(0.85 + Math.sin(t * 3 + i * 1.3) * 0.25));
    neon.material.color.setScalar(0.75 + (Math.sin(t * 1.8) > 0.85 ? -0.35 : 0.25));
    for (let i = 0; i < flagPos.count; i++) { const x = flagBase[i * 3]; flagPos.setZ(i, Math.sin(t * 3 + x * 5) * 0.06 * (x / 0.55)); }
    flagPos.needsUpdate = true;
    // 店員包鍋貼
    staff.arms[0].rotation.x = -0.9 + Math.sin(t * 5) * 0.28; staff.arms[1].rotation.x = -0.9 + Math.sin(t * 5 + 2.2) * 0.28;
    staff.head.rotation.x = 0.25 + Math.sin(t * 1.3) * 0.05; staff.body.position.y = Math.sin(t * 2.5) * 0.008;
  }
  // 最後保險：任何兩人若仍太近，直接各退一半，確保不會重疊穿模
  function resolveOverlaps() {
    for (let i = 0; i < agents.length; i++) {
      const A = agents[i].p.g; if (!A.visible) continue;
      for (let j = i + 1; j < agents.length; j++) {
        const B = agents[j].p.g; if (!B.visible) continue;
        let dx = A.position.x - B.position.x, dz = A.position.z - B.position.z; const d = Math.hypot(dx, dz);
        if (d < 0.55) { if (d < 1e-4) { dx = 0; dz = 1; } const k = (0.55 - Math.max(d, 1e-4)) / 2 / Math.max(d, 1e-4);
          const nx = (d < 1e-4 ? 0 : dx) * k, nz = (d < 1e-4 ? 0.28 : dz * k * 1.4);
          A.position.x += nx; A.position.z += nz; B.position.x -= nx; B.position.z -= nz; }
      }
    }
  }
  function step(dt) { time += dt; agents.forEach(a => updateAgent(a, dt, time)); resolveOverlaps(); updateVehicles(dt); animateDecor(time); }
  function render() {
    par.x += (par.tx - par.x) * 0.05; par.y += (par.ty - par.y) * 0.05;
    camera.position.set(base.x + par.x * 1.6, base.y - par.y * 0.5, base.z); camera.lookAt(look);
    renderer.render(scene, camera);
  }
  sec.__street3d = { agents, step, queue };   // 供測試

  resize();
  for (let i = 0; i < 200; i++) step(0.1);       // 預先模擬 20 秒，載入時街上已有人車
  sec.appendChild(canvas); render(); sec.classList.add('is-3d');
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('900 78px "Noto Serif TC"', '煎心鍋貼鍋貼今日現包'), new Promise(r => setTimeout(r, 2500))]).then(() => { redraws.forEach(f => f()); render(); });

  if (reduce) { addEventListener('resize', render); return; }
  let last = performance.now(), vis = true;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(sec);
  (function frame(now) {
    requestAnimationFrame(frame);
    if (!vis || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); render();
  })(last);
};
