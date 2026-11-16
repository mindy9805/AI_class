/**
 * 煎心鍋貼｜線上結帳 → Google Sheet 後端（Google Apps Script）
 * 功能：寫入訂單、伺服器端重算金額、防濫用、客人確認信、店家通知、狀態下拉選單、每日營收摘要
 * 部署方式請見 gas/README.md
 */

/* ===================== 設定（部署前請修改） ===================== */
const CONFIG = {
  SHOP_EMAIL: 'your-shop@example.com',     // 店家收件信箱（新訂單通知＋每日摘要）
  SHOP_NAME: '煎心鍋貼 JIAN XIN',
  SHEET_NAME: '訂單',
  TIMEZONE: 'Asia/Taipei',
  FREE_SHIP: 1000,                           // 宅配滿額免運
  SHIP_FEE: 80,
  DAILY_SUMMARY_HOUR: 22,                    // 每日摘要寄送時間（24 小時制，台北時間）
  MIN_FILL_MS: 3000,                         // 填表少於 3 秒視為機器人
  RATE_LIMIT_SEC: 20,                        // 同一手機兩筆訂單最短間隔
  MAX_LINE_QTY: 30, MAX_LINES: 25
};

/* 商品價格表（以伺服器端為準；需與網站 MENU / GIFTS 一致） */
const PRICES = {
  p1: { name: '招牌豬肉鍋貼', price: 95 },
  p2: { name: '高麗菜鮮肉鍋貼', price: 90 },
  p3: { name: '韭黃鮮蝦鍋貼', price: 130 },
  p4: { name: '酸菜白肉鍋貼', price: 100 },
  p5: { name: '川辣牛肉鍋貼', price: 120 },
  p6: { name: '玉米起司鍋貼', price: 105 },
  d1: { name: '鮮肉水餃', price: 90 },
  d2: { name: '三鮮水餃', price: 110 },
  d3: { name: '韭菜豬肉水餃', price: 95 },
  d4: { name: '紅油抄手', price: 85 },
  d5: { name: '翡翠素水餃', price: 85 },
  s1: { name: '酸辣湯', price: 60 },
  s2: { name: '玉米濃湯', price: 55 },
  s3: { name: '蛋花湯', price: 40 },
  s4: { name: '古早味紅茶', price: 30 },
  s5: { name: '無糖冷泡綠茶', price: 30 },
  c1: { name: '涼拌小黃瓜', price: 50 },
  c2: { name: '蒜泥白肉', price: 120 },
  c3: { name: '皮蛋豆腐', price: 60 },
  c4: { name: '滷味拼盤', price: 80 },
  g1: { name: '招牌招財鍋貼禮盒', price: 890 },
  g2: { name: '家庭歡聚水餃禮盒', price: 780 },
  g3: { name: '雙享鍋貼水餃禮盒', price: 720 }
};

const ORDER_TYPES = ['內用', '外帶', '宅配'];
const STATUSES = ['待處理', '製作中', '已完成', '已取消'];
const HEADERS = ['訂單編號', '建立時間', '狀態', '姓名', '手機', 'Email', '取餐方式', '門市／地址', '備註',
                 '商品明細', '件數', '小計', '運費', '總額', '預計時間', '商品JSON'];
const COL = HEADERS.reduce((o, h, i) => (o[h] = i + 1, o), {});

