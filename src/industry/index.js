'use strict';
// 行业模块：洗车（澈蓝洗车工坊 · 示例门店）
//   车辆档案（车牌 + 车型）→ 按车型计价 → 预约时段（每个时段最多 3 台）或现场排队取号（A001…，预计等待按工位估算）
//   工单进度：车辆到店（取号排队）→ 安排工位开工（自动分配空闲工位）→ 完工（次卡自动核销 1 次）
//   次卡：普洗十次卡 / 精洗五次卡，到店开卡，完工自动核销，前台可手动核销
const { AppError, toHm } = require('../lib/util');
const PROV = '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼'.split('');
const TYPES = [['sedan', '轿车'], ['suv', 'SUV'], ['mpv', 'MPV/7座']];
const TYPE_NAME = Object.fromEntries(TYPES);
const pj = v => { try { return JSON.parse(v || '{}') || {}; } catch { return {}; } };
const now = () => Date.now();

function bays(repo) { return repo.listResources().filter(r => r.kind === 'bay' && r.active); }
/** 工位占用：施工中的单 → 工位 */
function busyBays(live) { const m = new Map(); for (const b of live) if (b.status === 'arrived' && b.progress === 'washing' && b.assignee_id) m.set(b.assignee_id, b); return m; }

const IND = {
  slug: 'carwash', brand: '澈蓝洗车工坊', codePrefix: 'CL', dbName: 'carwash.db', defaultIcon: 'drop',
  features: ['vehicles', 'type-pricing', 'walk-in-queue', 'bays', 'count-cards', 'progress'],
  accounts: { owner: 'chelan2026', staff: '洗车技师（演示）', staff2: '前台小陈（演示）' },
  terms: { resource: '工位', assignee: '工位', profile: '车辆', storePay: '到店支付', service: '服务', booking: '预约洗车' },
  resourceMode: 'none', resourceKind: 'bay', assignKind: 'bay', assignNoOverlap: true,
  durations: [20, 30, 40, 60, 90, 120],
  rules: {
    review: { tagsPos: ['洗得干净', '速度快', '细节到位', '不用排队', '服务热情', '价格实惠'], tagsNeg: ['等待太久', '没洗干净', '有水渍', '价格偏高'] },
    feedback: { types: ['功能建议', '服务投诉', '排队问题', '预约问题', '其他'] },
  },
  profile: {
    kind: 'car', label: '车辆', max: 5,
    validate(b) {
      const prov = PROV.includes(b.prov) ? b.prov : null; if (!prov) throw new AppError(400, 'BAD_INPUT', '请选择车牌省份');
      const num = String(b.num || '').toUpperCase().replace(/[\s·.-]/g, '');
      if (!/^[A-HJ-NP-Z][A-HJ-NP-Z0-9]{5,6}$/.test(num)) throw new AppError(400, 'BAD_PLATE', '车牌格式不正确（字母开头，共 6–7 位，不含 I/O）');
      const type = TYPE_NAME[b.type] ? b.type : null; if (!type) throw new AppError(400, 'BAD_INPUT', '请选择车型');
      return { prov, num, type, plate: prov + num };
    },
    unique: d => d.plate,
  },
  steps: [
    { key: 'waiting', label: '排队中', action: '车辆到店', status: 'arrived' },
    { key: 'washing', label: '施工中', action: '安排工位开工', status: 'arrived', start: true },
    { key: 'done', label: '已完成', action: '完工', status: 'done', notify: b => `爱车（${pj(b.extra).profile ? pj(b.extra).profile.plate : ''}）已完工，可以来取车啦～（${b.code}）` },
  ],
  arriveProgress: 'waiting', walkProgress: 'waiting',
  queue: {
    prefix: () => 'A',
    board(ctx, live, d) {
      const B = bays(ctx.repo), busy = busyBays(live), t = now();
      const serving = live.filter(b => b.status === 'arrived' && b.progress === 'washing');
      const waiting = live.filter(b => b.status === 'arrived' && b.progress === 'waiting').sort((a, b) => (a.queue_no || 'Z').localeCompare(b.queue_no || 'Z') || a.arrived_at - b.arrived_at);
      // 预计等待：每个工位的空闲时刻（施工中按 开工 + 时长 估算），排队车辆依次占用最早空闲的工位
      const free = B.map(r => { const w = busy.get(r.id); return w ? Math.max((w.started_at || t) + w.duration_min * 60000, t + 60000) : t; });
      for (const w of waiting) { free.sort((a, b) => a - b); w.eta = Math.max(0, Math.round((free[0] - t) / 60000)); free[0] = Math.max(free[0], t) + w.duration_min * 60000; }
      free.sort((a, b) => a - b);
      const mask = p => (p ? p.slice(0, 3) + '•••' + p.slice(-2) : '');
      const bayView = B.map(r => { const w = busy.get(r.id); if (!w) return { id: r.id, name: r.name, free: true };
        const used = Math.max(0, (t - (w.started_at || t)) / 60000), pct = Math.min(96, Math.max(4, Math.round(used / w.duration_min * 100)));
        return { id: r.id, name: r.name, free: false, serviceName: w.service_name, plate: mask((pj(w.extra).profile || {}).plate), left: Math.max(1, Math.round(w.duration_min - used)), pct }; });
      return { groups: [{ key: 'all', name: '全店', serving, waiting }], summary: { bays: bayView, ahead: waiting.length, eta: B.length ? Math.max(0, Math.round((free[0] - t) / 60000)) : null } };
    },
  },
  onStep(ctx, b, nx, f) {
    const { repo } = ctx;
    if (nx.key === 'waiting') {
      if (b.date !== require('../lib/util').today()) throw new AppError(409, 'NOT_TODAY', '非今日预约，到店当天再操作');
      if (!b.queue_no) f.queue_no = repo.nextQueueNo(b.date, 'A');
    }
    if (nx.key === 'washing') {
      const busy = busyBays(repo.liveOn(b.date)), B = bays(repo);
      let bay = b.assignee_id && !busy.has(b.assignee_id) ? b.assignee_id : null;
      if (!bay) { const fb = B.find(r => !busy.has(r.id)); if (!fb) throw new AppError(409, 'BAYS_FULL', `${B.length} 个工位都在施工，请稍候`); bay = fb.id; }
      f.assignee_id = bay;
    }
  },
  canAssign(ctx, b, a) {
    const w = busyBays(ctx.repo.liveOn(b.date)).get(a.id);
    if (w && w.id !== b.id) return `${a.name}正在施工（${w.service_name}）`;
    if (b.progress === 'washing') return '已在施工中';
    return null;
  },
  validatePricing(pr) {
    const out = {};
    for (const [k] of TYPES) { const v = pr && pr[k]; if (!Number.isInteger(+v) || +v < 0 || +v > 9999) throw new AppError(400, 'BAD_INPUT', '三种车型价格需为 0–9999 的整数'); out[k] = +v; }
    return out;
  },
  pricingBase: pr => ({ price: Math.min(...Object.values(pr)) }),
  publicInfo: () => ({ prov: PROV, types: TYPES }),
  plan(ctx, svc, cust, input, P) {
    if (!cust) return P;
    const car = ctx.ext.ownProfile(cust, input.profileId), pr = pj(svc.pricing);
    const price = pr[car.type] != null ? pr[car.type] : svc.price_cents / 100;
    return { ...P, price_cents: Math.round(price * 100), lines: [{ label: `${svc.name}（${TYPE_NAME[car.type]}）`, amount: price }], profile_id: car.id,
      extra: { profile: { plate: car.plate, prov: car.prov, num: car.num, type: car.type, typeName: TYPE_NAME[car.type] } } };
  },
  dto(b, o) { if (o.assigneeName && o.progress === 'washing') o.bay = o.assigneeName; },
  dashboard(ctx) {
    const d = require('../lib/util').today(), live = ctx.repo.liveOn(d), n = bays(ctx.repo).length;
    return { tiles: [{ k: '排队中', v: live.filter(b => b.status === 'arrived' && b.progress === 'waiting').length }, { k: '工位占用', v: live.filter(b => b.status === 'arrived' && b.progress === 'washing').length + '/' + n }] };
  },
  seed(h) {
    const { repo, d, U } = h;
    repo.upsertShop({ name: '澈蓝洗车工坊', phone: '0755-0000-0000', address: 'XX市XX区XX路 88 号（示例地址）', open_min: 480, close_min: 1200, step_min: 30, book_days: 7, lead_min: 30, capacity: 3 });
    const SV = [
      { name: '普洗', img: 'c1_basic', descr: '外观泡沫冲洗 · 轮毂清洁 · 擦干', pr: { sedan: 35, suv: 45, mpv: 55 }, dur: 20, icon: 'drop', color: 4 },
      { name: '精洗', img: 'c2_fine', descr: '普洗 + 内饰吸尘 · 仪表台擦拭 · 玻璃', pr: { sedan: 68, suv: 88, mpv: 98 }, dur: 40, icon: 'drop', color: 3, hot: 1 },
      { name: '打蜡', img: 'c3_wax', descr: '精洗 + 手工打蜡 · 镀膜养护', pr: { sedan: 128, suv: 158, mpv: 188 }, dur: 60, icon: 'gem', color: 1 },
      { name: '内饰清洁', img: 'c4_interior', descr: '座椅深度清洁 · 顶棚 · 地毯 · 除味', pr: { sedan: 168, suv: 198, mpv: 238 }, dur: 90, icon: 'leaf', color: 2, dep: 30 },
    ];
    const S = SV.map((s, i) => ({ ...s, id: repo.insertService({ name: s.name, descr: s.descr, price_cents: Math.min(...Object.values(s.pr)) * 100, duration_min: s.dur, icon: s.icon, color: s.color, hot: s.hot || 0, sort: i,
      deposit_on: s.dep ? 1 : 0, deposit_cents: (s.dep || 30) * 100, images: JSON.stringify(h.img(s.img)), pricing: s.pr }) }));
    const BAY = [1, 2, 3].map(i => repo.insertResource({ kind: 'bay', name: i + ' 号工位', letter: String(i), sort: i, start_min: 480, end_min: 1200, seed: 1 }));
    const P1 = repo.insertCardProduct({ name: '普洗十次卡', kind: 'count', scope: 'service', service_id: S[0].id, price_cents: 29800, times: 10, sort: 1 });
    const P2 = repo.insertCardProduct({ name: '精洗五次卡', kind: 'count', scope: 'service', service_id: S[1].id, price_cents: 36800, times: 5, sort: 2 });
    const car = (phone, name, prov, num, type) => ({ id: repo.insertProfile({ customer_id: h.cust(phone, name), kind: 'car', data: JSON.stringify({ prov, num, type, plate: prov + num }), seed: 1 }), phone, name, plate: prov + num, prov, num, type });
    const C = {
      me1: car('13812345678', '演示车主', '粤', 'B6K2Q8', 'suv'), me2: null,
      wang: car('13600003333', '王先生', '粤', 'B8K21A', 'sedan'), li: car('13500004444', '李女士', '粤', 'BX7Q30', 'suv'),
      zhao: car('13400005555', '赵先生', '湘', 'A5C9M2', 'sedan'), liu: car('13900001111', '刘先生', '粤', 'BD20661', 'mpv'),
      zhang: car('13700002222', '张女士', '粤', 'B3N7P5', 'sedan'), sun: car('13300006666', '孙先生', '粤', 'BL0937', 'suv'),
      zhou: car('13200007777', '周女士', '粤', 'BQ5521', 'sedan'),
    };
    C.me2 = car('13812345678', '演示车主', '粤', 'BD1234', 'sedan');
    const cid = p => repo.getCustomerByPhone(p).id;
    const card = (c, prod, name, sid, total, remain, daysAgo) => {
      const id = repo.insertCard({ customer_id: cid(c.phone), product_id: prod, name, kind: 'count', scope: 'service', service_id: sid, total, remain, seed: 1, created_at: Date.now() - daysAgo * 864e5 });
      repo.addLedger({ card_id: id, customer_id: cid(c.phone), kind: 'open', times: total, amount_cents: prod === P1 ? 29800 : 36800, note: name, actor: 'owner', seed: 1, at: Date.now() - daysAgo * 864e5 });
      return id;
    };
    const K = { me: card(C.me1, P1, '普洗十次卡', S[0].id, 10, 7, 20), liu: card(C.liu, P2, '精洗五次卡', S[1].id, 5, 2, 30), zhang: card(C.zhang, P1, '普洗十次卡', S[0].id, 10, 9, 2) };
    for (const [i, ago] of [[1, 14], [2, 7]]) repo.addLedger({ card_id: K.me, customer_id: cid(C.me1.phone), kind: 'manual', times: -1, note: '前台手动核销 1 次（示例）', actor: 'staff', seed: 1, at: Date.now() - ago * 864e5 });
    for (const ago of [25, 12, 5]) repo.addLedger({ card_id: K.liu, customer_id: cid(C.liu.phone), kind: 'manual', times: -1, note: '前台手动核销 1 次（示例）', actor: 'staff', seed: 1, at: Date.now() - ago * 864e5 });
    const mk = (c, si, date, hm, status, o = {}) => {
      const s = S[si], price = s.pr[c.type];
      return h.bk({ svc: { id: s.id, name: s.name }, price, dur: s.dur, date, hm, phone: c.phone, name: c.name, status, profile_id: c.id,
        extra: { profile: { plate: c.plate, prov: c.prov, num: c.num, type: c.type, typeName: TYPE_NAME[c.type] }, lines: [{ label: `${s.name}（${TYPE_NAME[c.type]}）`, amount: price }] }, ...o });
    };
    // 过去：已完成 + 评价
    const done = [mk(C.wang, 1, d(-2), '10:00', 'done', { progress: 'done', assignee_id: BAY[0] }), mk(C.li, 2, d(-3), '14:00', 'done', { progress: 'done', assignee_id: BAY[1] }),
      mk(C.zhang, 0, d(-5), '09:00', 'done', { progress: 'done', assignee_id: BAY[2] }), mk(C.sun, 1, d(-6), '16:30', 'done', { progress: 'done', assignee_id: BAY[0] }),
      mk(C.liu, 3, d(-8), '13:00', 'done', { progress: 'done', assignee_id: BAY[1] }), mk(C.me1, 0, d(-3), '10:00', 'done', { progress: 'done', assignee_id: BAY[2], pay_method: 'card', card_id: K.me })];
    repo.addLedger({ card_id: K.me, customer_id: cid(C.me1.phone), kind: 'use', times: -1, booking_id: done[5], note: '普洗', actor: 'staff', seed: 1, at: Date.now() - 3 * 864e5 });
    h.reviews(done, [
      [5, ['洗得干净', '速度快'], '预约后到店直接开工，40 分钟就好了，内饰吸得很干净。', 'c2_fine', '感谢支持～欢迎下次再来！'],
      [5, ['细节到位'], '打蜡很均匀，轮毂缝隙也擦到了。', 'c3_wax', null],
      [4, ['价格实惠'], '次卡很划算，周末人稍微多一点。', null, '周末建议提前预约时段，免排队～'],
      [5, ['不用排队', '服务热情'], '', null, null],
      [3, ['等待太久'], '内饰清洁效果不错，但比预计多等了 20 分钟。', null, '抱歉久等！已优化排班，下次到店赠送一次普洗。'],
      [5, ['洗得干净'], '普洗也很仔细，用次卡很方便。', null, null],
    ]);
    // 今天：两台施工中、两台排队、两台已完成（按当前时间生成）
    const t0 = Math.min(Math.max(480, h.nowMin), 1140), td = d(0), st = m => Math.min(Math.max(480, Math.floor(m / 10) * 10), 1140);
    const opt = f => { try { return f(); } catch (e) { if (!String(e.message).includes('SLOT_TAKEN')) throw e; } };
    const ago = m => Date.now() - m * 60000;
    mk(C.wang, 1, td, st(t0 - 15), 'arrived', { kind: 'walk', queue_no: 'A003', progress: 'washing', assignee_id: BAY[0], arrived_at: ago(25), started_at: ago(15) });
    opt(() => mk(C.li, 2, td, st(t0 - 30), 'arrived', { progress: 'washing', assignee_id: BAY[1], queue_no: 'A004', arrived_at: ago(35), started_at: ago(30) }));
    mk(C.zhao, 0, td, st(t0), 'arrived', { kind: 'walk', queue_no: 'A005', progress: 'waiting', arrived_at: ago(8) });
    mk(C.liu, 1, td, st(t0), 'arrived', { kind: 'walk', queue_no: 'A006', progress: 'waiting', arrived_at: ago(4), pay_method: 'card', card_id: K.liu });
    const z = mk(C.zhang, 0, td, 480, 'done', { kind: 'walk', queue_no: 'A001', progress: 'done', assignee_id: BAY[2], pay_method: 'card', card_id: K.zhang, arrived_at: ago(120), started_at: ago(110) });
    repo.addLedger({ card_id: K.zhang, customer_id: cid(C.zhang.phone), kind: 'use', times: -1, booking_id: z, note: '普洗', actor: 'staff', seed: 1, at: ago(90) });
    mk(C.sun, 1, td, 510, 'done', { kind: 'walk', queue_no: 'A002', progress: 'done', assignee_id: BAY[0], arrived_at: ago(100), started_at: ago(95) });
    // 明天：两单预约；后天一单待确认
    mk(C.li, 3, d(1), '14:00', 'confirmed'); mk(C.zhang, 1, d(1), '10:00', 'confirmed'); mk(C.sun, 2, d(2), '15:00', 'pending');
    // 爽约示例：周女士 90 天内爽约 2 次 → 默认规则下被限制
    mk(C.zhou, 0, d(-20), '11:00', 'no_show', { noshow_by: 'manual' }); mk(C.zhou, 1, d(-9), '15:00', 'no_show', { noshow_by: 'manual' });
    h.feedback('13300006666', '功能建议', '希望能在小程序里看到工位实时进度。', 5, true, '已上线首页「工位看板」（示例）');
    h.feedback('13500004444', '排队问题', '周末排队的车有点多，建议多开一个工位。', 1, false);
  },
};
module.exports = IND;
