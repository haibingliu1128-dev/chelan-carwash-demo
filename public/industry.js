/* 澈蓝洗车工坊 · 行业前端模块：车辆档案（车牌/车型）、按车型计价、预约时段 / 现场排队取号、工位看板、次卡开卡与核销、车型价格管理 */
window.IND=function(Q){
var X=Q.X,S=Q.S,V=Q.V,I=Q.I,esc=Q.esc,api=Q.api;
var CARP='<path d="M3 16v-3.5c0-1 .6-1.7 1.6-2L7 9.8 9.2 6.6c.4-.5.9-.8 1.5-.8h4.6c.6 0 1.1.3 1.5.8l2.2 3.2 2.4.7c1 .3 1.6 1 1.6 2V16z"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>';
var CAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'+CARP+'</svg>',CARF='<svg viewBox="0 0 24 24" fill="currentColor">'+CARP+'</svg>';
var CARD='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/></svg>';
var QUEUE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h10M4 12h10M4 18h10"/><circle cx="19" cy="6" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="19" cy="18" r="1.5"/></svg>';
function carSvg(t,c){c=c||'#1E6BFF';var body={sedan:'M4 22c0-3 2-5 5-5.5l8-1.5 7-6h18l9 6.5 9 1.5c3 .5 4 2 4 4V25H4z',suv:'M4 23v-5c0-2 1.5-3 3.5-3.5L13 13l6-6h26l7 6.5 6 1c2 .5 3 2 3 3.5V25H4z',mpv:'M4 23v-6c0-2 1-3 3-3.5l6-1 4-6.5h36l6 7 3 1c1.5.5 2 1.5 2 3V25H4z'}[t]||'';
  return '<svg class="carS" viewBox="0 0 68 32"><path d="'+body+'" fill="'+c+'"/><path d="'+(t==='sedan'?'M22 15l5.5-4.5h7.5v4.5zM37 10.5h5l6 4.5H37z':t==='suv'?'M21 13l4.5-4.5h8.5V13zM36 8.5h8l5 4.5H36z':'M19 12l3.5-4.5h12V12zM37 7.5h14l4.5 4.5H37z')+'" fill="#CFE3FF" opacity=".9"/><circle cx="17" cy="25" r="5" fill="#1F2329"/><circle cx="17" cy="25" r="2" fill="#C9CED6"/><circle cx="52" cy="25" r="5" fill="#1F2329"/><circle cx="52" cy="25" r="2" fill="#C9CED6"/></svg>'}
function plateHtml(v,lg){if(!v||!v.num)return '';var ev=v.num.length===7;return '<span class="plate'+(ev?' ev':'')+(lg?' lg':'')+'">'+esc(v.prov)+esc(v.num[0])+'·'+esc(v.num.slice(1))+'</span>'}
function P(){return Q.C.industry||{}}
function typeName(t){var x=(P().types||[]).filter(function(y){return y[0]===t})[0];return x?x[1]:t}
function cars(){return Q.ME.profiles||[]}
function carById(id){return cars().filter(function(p){return p.id===+id})[0]}
function curCar(){return carById(S.sel.profileId)}
function loadCars(){if(!Q.ME.token)return Promise.resolve([]);return api('GET','/api/me/profiles',null,'c').then(function(r){Q.ME.profiles=r;if(S.sel.profileId&&!carById(S.sel.profileId))S.sel.profileId=null;return r})}
var QB=null,MQ=null,MC=null,MYC=null;
function loadQB(){return api('GET','/api/queue',null,'c').then(function(r){QB=r;return r},function(){})}
function qSum(q){return (q&&q.summary)||{bays:[],ahead:0,eta:0}}
function bayGrid(sm,merchant){return '<div class="bays">'+(sm.bays||[]).map(function(b){return '<div class="bay '+(b.free?'free':'busy')+'"><div class="bn"><span>'+esc(b.name)+'</span>'+(b.free?'':'<span>剩 '+b.left+' 分</span>')+'</div><div class="bs">'+(b.free?'空闲':esc(b.serviceName))+'</div>'+(b.free?'<div class="bm">可立即施工</div>':'<div class="bm">'+esc(b.plate||'')+'</div><div class="bp"><i style="width:'+b.pct+'%"></i></div>')+'</div>'}).join('')+'</div>'}
function etaText(m){return m==null?'—':m<=0?'无需等待':'约 '+m+' 分钟'}

Object.assign(X,{
  brand:'澈蓝洗车工坊',brandSub:'CHELAN AUTO CARE · 3 个工位',heroTags:['预约免排队','次卡更划算','完工短信通知'],avatar:'澈',member:'澈蓝会员',ownerPwd:'chelan2026',
  tabs:[['home','首页',I.home,I.homeF],['cars','我的车辆',CAR,CARF],['book','预约',I.cal,I.calF],['mine','我的',I.user,I.userF]],
  flow:['bcar','book','time','info','confirm'],stepNames:['选车辆','选服务','选时间','填信息','确认'],
  bookTitle:'选择服务',svcTitle:'洗车服务',hotTitle:'洗车服务',notePh:'选填：如 车内有儿童座椅、后备箱不用清理',svcPh:'镀晶',staffPh:'洗车技师小李',timeWord:'到店时间',
  durations:[20,30,40,60,90,120],progressInMerchant:false,openSub:'预约免排队 · 也可现场取号',
  notice:'请按预约时间到店，报车牌即可安排工位；现场取号按顺序施工；',
  heroArt:function(){return '<div class="lines"></div><svg class="car" viewBox="0 0 210 96"><ellipse cx="110" cy="86" rx="95" ry="6" fill="#000" opacity=".25"/><g transform="translate(14,10) scale(2.7)">'+carSvg('suv','#3E86FF').replace(/<\/?svg[^>]*>/g,'')+'</g><circle cx="40" cy="20" r="5" fill="#9FD9FF" opacity=".5"/><circle cx="58" cy="10" r="3" fill="#9FD9FF" opacity=".5"/><circle cx="30" cy="36" r="2.5" fill="#9FD9FF" opacity=".5"/></svg>'},
  quick:[['startBook','',I.cal,'预约洗车','#E6EFFF','#1E6BFF'],['qWalk','',QUEUE,'现场取号','#E0F7FB','#0FA7C4'],['tab','cars',CAR,'我的车辆','#EEE9FF','#7255E0'],['toMerchant','',I.shop,'商家后台','#FFF3DD','#E39B17']],
  svcMeta:function(s){var c=curCar(),pr=s.pricing||{};
    if(c&&pr[c.type]!=null)return '<span class="price">'+pr[c.type]+'</span><span class="chip">'+esc(typeName(c.type))+' · 约'+Q.durText(s.duration)+'</span>';
    return '<span class="price from">'+s.price+'</span><span class="chip">起 · 约'+Q.durText(s.duration)+'</span>'},
  estimate:function(s){var c=curCar(),pr=s&&s.pricing;if(!c||!pr||pr[c.type]==null)return null;return {price:pr[c.type],duration:s.duration}},
  bookTop:function(){var c=curCar();return c?'<div class="tierbar">'+carSvg(c.type,'#1E6BFF')+'<span>'+plateHtml(c)+' · '+esc(typeName(c.type))+'，按车型计价</span></div>':''},
  bookBottom:function(){var s=Q.svcById(S.sel.serviceId);if(!s||!s.pricing)return '';var c=curCar();
    return '<div class="sec-t">「'+esc(s.name)+'」车型价目</div><div class="card"><div class="pt">'+(P().types||[]).map(function(t){return '<span class="'+(c&&c.type===t[0]?'cur':'')+'">'+esc(t[1])+'<b>¥'+s.pricing[t[0]]+'</b></span>'}).join('')+'</div></div>'},
  timeTop:function(){return modeSeg()},
  walkView:function(s){var sm=qSum(QB),c=curCar(),pr=s.pricing&&c?s.pricing[c.type]:s.price;
    var body=Q.steps('time')+'<div class="pad"><div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 12px"><div class="se" style="flex:1">'+Q.thumb(s)+'<div class="b"><b>'+esc(s.name)+'</b><span class="muted" style="font-size:12px">施工约 '+Q.durText(s.duration)+'</span></div></div><span class="price">'+pr+'</span></div>'+modeSeg()+
      (QB?'<div class="eta"><small>前方 '+sm.ahead+' 辆 · 预计等待</small><b>'+(sm.eta<=0?'无需等待':sm.eta+'<small> 分钟</small>')+'</b><small>按工位剩余时长估算，仅供参考</small></div><div class="card" style="margin-top:12px"><div class="mini">实时工位</div>'+bayGrid(sm)+'</div>':Q.loading())+
      '<div class="notice">取号后请留在店内或附近，叫号时到工位；排队号当天有效。</div></div>';
    return {nav:Q.nav('选择时间',{back:true}),body:body,foot:'<div class="foot"><div class="sum">现场排队<br><small class="muted">到店支付 ¥'+pr+'</small></div><button class="btn" data-a="flowNext">下一步</button></div>'}},
  walkWhen:function(){var sm=qSum(QB);return '前方 '+sm.ahead+' 辆 · '+etaText(sm.eta)},
  beforeNext:function(view){if(view==='bcar'&&!curCar()){Q.toast('请先选择车辆');return false}},
  confirmRows:function(){var c=curCar();if(!c)return '';return '<div class="kv"><span>车辆</span><span>'+plateHtml(c)+' '+esc(typeName(c.type))+'</span></div>'+(S.sel.walk?'<div class="kv"><span>排队</span><span>'+esc(X.walkWhen())+'</span></div>':'')},
  rows:function(b){var p=(b.extra||{}).profile;if(!p)return '';
    return '<div class="row">'+carSvg(p.type,'#8A97AD').replace('class="carS"','class="carS sm"')+plateHtml(p)+' <span class="muted">'+esc(p.typeName||typeName(p.type))+'</span></div>'+
      (b.bay?'<div class="row">'+I.pin+'施工工位：'+esc(b.bay)+'</div>':'')},
  successText:function(b){if(b.kind==='walk')return '请留意叫号'+(b.eta!=null?'，预计等待约 '+b.eta+' 分钟':'')+'；完工会短信通知取车';var p=b.extra&&b.extra.profile;return (p?esc(p.plate)+' 的':'')+'洗车时段已为你保留，到店报车牌即可'},
  homeTop:function(){var sm=qSum(QB);
    return '<div class="card qboard"><div class="qtop"><div><div class="mini">当前排队</div><div class="qbig">'+(QB?sm.ahead:'—')+'<small>辆等待</small></div></div><div style="text-align:right"><span class="livedot"><i></i>实时</span><div class="mini" style="margin-top:6px">现在取号预计等待 <b class="price" style="font-size:13px">'+(QB?etaText(sm.eta):'—')+'</b></div></div></div>'+(QB?bayGrid(sm):'')+
      '<div class="qbtns"><button class="btn" data-a="qWalk">现在排队取号</button><button class="btn ghost" data-a="startBook">预约时段</button></div></div>'},
  homeLive:function(){var L=(Q.ME.bookings||[]).filter(function(b){return b.date===Q.today()&&(b.status==='arrived'&&b.progress!=='done'||b.kind==='walk'&&b.status==='arrived')});
    return L.map(function(b){var p=(b.extra||{}).profile||{};return '<div class="live"><div class="petc">'+carSvg(p.type,'#fff')+'<div style="flex:1"><b style="font-size:16px">'+(b.queueNo?esc(b.queueNo)+' · ':'')+esc(b.statusText)+'</b><div style="font-size:12px;opacity:.9">'+plateHtml(p)+' '+esc(b.serviceName)+(b.bay?' · '+esc(b.bay):b.eta!=null?' · 预计等待约 '+b.eta+' 分钟':'')+'</div></div></div>'+Q.progressBar(b)+'</div>'}).join('')},
  homeExtra:function(){var L=(P().cardProducts||[]).filter(function(x){return x.kind==='count'});if(!L.length)return '';
    return '<div class="sec-t">次卡<small>到店开卡 · 洗完自动核销</small></div>'+L.map(function(p,i){var s=Q.svcById(p.serviceId);var one=s&&s.pricing?s.pricing.sedan:null;
      return '<div class="mcard'+(i%2?' c2':'')+'"><div class="n">'+esc(p.name)+'</div><div class="rm">¥'+p.price+'<small>'+p.times+' 次 · 约 ¥'+(p.price/p.times).toFixed(1)+'/次</small></div><div class="meta">适用：'+esc(s?s.name:'指定服务')+(one?'（轿车单次 ¥'+one+'，'+(p.times*one>p.price?'省 ¥'+(p.times*one-p.price):'')+'）':'')+' · 示例卡种</div></div>'}).join('')},
  mineExtra:function(){if(!Q.ME.token||!MYC||!MYC.cards.length)return '';
    return '<div class="pad" style="padding-bottom:0"><div class="sec-t">我的次卡</div>'+MYC.cards.map(function(k,i){return cardFace(k,i)}).join('')+'</div>'},
  mineCells:function(){return '<button class="cell" data-a="tab" data-v="cars"><span class="ic">'+CAR+'</span><span class="t">我的车辆</span><span class="arrow">'+I.right+'</span></button>'},
  mTiles:function(){return Q.can('service.manage')?'<button data-a="goPrice"><span class="qi" style="background:#E6EFFF;color:#1E6BFF">'+I.edit+'</span><div><b>服务与车型价格</b><span>轿车 / SUV / MPV</span></div></button>':''},
  mTop:function(){var sm=qSum(MQ);return '<div class="sec-t">工位看板<small>'+(MQ?'排队 '+sm.ahead+' 辆 · 新取号预计 '+etaText(sm.eta):'')+'</small></div><div class="card">'+(MQ?bayGrid(sm,true):Q.loading())+'</div>'+
    (Q.can('booking.handle')?'<button class="add" data-a="cardIssue">'+CARD+'开卡（次卡）</button>':'')},
  mHomeLoad:function(){return api('GET','/api/merchant/queue',null,'m').then(function(r){MQ=r},function(){MQ=null})},
  mTabs:[['today','今日工单'],['upcoming','预约'],['cards','次卡会员'],['all','全部记录']],
  mTabLoad:{cards:function(){return api('GET','/api/merchant/cards',null,'m').then(function(r){MC=r;return []})}},
  mList:{cards:function(){if(!MC)return Q.loading();if(!MC.cards.length)return Q.emptyBox('还没有次卡会员',false);
    return MC.cards.map(function(k){return '<div class="card mc"><div class="h"><b>'+esc(k.cname||'顾客')+' <span class="muted" style="font-weight:400">'+esc(k.phone||'')+'</span>'+(k.seed?'<span class="demo-tag">示例</span>':'')+'</b><span class="st c-brand">剩 '+k.remain+'/'+k.total+'</span></div>'+
      '<div class="row">'+CARD+esc(k.name)+(k.pending?' · <span class="muted">待核销 '+k.pending+' 次</span>':'')+'</div><div class="row"><span class="dots10 sm">'+dots(k)+'</span></div>'+
      '<div class="ops"><button class="btn sm gray" data-a="cardLog" data-v="'+k.id+'">记录</button>'+(Q.can('booking.handle')?'<button class="btn sm" data-a="cardUse" data-v="'+k.id+'"'+(k.remain>0?'':' disabled')+'>核销 1 次</button>':'')+'</div></div>'}).join('')}},
  mviews:['mprice'],liveViews:['cars'],
  onPublic:function(){if(['home','time','confirm'].indexOf(S.view)>=0)return loadQB()},
  onBookErr:function(e){if(e.code==='NEED_PROFILE'){Q.alertBox('请重新选择',e.message);S.stack=[];S.view='bcar';Q.render(true);return true}}
});
function dots(k){var h='';for(var i=0;i<k.total;i++)h+='<i class="'+(i<k.remain?'':'u')+'"></i>';return h}
function cardFace(k,i){return '<div class="mcard'+(i%2?' c2':'')+'"><div class="n">'+esc(k.name)+(k.seed?' <span class="demo-tag" style="background:rgba(255,255,255,.25);color:#fff">示例</span>':'')+'</div><div class="rm">'+k.remain+'<small>/ '+k.total+' 次剩余'+(k.pending?' · 待核销 '+k.pending:'')+'</small></div><div class="dots10">'+dots(k)+'</div><div class="meta">洗完自动核销 · 到店出示手机号即可'+(k.expires?' · 有效期至 '+esc(k.expires):'')+'</div></div>'}
function modeSeg(){return '<div class="modeSeg"><button class="'+(S.sel.walk?'':'on')+'" data-a="cwMode" data-v="book">预约时段</button><button class="'+(S.sel.walk?'on':'')+'" data-a="cwMode" data-v="walk">现在排队</button></div>'}
X.enter.home=function(){loadQB().then(function(){if(S.view==='home')Q.render(false)});if(Q.ME.token)Q.loadMine().then(function(){if(S.view==='home')Q.render(false)},function(){})};
X.enter.time=function(){loadQB().then(function(){if(S.view==='time')Q.render(false)})};
X.enter.confirm=function(){if(S.sel.walk)loadQB().then(function(){if(S.view==='confirm')Q.render(false)})};
X.enter.mine=function(){if(Q.ME.token)api('GET','/api/me/cards',null,'c').then(function(r){MYC=r;if(S.view==='mine')Q.render(false)},function(){})};
X.enter.cars=X.enter.bcar=function(){loadCars().then(function(){if(S.view==='cars'||S.view==='bcar'){if(!S.sel.profileId&&cars().length===1)S.sel.profileId=cars()[0].id;Q.render(false)}},Q.fail)};
X.enter.mprice=function(){Q.mLoad('mprice')};
X.mload.mprice=function(){return Q.loadShop()};

/* ---------- 我的车辆 ---------- */
function carCard(c,pick){var on=pick&&S.sel.profileId===c.id;
  return '<'+(pick?'button':'div')+' class="vcard'+(on?' on':'')+'"'+(pick?' data-a="carPick" data-v="'+c.id+'"':'')+'>'+carSvg(c.type,on||!pick?'#1E6BFF':'#8A97AD')+'<div class="g">'+plateHtml(c)+(c.seed?'<span class="demo-tag">示例</span>':'')+'<div class="mini" style="margin-top:4px">'+esc(typeName(c.type))+'</div></div>'+
  (pick?'<span class="pick">'+(on?I.check:'')+'</span>':'<button class="icbtn" data-a="carEdit" data-v="'+c.id+'" aria-label="编辑">'+I.edit+'</button>')+'</'+(pick?'button':'div')+'>'}
V.cars=function(){
  if(!Q.ME.token)return {nav:Q.nav('我的车辆'),tab:true,body:'<div class="pad">'+Q.emptyBox('验证手机号后管理你的车辆',false)+'<button class="btn" data-a="login">验证手机号</button></div>'};
  var L=Q.ME.profiles;
  return {nav:Q.nav('我的车辆'),tab:true,body:'<div class="pad"><div class="notice" style="margin-top:0">车型决定价格（轿车 / SUV / MPV·7座）；到店报车牌即可。最多 5 辆。</div>'+(!L?Q.loading():L.length?L.map(function(c){return carCard(c,false)}).join(''):Q.emptyBox('还没有添加车辆',false))+
    '<button class="add" data-a="carEdit">'+I.plus+'添加车辆</button></div>'}};
V.bcar=function(){var top=Q.steps('bcar'),t=S.sel.walk?'现场取号':'预约洗车';
  if(!Q.ME.token)return {nav:Q.nav(t,{back:S.stack.length>0}),tab:S.stack.length===0,body:top+'<div class="pad">'+Q.emptyBox('先验证手机号，再选择要洗的车',false)+'<button class="btn" data-a="login">验证手机号</button></div>'};
  var L=Q.ME.profiles,c=curCar();
  return {nav:Q.nav(t,{back:S.stack.length>0}),tab:S.stack.length===0,body:top+'<div class="pad"><div class="sec-t">洗哪辆车？<small>价格按车型自动计算</small></div>'+(!L?Q.loading():L.map(function(x){return carCard(x,true)}).join(''))+
    '<button class="add" data-a="carEdit">'+I.plus+'添加车辆</button>'+Q.rulesBox()+'</div>',
    foot:'<div class="foot"><div class="sum">'+(c?'已选：'+plateHtml(c)+'<br><small class="muted">'+esc(typeName(c.type))+'</small>':'请选择车辆')+'</div><button class="btn" data-a="flowNext"'+(c?'':' disabled')+'>下一步</button></div>'}};
var CF=null;
function carSheet(c){CF=c?{id:c.id,prov:c.prov,num:c.num,type:c.type}:{prov:'粤',num:'',type:'sedan',pp:false};Q.sheet(c?'编辑车辆':'添加车辆','<div id="cf-body"></div>');cfBody()}
function cfRead(){var e=document.getElementById('cf-num');if(e)CF.num=e.value.toUpperCase().replace(/\s/g,'')}
function cfBody(){var el=document.getElementById('cf-body');if(!el)return;var Pi=P();
  el.innerHTML='<div class="card" style="padding:10px 14px"><div class="mini" style="margin-bottom:8px">车牌号</div><div class="plateIn"><button class="pv" data-a="cfProvOpen" aria-label="选择省份">'+esc(CF.prov)+' ▾</button><input id="cf-num" maxlength="7" autocapitalize="characters" placeholder="如 B12345（新能源 7 位）" value="'+esc(CF.num)+'" aria-label="车牌号"></div>'+
  (CF.pp?'<div class="prov" style="margin-top:10px">'+(Pi.prov||[]).map(function(p){return '<button class="'+(CF.prov===p?'on':'')+'" data-a="cfProv" data-v="'+p+'">'+p+'</button>'}).join('')+'</div>':'')+'</div>'+
  '<div class="card"><div class="mini" style="margin-bottom:8px">车型（决定价格）</div><div class="types">'+(Pi.types||[]).map(function(t){var on=CF.type===t[0];return '<button class="'+(on?'on':'')+'" data-a="cfType" data-v="'+t[0]+'">'+carSvg(t[0],on?'#1E6BFF':'#8A97AD')+esc(t[1])+'</button>'}).join('')+'</div></div>'+
  '<div style="display:flex;gap:10px">'+(CF.id?'<button class="btn gray" style="flex:1" data-a="cfDel">删除</button>':'')+'<button class="btn" style="flex:2" data-a="cfSave">保存</button></div>'}
X.act.carEdit=function(v){Q.needLogin(function(){loadCars().then(function(){carSheet(v?carById(v):null)})})};
X.act.cfProvOpen=function(){cfRead();CF.pp=!CF.pp;cfBody()};
X.act.cfProv=function(v){cfRead();CF.prov=v;CF.pp=false;cfBody()};
X.act.cfType=function(v){cfRead();CF.type=v;cfBody()};
X.act.cfSave=function(){cfRead();if(!/^[A-HJ-NP-Z][A-HJ-NP-Z0-9]{5,6}$/.test(CF.num)){Q.toast('车牌格式不正确（字母开头，共 6–7 位，不含 I/O）');return}
  api(CF.id?'PUT':'POST','/api/me/profiles'+(CF.id?'/'+CF.id:''),{prov:CF.prov,num:CF.num,type:CF.type},'c').then(function(p){Q.closeSheet();Q.toast(CF.id?'已保存':'已添加 '+p.plate);if(S.view==='bcar')S.sel.profileId=p.id;S.quote=null;return loadCars()}).then(function(){Q.render(false)},Q.fail)};
X.act.cfDel=function(){var id=CF.id;Q.dialog('删除车辆','确定删除「'+esc(CF.prov+CF.num)+'」？','删除',function(){api('DELETE','/api/me/profiles/'+id,null,'c').then(function(){Q.closeSheet();Q.toast('已删除');if(S.sel.profileId===id)S.sel.profileId=null;return loadCars()}).then(function(){Q.render(false)},Q.fail)})};
X.act.carPick=function(v){if(S.sel.profileId!==+v){S.sel.profileId=+v;S.quote=null}Q.render(false)};
X.act.cwMode=function(v){S.sel.walk=v==='walk';S.quote=null;Q.render(false);Q.onEnter('time')};
X.act.qWalk=function(){var keep=S.sel;S.sel=Q.newSel(keep);S.sel.walk=true;S.stack=[];Q.go('bcar')};
X.act.goPrice=function(){Q.go('mprice')};

/* ---------- 商家：开卡 / 核销 / 记录 ---------- */
X.act.cardIssue=function(){var L=(P().cardProducts||[]).filter(function(p){return p.kind==='count'});
  Q.sheet('开卡（次卡）','<div class="card" style="padding:2px 14px"><div class="field"><label>顾客姓名</label><input id="ci-name" maxlength="12" placeholder="如：王先生"></div><div class="field"><label>手机号</label><input id="ci-phone" type="tel" inputmode="numeric" maxlength="11" placeholder="11 位手机号"></div></div>'+
  '<div class="card"><div class="mini" style="margin-bottom:8px">卡种</div><div class="chipsel" id="ci-prods">'+L.map(function(p,i){return '<button class="'+(i===0?'on':'')+'" data-a="ciPick" data-v="'+p.id+'">'+esc(p.name)+' ¥'+p.price+'</button>'}).join('')+'</div><div class="mini" style="margin-top:8px">演示：线下收款后开卡，不产生真实支付。</div></div>'+
  '<div style="display:flex;gap:10px"><button class="btn gray" style="flex:1" data-a="closeSheet">取消</button><button class="btn" style="flex:1" data-a="ciSave">确认开卡</button></div>')};
X.act.ciPick=function(v,t){[].slice.call(document.querySelectorAll('#ci-prods button')).forEach(function(b){b.classList.remove('on')});t.classList.add('on')};
X.act.ciSave=function(){var on=document.querySelector('#ci-prods button.on');var b={name:document.getElementById('ci-name').value.trim(),phone:document.getElementById('ci-phone').value.trim(),productId:on?+on.getAttribute('data-v'):null};
  if(!/^1\d{10}$/.test(b.phone)){Q.toast('请输入正确的 11 位手机号');return}if(!b.productId){Q.toast('请选择卡种');return}
  api('POST','/api/merchant/cards',b,'m').then(function(k){Q.closeSheet();Q.toast('已开卡：'+k.name);S.mTab='cards';Q.mLoad('merchant')},Q.fail)};
X.act.cardUse=function(v){var k=(MC&&MC.cards||[]).filter(function(x){return x.id===+v})[0];if(!k)return;
  Q.dialog('核销 1 次','「'+esc(k.cname||'顾客')+'」的'+esc(k.name)+'，剩余 '+k.remain+' 次。线下服务完成后手动核销 1 次？','核销',function(){api('POST','/api/merchant/cards/'+k.id+'/use',{times:1,note:'前台手动核销'},'m').then(function(){Q.toast('已核销 1 次');Q.mLoad('merchant')},Q.fail)})};
var KL={open:'开卡',recharge:'充值',use:'完工核销',manual:'手动核销',refund:'退回',pay:'支付'};
X.act.cardLog=function(v){api('GET','/api/merchant/cards/'+v,null,'m').then(function(r){var k=r.card;
  Q.sheet(esc(k.name)+' · 记录','<div class="card"><div class="kv"><span>持卡人</span><span>'+esc(k.cname||'顾客')+' '+esc(k.phone||'')+'</span></div><div class="kv"><span>剩余</span><span>'+k.remain+' / '+k.total+' 次</span></div></div><div class="card" style="padding:4px 14px">'+
    (r.ledger.length?r.ledger.map(function(l){return '<div class="cell"><span class="t">'+esc(KL[l.kind]||l.kind)+(l.note?' <small class="muted">'+esc(l.note)+'</small>':'')+'<br><small class="muted">'+esc(new Date(l.at).toLocaleString('zh-CN',{hour12:false}))+'</small></span><b>'+(l.times>0?'+':'')+(l.times||'')+(l.times?' 次':'')+'</b></div>'}).join(''):'<div class="mini" style="padding:10px 0">暂无记录</div>')+'</div>'+
    '<button class="btn gray" data-a="closeSheet">关闭</button>')},Q.fail)};

/* ---------- 商家：车型价格 ---------- */
V.mprice=function(){var C=Q.C,T=P().types||[];
  return {nav:Q.nav('服务与车型价格',{back:true}),body:'<div class="pad"><div class="sec-t">洗车服务<small>按车型定价，保存后顾客端实时生效</small></div>'+
  C.services.map(function(s){return '<div class="card"><div class="petc">'+Q.thumb(s)+'<div style="flex:1;min-width:0"><b>'+esc(s.name)+'</b><div class="mini">'+esc(s.desc||'')+' · 约'+Q.durText(s.duration)+'</div></div>'+(Q.can('service.manage')?'<button class="icbtn" data-a="pkgEdit" data-v="'+s.id+'" aria-label="编辑价格">'+I.edit+'</button>':'')+'</div><div class="pt">'+
    T.map(function(t){return '<span>'+esc(t[1])+'<b>¥'+(s.pricing?s.pricing[t[0]]:s.price)+'</b></span>'}).join('')+'</div></div>'}).join('')+
  (Q.can('service.manage')?'':'<div class="permnote">修改价格需店主授权「管理服务与图片」。</div>')+'</div>'}};
X.act.pkgEdit=function(v){var s=Q.svcById(v),T=P().types||[];S.ep=s.id;
  Q.sheet('编辑「'+esc(s.name)+'」','<div class="card" style="padding:8px 14px">'+T.map(function(t){return '<div class="field"><label>'+esc(t[1])+'</label><span style="flex:1"></span><input class="tp mx" data-k="'+t[0]+'" type="number" inputmode="numeric" min="0" max="9999" value="'+(s.pricing?s.pricing[t[0]]:s.price)+'" aria-label="'+esc(t[1])+'价格"><span class="unit">元</span></div>'}).join('')+
  '</div><div style="display:flex;gap:10px"><button class="btn gray" style="flex:1" data-a="closeSheet">取消</button><button class="btn" style="flex:1" data-a="pkgSave">保存</button></div>')};
X.act.pkgSave=function(){var s=Q.svcById(S.ep),pr={};[].slice.call(document.querySelectorAll('.tp')).forEach(function(e){pr[e.getAttribute('data-k')]=Math.round(+e.value)});
  api('PUT','/api/merchant/services/'+s.id,{pricing:pr},'m').then(function(){Q.closeSheet();Q.toast('价格已更新');return Q.loadShop()}).then(function(){Q.render(false)},Q.fail)};
};