/* ===================== Web App 入口 ===================== */
function doGet() { return json_({ ok: true, service: CONFIG.SHOP_NAME, time: new Date().toISOString() }); }

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const cache = CacheService.getScriptCache();

    // 1) 防重複送出：相同 reqId 直接回傳先前結果
    if (body.reqId && /^[\w-]{8,64}$/.test(body.reqId)) {
      const prev = cache.get('req:' + body.reqId);
      if (prev) return json_(JSON.parse(prev));
    }

    // 2) 防機器人：蜜罐欄位、填表時間
    if (body.website) return json_({ ok: false, error: '送出失敗，請稍後再試。' });
    if (!(Number(body.fillMs) >= CONFIG.MIN_FILL_MS)) return json_({ ok: false, error: '送出太快了，請稍候再試一次。' });

    const v = validate_(body);
    if (!v.ok) return json_(v);
    const o = v.order;

    // 3) 頻率限制（同手機）
    const rk = 'rate:' + o.phone;
    if (cache.get(rk)) return json_({ ok: false, error: '您剛剛已送出訂單，請稍候再試。' });

    // 4) 寫入（鎖定避免同時寫入造成編號重複）
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let orderNo;
    try {
      const sh = getSheet_();
      orderNo = nextOrderNo_(sh);
      sh.appendRow([orderNo, new Date(), '待處理', o.name, "'" + o.phone, o.email, o.type, o.type === '宅配' ? o.address : o.store,
                    o.note, o.itemsText, o.count, o.subtotal, o.ship, o.total, o.eta, JSON.stringify(o.lines)]);
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }

    cache.put(rk, '1', CONFIG.RATE_LIMIT_SEC);
    const res = { ok: true, orderNo, subtotal: o.subtotal, ship: o.ship, total: o.total, eta: o.eta, type: o.type };
    if (body.reqId) cache.put('req:' + body.reqId, JSON.stringify(res), 600);

    // 5) 寄信（失敗不影響訂單）
    try { sendCustomerMail_(orderNo, o); } catch (err) { console.error('客人信寄送失敗', err); }
    try { sendShopMail_(orderNo, o); } catch (err) { console.error('店家信寄送失敗', err); }
    return json_(res);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: '系統忙碌中，請稍後再試。' });
  }
}

/* ===================== 驗證與金額重算（純函式，可單獨測試） ===================== */
function validate_(b) {
  const str = (x, max) => String(x == null ? '' : x).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  const name = str(b.name, 30), phone = str(b.phone, 10), email = str(b.email, 100), note = str(b.note, 200);
  const type = str(b.orderType, 4), store = str(b.store, 80), address = str(b.address, 120);

  if (!name) return fail_('請填寫姓名');
  if (!/^09\d{8}$/.test(phone)) return fail_('手機號碼格式不正確');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail_('Email 格式不正確');
  if (ORDER_TYPES.indexOf(type) < 0) return fail_('取餐方式不正確');
  if (type === '宅配' && address.length < 6) return fail_('請填寫完整配送地址');
  if (type !== '宅配' && !store) return fail_('請選擇取餐門市');

  const raw = Array.isArray(b.items) ? b.items : [];
  if (!raw.length || raw.length > CONFIG.MAX_LINES) return fail_('購物車內容不正確');
  const merged = {};
  for (const it of raw) {
    const id = str(it && it.id, 8), qty = Math.floor(Number(it && it.qty));
    if (!PRICES[id]) return fail_('含有不存在的商品，請重新整理頁面');
    if (!(qty >= 1)) return fail_('商品數量不正確');
    merged[id] = (merged[id] || 0) + qty;
  }
  const lines = Object.keys(merged).map(id => ({ id, qty: merged[id] }));
  if (lines.some(l => l.qty > CONFIG.MAX_LINE_QTY)) return fail_('單一商品數量過多，請來電洽詢');

  const subtotal = lines.reduce((s, l) => s + PRICES[l.id].price * l.qty, 0);
  const ship = type === '宅配' && subtotal < CONFIG.FREE_SHIP ? CONFIG.SHIP_FEE : 0;
  const eta = type === '內用' ? '到店即可入座' : type === '外帶' ? '約 15–20 分鐘' : '約 1–3 個工作天';
  return { ok: true, order: {
    name, phone, email, note, type, store, address, lines, subtotal, ship, total: subtotal + ship, eta,
    count: lines.reduce((s, l) => s + l.qty, 0),
    itemsText: lines.map(l => PRICES[l.id].name + ' ×' + l.qty).join('\n')
  } };
}
function fail_(msg) { return { ok: false, error: msg }; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ===================== 試算表 ===================== */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(CONFIG.SHEET_NAME); formatSheet_(sh); }
  return sh;
}
function nextOrderNo_(sh) {
  const prefix = 'JX' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyMMdd');
  const last = sh.getLastRow();
  let seq = 1;
  if (last > 1) {
    const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
    const today = ids.filter(id => id.indexOf(prefix) === 0).map(id => Number(id.slice(prefix.length)) || 0);
    if (today.length) seq = Math.max.apply(null, today) + 1;
  }
  return prefix + ('000' + seq).slice(-4);
}

