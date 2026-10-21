"""端到端测试（澈蓝洗车工坊）：顾客手机 + 商家后台两个独立浏览器上下文操作同一后端。
用法：先用临时数据库起服务（夜间运行请加 FAKE_HM=14:00 node -r ./test/clock.js，让现场取号处于营业时间），
      再 BASE=http://localhost:3201 python test/e2e.py ；SHOTS=目录 时顺便保存截图"""
import os, re, random
from playwright.sync_api import sync_playwright, expect
BASE = os.environ.get('BASE', 'http://localhost:3201')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SHOTS = os.environ.get('SHOTS')
PHONE = '177' + ''.join(random.choice('0123456789') for _ in range(8))
CPHONE = '176' + ''.join(random.choice('0123456789') for _ in range(8))
PLATE = 'B' + ''.join(random.choice('0123456789') for _ in range(3)) + random.choice('ACDEFGHJK') + random.choice('0123456789')
ok = lambda m: print('ok  ', m, flush=True)
def shot(pg, name, full=False):
    if SHOTS: os.makedirs(SHOTS, exist_ok=True); pg.wait_for_timeout(400); pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove())"); pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)
def confirm(pg):
    pg.wait_for_timeout(150)
    if pg.locator('.dlg [data-d="1"]').count(): pg.click('.dlg [data-d="1"]')

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    c = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    m = br.new_context(viewport={'width': 430, 'height': 900}, device_scale_factor=2).new_page()
    errs = []
    for pg in (c, m): pg.on('pageerror', lambda e: errs.append(str(e)))

    # 商家登录 + 看板（排队中 / 工位占用 / 工位看板）
    m.goto(BASE + '/#merchant'); m.fill('#m-user', 'owner'); m.fill('#m-pass', 'wrong'); m.click('[data-a=mLogin]')
    expect(m.locator('.toast')).to_contain_text('用户名或密码错误')
    m.fill('#m-pass', 'chelan2026'); m.click('[data-a=mLogin]')
    expect(m.locator('.mhead')).to_contain_text('澈蓝洗车工坊'); ok('商家登录')
    expect(m.locator('.stats')).to_contain_text('排队中'); expect(m.locator('.stats')).to_contain_text('工位占用')
    expect(m.locator('.bays .bay')).to_have_count(3); ok('看板：排队中 / 工位占用 + 3 个工位看板')
    shot(m, 'merchant_dashboard')

    # 顾客首页：排队看板 + 服务配图 + 次卡
    c.goto(BASE + '/'); c.wait_for_selector('.tabbar')
    expect(c.locator('.hero')).to_contain_text('澈蓝洗车工坊')
    expect(c.locator('.qboard .bay')).to_have_count(3); ok('首页：实时工位看板')
    expect(c.locator('.svc .thumb.img img').first).to_be_visible(); ok('首页：服务配图')
    expect(c.locator('.mcard').first).to_contain_text('普洗十次卡'); ok('首页：次卡介绍')
    shot(c, 'customer_home')
    c.evaluate("document.querySelector('.svc').scrollIntoView({block:'start'})"); shot(c, 'customer_home_services')

    # 现场取号：验证手机号 → 添加车辆（车牌校验）
    c.evaluate("window.scrollTo(0,0)"); c.click('.qboard [data-a=qWalk]'); c.click('.pad .btn[data-a=login]')
    c.fill('#lg-phone', PHONE); c.click('[data-a=lgNext]'); c.click('[data-a=sms]')
    code = c.locator('#ab-demo-code').inner_text(timeout=5000).strip(); assert re.fullmatch(r'\d{6}', code)
    c.fill('#ab-code', code); c.click('[data-a=smsVerify]'); ok('短信验证码登录（演示显示验证码）')
    c.click('[data-a=carEdit]'); c.fill('#cf-num', 'I12345'); c.click('[data-a=cfSave]')
    expect(c.locator('.toast')).to_contain_text('车牌格式不正确'); ok('车牌格式校验')
    c.click('[data-a=cfProvOpen]'); c.click('[data-a=cfProv][data-v="粤"]'); c.fill('#cf-num', PLATE.lower()); c.click('[data-a=cfType][data-v=suv]')
    shot(c, 'customer_vehicle')
    c.click('[data-a=cfSave]'); expect(c.locator('.vcard')).to_contain_text('SUV'); expect(c.locator('.vcard .plate')).to_contain_text(PLATE[1:]); ok('添加车辆（小写自动转大写）')
    c.click('.foot .btn')
    expect(c.locator('.svc[data-v="2"]')).to_contain_text('88'); ok('按车型计价：SUV 精洗 ¥88')
    c.click('.svc[data-v="2"]'); expect(c.locator('.pt .cur')).to_contain_text('SUV')
    shot(c, 'customer_booking_service')
    c.click('.foot .btn'); c.wait_for_selector('.eta')
    expect(c.locator('.modeSeg .on')).to_contain_text('现在排队'); expect(c.locator('.eta')).to_contain_text('前方'); ok('现在排队：预计等待 + 工位')
    shot(c, 'customer_queue')
    c.click('[data-a=cwMode][data-v=book]'); c.wait_for_selector('.date'); c.locator('.slot:not([disabled])').first.wait_for()
    ok('切换到预约时段'); shot(c, 'customer_booking_time')
    c.click('[data-a=cwMode][data-v=walk]'); c.wait_for_selector('.eta')
    c.click('.foot .btn')
    if c.locator('#f-name').input_value() == '': c.fill('#f-name', 'E2E')
    c.click('.foot .btn'); c.wait_for_selector('.ticket')
    expect(c.locator('.ticket')).to_contain_text('现场排队'); expect(c.locator('.ticket')).to_contain_text(PLATE[1:])
    shot(c, 'customer_booking_confirm')
    c.click('.foot .btn[data-a=submit]')
    expect(c.locator('.succ h2')).to_contain_text('取号成功'); qno = re.search(r'A\d{3}', c.locator('.succ h2').inner_text()).group(0); ok('取号成功 ' + qno)

    # 商家端实时看到排队车辆 → 安排工位开工（自动分配）
    m.click('[data-a=mTab][data-v=today]')
    card = m.locator(f'.card.bk:has-text("{qno}")').first
    expect(card).to_contain_text(PLATE[-2:], timeout=8000); ok('商家端实时出现排队车辆（SSE）')
    if '3/3' in m.locator('.stats').inner_text():   # 同一实例重复运行时工位可能已满：先完工一台
        m.locator('[data-a=mOp]:has-text("完工")').first.click(); confirm(m); expect(m.locator('.stats')).not_to_contain_text('3/3')
    card.locator('[data-a=mOp]:has-text("安排工位开工")').click(); confirm(m)
    expect(m.locator('.toast')).to_contain_text('已更新')
    expect(m.locator(f'.card.bk:has-text("{qno}")').first).to_contain_text('施工工位'); ok('开工自动分配空闲工位')
    expect(m.locator('.stats')).to_contain_text('3/3'); ok('工位占用 3/3')
    c.goto(BASE + '/'); c.wait_for_selector('.tabbar')
    expect(c.locator('.live').first).to_contain_text('施工中', timeout=6000); ok('顾客首页实时显示施工进度')
    c.evaluate("document.querySelector('.live').scrollIntoView({block:'center'})"); shot(c, 'customer_home_live')

    # 开卡 → 次卡会员 → 手动核销 → 记录
    m.click('[data-a=cardIssue]'); m.fill('#ci-name', '测试女士'); m.fill('#ci-phone', CPHONE); m.click('[data-a=ciSave]')
    expect(m.locator('.toast')).to_contain_text('已开卡'); m.wait_for_selector('.card.mc')
    mc = m.locator(f'.card.mc:has-text("测试女士")').first; expect(mc).to_contain_text('剩 10/10'); ok('开卡：普洗十次卡')
    mc.locator('[data-a=cardUse]').click(); confirm(m); expect(m.locator('.toast')).to_contain_text('已核销')
    expect(m.locator(f'.card.mc:has-text("测试女士")').first).to_contain_text('剩 9/10'); ok('手动核销 1 次')
    m.evaluate("document.querySelector('.mtabs').scrollIntoView({block:'start'})"); shot(m, 'merchant_cards')
    m.locator(f'.card.mc:has-text("测试女士") [data-a=cardLog]').first.click(); expect(m.locator('.sheet')).to_contain_text('手动核销'); ok('次卡记录')
    m.click('.sheet [data-a=closeSheet]')

    # 车型价格：店主改价 → 顾客端实时更新
    m.click('[data-a=goPrice]'); m.locator('[data-a=pkgEdit][data-v="2"]').click()
    m.locator('input.tp[data-k=suv]').fill('86'); m.click('[data-a=pkgSave]'); expect(m.locator('.toast')).to_contain_text('价格已更新')
    shot(m, 'merchant_pricing')
    c.click('.tab:has-text("预约")'); c.click('.foot .btn')
    expect(c.locator('.svc[data-v="2"]')).to_contain_text('86', timeout=5000); ok('改价后顾客端实时更新（SSE）')
    m.locator('[data-a=pkgEdit][data-v="2"]').click(); m.locator('input.tp[data-k=suv]').fill('88'); m.click('[data-a=pkgSave]'); expect(m.locator('.toast')).to_contain_text('价格已更新')

    # 店员：无改价入口；可开卡；手机号打码
    s = br.new_context(viewport={'width': 430, 'height': 900}).new_page(); s.on('pageerror', lambda e: errs.append(str(e)))
    s.goto(BASE + '/#merchant'); s.fill('#m-user', 'staff'); s.fill('#m-pass', 'staff2026'); s.click('[data-a=mLogin]')
    expect(s.locator('.mhead')).to_contain_text('洗车技师'); expect(s.locator('[data-a=goPrice]')).to_have_count(0); expect(s.locator('[data-a=cardIssue]')).to_have_count(1)
    s.click('[data-a=mTab][data-v=cards]'); expect(s.locator(f'.card.mc:has-text("测试女士")').first).to_contain_text(CPHONE[:3] + '****'); ok('店员：无改价入口、可开卡、手机号打码')
    assert not errs, errs
    ok('无前端报错')
    br.close()
print('E2E PASS')
