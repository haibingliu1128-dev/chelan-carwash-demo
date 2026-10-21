'use strict';
// 洗车行业功能测试：车辆档案、按车型计价、现场排队取号、工位分配、次卡开卡/核销、权限与打码
const { test, before, after } = require('node:test');
const { harness } = require('./helpers');
const H = harness(), { assert, D, api, login, newPhone } = H;
let OWNER, STAFF, shop0;
before(async () => { await H.start(); ({ OWNER, STAFF } = H); shop0 = H.R.getShop(); });
after(() => H.stop());
let pn = 0;
const num = () => 'C' + String(Date.now() % 1e4).padStart(4, '0') + 'ABCDEFGHJKLMNPQRSTUVWXYZ'[pn++ % 24];
const car = (tok, type, n) => api('POST', '/api/me/profiles', { prov: '粤', num: n || num(), type: type || 'sedan' }, tok);
/** 让现场取号在任何时刻都可用（测试可能在夜间运行） */
const openAllDay = () => H.R.upsertShop({ ...shop0, open_min: 0, close_min: 1440 });
const restoreHours = () => H.R.upsertShop(shop0);
const today = () => require('../src/lib/util').today();
const live = () => H.R.liveOn(today());
/** 结束今天所有进行中的工单，让测试从空工位开始 */
const clearToday = () => { for (const b of live()) if (b.status === 'arrived' || b.status === 'confirmed') H.R.updateBooking(b.id, { status: 'cancelled' }); };

test('车辆档案：省份/车牌/车型校验、车牌统一大写、同一车牌不可重复、最多 5 辆、仅本人可见', async () => {
  const tok = await login(newPhone()), other = await login(newPhone());
  for (const [b, code] of [[{ prov: 'X', num: 'B12345', type: 'sedan' }, 'BAD_INPUT'], [{ prov: '粤', num: 'I12345', type: 'sedan' }, 'BAD_PLATE'], [{ prov: '粤', num: '123456', type: 'sedan' }, 'BAD_PLATE'],
    [{ prov: '粤', num: 'B1234', type: 'sedan' }, 'BAD_PLATE'], [{ prov: '粤', num: 'B12345', type: 'truck' }, 'BAD_INPUT']]) {
    const r = await api('POST', '/api/me/profiles', b, tok); assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(r.body.error.code, code);
  }
  const ev = await api('POST', '/api/me/profiles', { prov: '粤', num: 'b d12345', type: 'suv' }, tok);
  assert.equal(ev.status, 201, JSON.stringify(ev.body)); assert.equal(ev.body.plate, '粤BD12345'); assert.equal(ev.body.type, 'suv');
  assert.equal((await api('POST', '/api/me/profiles', { prov: '粤', num: 'BD12345', type: 'sedan' }, tok)).body.error.code, 'DUPLICATE');
  for (let i = 0; i < 4; i++) assert.equal((await car(tok)).status, 201);
  assert.equal((await car(tok)).body.error.code, 'TOO_MANY');
  assert.equal((await api('GET', '/api/me/profiles', null, other)).body.length, 0);
  assert.equal((await api('PUT', '/api/me/profiles/' + ev.body.id, { prov: '粤', num: 'BD12345', type: 'mpv' }, other)).status, 404);
  assert.equal((await api('PUT', '/api/me/profiles/' + ev.body.id, { prov: '粤', num: 'BD12345', type: 'mpv' }, tok)).body.type, 'mpv');
  assert.equal((await api('POST', '/api/bookings', { serviceId: 1, date: D(3), time: '10:00', name: '测试' }, tok)).status, 400, '必须选择车辆');
  const info = (await api('GET', '/api/shop')).body.industry;
  assert.ok(info.prov.includes('粤') && info.types.length === 3);
});