/** 初始化：建立標題列、狀態下拉選單、狀態上色、欄寬與每日摘要觸發器。第一次部署時手動執行一次。 */
function setup() {
  const sh = getSheet_(); formatSheet_(sh);
  installTriggers();
  SpreadsheetApp.getActiveSpreadsheet().toast('初始化完成：訂單表與每日摘要觸發器已建立');
}
function formatSheet_(sh) {
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#4a2f1f').setFontColor('#faf3e8');
  sh.setFrozenRows(1);
  [130, 150, 80, 90, 110, 200, 80, 220, 160, 260, 60, 80, 70, 90, 110, 60].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sh.getRange('E:E').setNumberFormat('@');
  sh.getRange('J:J').setWrap(true);
  sh.getRange('L:N').setNumberFormat('#,##0');
  sh.hideColumns(COL['商品JSON']);
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sh.getRange(2, COL['狀態'], rows, 1).setDataValidation(rule);
  const rng = [sh.getRange(2, 1, rows, HEADERS.length)];
  const colorRule = (status, bg) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C2="' + status + '"').setBackground(bg).setRanges(rng).build();
  sh.setConditionalFormatRules([colorRule('待處理', '#fff3cd'), colorRule('製作中', '#cfe2ff'), colorRule('已完成', '#d1e7dd'), colorRule('已取消', '#e2e3e5')]);
}

/* ===================== 通知信 ===================== */
const esc_ = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money_ = n => 'NT$ ' + Number(n).toLocaleString('en-US');

function itemsRows_(o) {
  return o.lines.map(l => '<tr><td style="padding:6px 0">' + esc_(PRICES[l.id].name) + ' ×' + l.qty + '</td><td align="right">' + money_(PRICES[l.id].price * l.qty) + '</td></tr>').join('');
}
function mailShell_(title, inner) {
  return '<div style="font-family:Arial,\'Microsoft JhengHei\',sans-serif;max-width:520px;margin:auto;color:#3b2616">' +
    '<div style="background:#4a2f1f;color:#faf3e8;padding:18px 24px;border-radius:12px 12px 0 0;font-size:18px;font-weight:bold">' + esc_(CONFIG.SHOP_NAME) + '</div>' +
    '<div style="background:#faf3e8;padding:24px;border-radius:0 0 12px 12px"><h2 style="margin:0 0 12px">' + title + '</h2>' + inner + '</div></div>';
}
function sendCustomerMail_(orderNo, o) {
  const where = o.type === '宅配' ? '配送地址：' + esc_(o.address) : '取餐門市：' + esc_(o.store);
  const html = mailShell_('訂單已成立，感謝您的訂購！',
    '<p>' + esc_(o.name) + ' 您好，我們已收到您的訂單。</p>' +
    '<p><b>訂單編號：' + orderNo + '</b><br>取餐方式：' + o.type + '<br>' + where + '<br>預計時間：' + o.eta + '</p>' +
    '<table width="100%" style="border-top:1px solid #d9c7ad;border-bottom:1px solid #d9c7ad;margin:12px 0">' + itemsRows_(o) + '</table>' +
    '<p style="text-align:right;margin:0">小計 ' + money_(o.subtotal) + '　運費 ' + money_(o.ship) + '<br><b style="font-size:18px;color:#b95f18">應付總額 ' + money_(o.total) + '</b></p>' +
    (o.note ? '<p>備註：' + esc_(o.note) + '</p>' : '') +
    '<p style="font-size:12px;color:#7a5238">如需修改或取消，請來電客服 02-2700-1234 並告知訂單編號。</p>');
  MailApp.sendEmail({ to: o.email, subject: '【' + CONFIG.SHOP_NAME + '】訂單確認 ' + orderNo, htmlBody: html, name: CONFIG.SHOP_NAME });
}
function sendShopMail_(orderNo, o) {
  const html = mailShell_('新訂單 ' + orderNo,
    '<p><b>' + o.type + '</b>｜' + esc_(o.name) + '｜' + esc_(o.phone) + '<br>' + esc_(o.email) + '<br>' + (o.type === '宅配' ? esc_(o.address) : esc_(o.store)) + '</p>' +
    '<table width="100%" style="border-top:1px solid #d9c7ad;border-bottom:1px solid #d9c7ad">' + itemsRows_(o) + '</table>' +
    '<p style="text-align:right"><b style="font-size:18px">總額 ' + money_(o.total) + '</b></p>' + (o.note ? '<p>備註：' + esc_(o.note) + '</p>' : '') +
    '<p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">開啟訂單試算表</a></p>');
  MailApp.sendEmail({ to: CONFIG.SHOP_EMAIL, subject: '【新訂單】' + orderNo + '｜' + o.type + '｜' + money_(o.total), htmlBody: html, name: CONFIG.SHOP_NAME });
}

