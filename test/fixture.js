'use strict';
// 行业测试夹具：洗车（core.test.js 通过它下单）
const cars = new Map();
let seq = 0;
function plate() { seq++; return 'T' + String(Date.now() % 1e4).padStart(4, '0') + 'ABCDEFGHJKLMNPQRSTUVWXYZ'[seq % 24]; }
async function carFor(H, tok, type) {
  const k = tok + (type || 'sedan'); if (cars.has(k)) return cars.get(k);
  const r = await H.api('POST', '/api/me/profiles', { prov: '粤', num: plate(), type: type || 'sedan' }, tok);
  if (r.status !== 201) throw new Error('建档失败 ' + JSON.stringify(r.body));
  cars.set(k, r.body.id); return r.body.id;
}
module.exports = {
  slug: 'carwash', brand: '澈蓝洗车工坊', ownerPassword: 'chelan2026', staffDisplay: '洗车技师（演示）',
  serviceCount: 4, restrictedPhone: '13200007777',
  svc: { basic: 1, dep: 4, review: 2 }, depAmount: 30,
  cap: 3,                                   // 每个时段最多 3 台（3 个工位）
  T: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
  overlap: t => { const [h, m] = t.split(':').map(Number), x = h * 60 + m + 30; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); },
  async body(H, tok, key, date, time) {
    const sid = key === 'dep' ? 4 : key === 'conc' ? 2 : 1;   // conc 用 40 分钟的精洗，半小时后的时段也重叠
    return { serviceId: sid, profileId: await carFor(H, tok), date, time, name: '测试' };
  },
  async availCheck(H, a) {
    const day = a.days[0];
    if (day.slots.length) H.assert.ok(day.slots.every(x => x.time >= '08:00' && x.time < '20:00'));
  },
  async extraPhoneData(H, phone) {
    const r = await H.api('POST', '/api/merchant/cards', { phone, name: '打码测试', productId: 1 }, H.OWNER);
    if (r.status !== 201) throw new Error('开卡失败 ' + JSON.stringify(r.body));
  },
  phoneUrls: ['/api/merchant/cards', '/api/merchant/ledger'],
  carFor,
};