test('按车型计价：同一服务轿车/SUV/MPV 不同价，订单保存车辆快照；改价后基础价 = 最低价；校验与权限', async () => {
  const tok = await login(newPhone());
  const s = (await car(tok, 'sedan')).body, u = (await car(tok, 'suv')).body, m = (await car(tok, 'mpv')).body;
  const q = async (sid, p) => (await api('POST', '/api/quote', { serviceId: sid, profileId: p.id, date: D(3), time: '10:00' }, tok)).body;
  assert.equal((await q(2, s)).price, 68); assert.equal((await q(2, u)).price, 88); assert.equal((await q(2, m)).price, 98);
  assert.match((await q(3, u)).lines[0].label, /打蜡（SUV）/);
  const b = await api('POST', '/api/bookings', { serviceId: 2, profileId: u.id, date: D(3), time: '10:00', name: '测试' }, tok);
  assert.equal(b.status, 201, JSON.stringify(b.body)); assert.equal(b.body.booking.price, 88);
  assert.equal(b.body.booking.extra.profile.plate, u.plate); assert.equal(b.body.booking.extra.profile.typeName, 'SUV');
  await api('PUT', '/api/me/profiles/' + u.id, { prov: '粤', num: u.num, type: 'sedan' }, tok);
  assert.equal((await api('GET', '/api/me/bookings', null, tok)).body.find(x => x.id === b.body.booking.id).extra.profile.type, 'suv', '改档案不影响历史订单');
  assert.equal((await api('PUT', '/api/merchant/services/1', { pricing: { sedan: 30, suv: 'x', mpv: 50 } }, OWNER)).status, 400);
  assert.equal((await api('PUT', '/api/merchant/services/1', { pricing: { sedan: 40, suv: 50, mpv: 60 } }, STAFF)).status, 403);
  const r = await api('PUT', '/api/merchant/services/1', { pricing: { sedan: 39, suv: 49, mpv: 59 } }, OWNER);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.price, 39); assert.deepEqual(r.body.pricing, { sedan: 39, suv: 49, mpv: 59 });
  assert.equal((await q(1, m)).price, 59);
  await api('PUT', '/api/merchant/services/1', { pricing: { sedan: 35, suv: 45, mpv: 55 } }, OWNER);
});

test('现场排队：取号 A00x、公开看板车牌打码不含手机号、预计等待按工位估算；营业时间外不能取号', async () => {
  clearToday(); openAllDay();
  try {
    const p1 = newPhone(), t1 = await login(p1, '排队甲'), t2 = await login(newPhone(), '排队乙');
    const c1 = (await car(t1, 'sedan')).body, c2 = (await car(t2, 'suv')).body;
    const a = await api('POST', '/api/queue', { serviceId: 2, profileId: c1.id, name: '排队甲' }, t1);
    assert.equal(a.status, 201, JSON.stringify(a.body));
    const b = await api('POST', '/api/queue', { serviceId: 1, profileId: c2.id, name: '排队乙' }, t2);
    const ba = a.body.booking, bb = b.body.booking;
    assert.equal(ba.kind, 'walk'); assert.equal(ba.status, 'arrived'); assert.equal(ba.progress, 'waiting'); assert.equal(ba.price, 68); assert.equal(bb.price, 45);
    assert.match(ba.queueNo, /^A\d{3}$/); assert.ok(bb.queueNo > ba.queueNo, '号码递增');
    const pub = await api('GET', '/api/queue', null, t1);
    assert.equal(pub.status, 200); const txt = JSON.stringify(pub.body);
    assert.ok(!txt.includes(p1), '公开看板不含手机号'); assert.ok(!txt.includes(c1.plate), '车牌打码');
    const w = pub.body.groups[0].waiting; assert.equal(w.length, 2);
    assert.equal(w[0].mine, true); assert.equal(w[1].mine, false); assert.match(w[0].plate, /•••/);
    assert.equal(pub.body.summary.bays.length, 3); assert.ok(pub.body.summary.bays.every(x => x.free));
    assert.equal(w[0].eta, 0, '有空闲工位无需等待'); assert.equal(pub.body.summary.ahead, 2);
    // 开工后：3 个工位里 2 个在施工，第 3 台排队仍可立即开工；再来 2 台时第 2 台需要等待
    await api('POST', `/api/merchant/bookings/${ba.id}/next`, null, STAFF);
    await api('POST', `/api/merchant/bookings/${bb.id}/next`, null, STAFF);
    const t3 = await login(newPhone()), t4 = await login(newPhone());
    await api('POST', '/api/queue', { serviceId: 1, profileId: (await car(t3)).body.id, name: '丙' }, t3);
    await api('POST', '/api/queue', { serviceId: 1, profileId: (await car(t4)).body.id, name: '丁' }, t4);
    const p2 = (await api('GET', '/api/queue')).body;
    assert.equal(p2.summary.bays.filter(x => !x.free).length, 2); assert.equal(p2.groups[0].waiting[0].eta, 0);
    assert.ok(p2.groups[0].waiting[1].eta >= 15 && p2.groups[0].waiting[1].eta <= 20, '第二台等最早完工的工位（普洗 20 分钟）: ' + p2.groups[0].waiting[1].eta);
    const busy = p2.summary.bays.find(x => !x.free); assert.ok(busy.plate.includes('•••') && busy.left > 0 && busy.pct > 0);
    // 顾客可取消尚未开工的排队；已开工的不能取消
    assert.equal((await api('POST', `/api/bookings/${ba.id}/cancel`, null, t1)).status, 409);
  } finally { restoreHours(); }
  H.R.upsertShop({ ...shop0, open_min: 0, close_min: 1 });
  try {
    const t = await login(newPhone());
    const r = await api('POST', '/api/queue', { serviceId: 1, profileId: (await car(t)).body.id, name: '晚到' }, t);
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'QUEUE_CLOSED');
  } finally { restoreHours(); }
});