/* ===================== 每日營收摘要 ===================== */
function installTriggers() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendDailySummary').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDailySummary').timeBased().atHour(CONFIG.DAILY_SUMMARY_HOUR).everyDays(1).inTimezone(CONFIG.TIMEZONE).create();
}
function sendDailySummary() {
  const sh = getSheet_(), last = sh.getLastRow();
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
  const todays = rows.filter(r => r[COL['建立時間'] - 1] instanceof Date &&
    Utilities.formatDate(r[COL['建立時間'] - 1], CONFIG.TIMEZONE, 'yyyy-MM-dd') === today);
  const valid = todays.filter(r => r[COL['狀態'] - 1] !== '已取消');
  const revenue = valid.reduce((s, r) => s + Number(r[COL['總額'] - 1] || 0), 0);
  const byType = {}, byItem = {};
  valid.forEach(r => {
    const t = r[COL['取餐方式'] - 1]; byType[t] = (byType[t] || 0) + 1;
    try { JSON.parse(r[COL['商品JSON'] - 1]).forEach(l => { const n = PRICES[l.id] ? PRICES[l.id].name : l.id; byItem[n] = (byItem[n] || 0) + l.qty; }); } catch (e) {}
  });
  const top = Object.keys(byItem).sort((a, b) => byItem[b] - byItem[a]).slice(0, 5);
  const pending = todays.filter(r => r[COL['狀態'] - 1] === '待處理').length;
  const html = mailShell_(today + ' 營收摘要',
    '<p>有效訂單：<b>' + valid.length + '</b> 筆（取消 ' + (todays.length - valid.length) + ' 筆）<br>營收：<b style="font-size:20px;color:#b95f18">' + money_(revenue) + '</b>' +
    (valid.length ? '<br>客單價：' + money_(Math.round(revenue / valid.length)) : '') + '</p>' +
    '<p>取餐方式：' + (Object.keys(byType).map(k => k + ' ' + byType[k]).join('、') || '—') + '</p>' +
    '<p>熱銷 Top 5：<br>' + (top.map((n, i) => (i + 1) + '. ' + esc_(n) + ' ×' + byItem[n]).join('<br>') || '—') + '</p>' +
    (pending ? '<p style="color:#c0392b">⚠ 仍有 ' + pending + ' 筆「待處理」訂單。</p>' : ''));
  MailApp.sendEmail({ to: CONFIG.SHOP_EMAIL, subject: '【每日摘要】' + today + '｜' + valid.length + ' 筆｜' + money_(revenue), htmlBody: html, name: CONFIG.SHOP_NAME });
}