test('工单进度：到店领号 → 开工自动分配空闲工位（满了提示 BAYS_FULL）→ 完工发取车短信；非今日不能到店', async () => {
  clearToday(); openAllDay();
  try {
    const ids = [];
    for (let i = 0; i < 4; i++) { const t = await login(newPhone()); ids.push((await api('POST', '/api/queue', { serviceId: 1, profileId: (await car(t)).body.id, name: '工单' + i }, t)).body.booking.id); }
    const bays = new Set();
    for (let i = 0; i < 3; i++) {
      const r = await api('POST', `/api/merchant/bookings/${ids[i]}/next`, null, STAFF);
      assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.booking.progress, 'washing'); assert.ok(r.body.booking.bay); bays.add(r.body.booking.assigneeId);
    }
    assert.equal(bays.size, 3, '三台车分到三个不同工位');
    const full = await api('POST', `/api/merchant/bookings/${ids[3]}/next`, null, STAFF);
    assert.equal(full.status, 409); assert.equal(full.body.error.code, 'BAYS_FULL');
    const dash = (await api('GET', '/api/merchant/dashboard', null, OWNER)).body.industry.tiles;
    assert.deepEqual(dash.map(x => x.k), ['排队中', '工位占用']); assert.equal(dash[0].v, 1); assert.equal(dash[1].v, '3/3');
    const done = await api('POST', `/api/merchant/bookings/${ids[0]}/next`, null, STAFF);
    assert.equal(done.body.booking.status, 'done');
    const box = (await api('GET', '/api/dev/sms-outbox')).body;
    assert.ok(JSON.stringify(box).includes('可以来取车'), '完工短信');
    const st = await api('POST', `/api/merchant/bookings/${ids[3]}/next`, null, STAFF);
    assert.equal(st.status, 200, JSON.stringify(st.body)); assert.equal(st.body.booking.assigneeId, done.body.booking.assigneeId, '接手刚空出的工位');
    // 预约单：今天的预约到店后领号；明天的不能提前到店
    const t = await login(newPhone()), cid = (await car(t)).body.id;
    const fut = await api('POST', '/api/bookings', { serviceId: 1, profileId: cid, date: D(1), time: '10:00', name: '预约' }, t);
    assert.equal(fut.status, 201, JSON.stringify(fut.body));
    if (fut.body.booking.status === 'pending') await api('POST', `/api/merchant/bookings/${fut.body.booking.id}/accept`, null, STAFF);
    assert.equal((await api('POST', `/api/merchant/bookings/${fut.body.booking.id}/next`, null, STAFF)).status, 409);
    const bk = H.R.getBooking(fut.body.booking.id);
    H.R.updateBooking(bk.id, { date: today(), start_at: Date.now() + 20 * 60000 });
    const ar = await api('POST', `/api/merchant/bookings/${bk.id}/next`, null, STAFF);
    assert.equal(ar.status, 200, JSON.stringify(ar.body)); assert.equal(ar.body.booking.progress, 'waiting'); assert.match(ar.body.booking.queueNo, /^A\d{3}$/);
  } finally { restoreHours(); }
});

test('次卡：开卡（需处理预约权限）、下单选次卡抵扣、完工自动核销 1 次、前台手动核销、卡种范围、记录', async () => {
  clearToday(); openAllDay();
  try {
    const phone = newPhone(), tok = await login(phone, '次卡测试'), cid = (await car(tok)).body.id;
    assert.equal((await api('POST', '/api/merchant/cards', { phone: '123', productId: 1 }, OWNER)).body.error.code, 'BAD_PHONE');
    await H.grant({ 'booking.handle': false });
    assert.equal((await api('POST', '/api/merchant/cards', { phone, productId: 1 }, STAFF)).status, 403);
    await H.grant({ 'booking.handle': true });
    const k = await api('POST', '/api/merchant/cards', { phone, name: '次卡测试', productId: 1 }, STAFF);
    assert.equal(k.status, 201, JSON.stringify(k.body)); assert.equal(k.body.remain, 10);
    const k2 = (await api('POST', '/api/merchant/cards', { phone, productId: 2 }, OWNER)).body;
    // 精洗五次卡不能用于普洗
    const bad = await api('POST', '/api/queue', { serviceId: 1, profileId: cid, name: '次卡测试', payMethod: 'card', cardId: k2.id }, tok);
    assert.equal(bad.status, 409); assert.equal(bad.body.error.code, 'CARD_UNUSABLE');
    const w = await api('POST', '/api/queue', { serviceId: 1, profileId: cid, name: '次卡测试', payMethod: 'card', cardId: k.body.id }, tok);
    assert.equal(w.status, 201, JSON.stringify(w.body)); assert.equal(w.body.booking.payMethod, 'card');
    let mine = (await api('GET', '/api/me/cards', null, tok)).body.cards.find(x => x.id === k.body.id);
    assert.equal(mine.remain, 10); assert.equal(mine.pending, 1);
    await api('POST', `/api/merchant/bookings/${w.body.booking.id}/next`, null, STAFF);
    await api('POST', `/api/merchant/bookings/${w.body.booking.id}/next`, null, STAFF);
    mine = (await api('GET', '/api/me/cards', null, tok)).body.cards.find(x => x.id === k.body.id);
    assert.equal(mine.remain, 9, '完工自动核销'); assert.equal(mine.pending, 0);
    assert.equal((await api('POST', `/api/merchant/cards/${k.body.id}/use`, { times: 11 }, STAFF)).status, 400);
    const u = await api('POST', `/api/merchant/cards/${k.body.id}/use`, { times: 1, note: '前台手动核销' }, STAFF);
    assert.equal(u.status, 200, JSON.stringify(u.body));
    const det = (await api('GET', `/api/merchant/cards/${k.body.id}`, null, STAFF)).body;
    assert.equal(det.card.remain, 8); assert.deepEqual(det.ledger.map(l => l.kind).sort(), ['manual', 'open', 'use']);
    await H.grant({ 'booking.handle': false });
    assert.equal((await api('POST', `/api/merchant/cards/${k.body.id}/use`, { times: 1 }, STAFF)).status, 403);
    await H.grant({ 'booking.handle': true });
    // 店员看次卡列表与开卡记录时手机号打码
    const list = (await api('GET', '/api/merchant/cards', null, STAFF)).body.cards.find(x => x.id === k.body.id);
    assert.match(list.phone, H.MASK); assert.equal(list.cname, '次卡测试');
    assert.ok(!JSON.stringify((await api('GET', '/api/merchant/queue', null, STAFF)).body).includes(phone));
    const seed = (await api('GET', '/api/merchant/cards', null, OWNER)).body;
    assert.ok(seed.cards.some(x => x.seed) && seed.products.length === 2);
  } finally { restoreHours(); }
});
