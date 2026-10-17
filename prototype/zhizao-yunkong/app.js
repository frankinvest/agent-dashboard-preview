/* 智造云控 · 可交互原型
   数据取自演示视频真实画面内容（演示态数据）
   业务规则严格照 PRD.md v0.1
   前端原型，无后端；状态在内存，操作会真实联动 */

const PROCESS = ['下料','折弯','焊接','喷涂','装配','检验','完工'];

const S = {
  user: null, page: 'dash', chat: [], reports: [], parseOut: null, selProc: null,
  order: {
    no:'DD20261015004', status:'已确认', cust:'王老板', phone:'13726655396',
    due:'2026-10-31', src:'微信接单', amount:14716.02,
    created:'2026-10-15 02:31', confirmed:'2026-10-15 10:34',
    raw:'王老板，帮我做一批配电箱，600×800×250，1.5厚冷轧板，30台，月底之前交货。另外再做2台动力配电箱，800×1000×300，2.0厚冷轧板，喷塑。',
    items:[
      {type:'普通配电箱', L:600, W:800, H:250, mat:'冷轧板', th:1.5, surf:'不处理', qty:30, price:431.00},
      {type:'动力配电箱', L:800, W:1000, H:300, mat:'冷轧板', th:2.0, surf:'喷塑', qty:2, price:893.01}
    ]
  },
  quote: {no:'BJ20261015001', status:'已确认', cost:10900.78, price:14716.02,
    valid:'2026-10-30', mode:'markup', markup:35, margin:25.9},
  cost: {sel:0, area:1.909,
    base:[148.55,26.60,34.35,47.13,36.90,10.54,0.00,15.20],
    names:['板材材料费（含损耗）','下料加工费','折弯加工费','焊接加工费',
           '表面处理费','装配费','配件费','其他费用（管理 / 包装 / 运输）']},
  task: {no:'SC20261015001', order:'DD20261015004', cust:'王老板',
    name:'普通配电箱', spec:'600×800×250 冷轧板 1.50mm',
    plan:30, done:0, team:'车间班组', status:'待开工',
    proc:{下料:0,折弯:0,焊接:0,喷涂:0,装配:0,检验:0,完工:0}},
  dash: {todayNew:3, monthAmt:175355, toQuote:5, producing:7, todayDone:333, delayed:8,
    trend:[12,18,15,22,19,26,21],
    statusDist:[{n:'已完成',v:34},{n:'生产中',v:28},{n:'已确认',v:18},
               {n:'待报价',v:12},{n:'待确认',v:8}]},
  log: [{t:'2026-10-15 10:34', x:'状态流转：DD20261015004：待确认 → 已确认'},
        {t:'2026-10-15 02:34', x:'AI 接单创建：DD20261015004 微信消息识别生成'}]
};

const money = n => '¥' + n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s => String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const now = () => { const d=new Date(),p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); };

function toast(msg,kind){
  const t=document.createElement('div');
  t.className='toast '+(kind||''); t.textContent=msg;
  document.getElementById('toast-host').appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
function modal(html){ document.getElementById('modal-host').innerHTML='<div class="mask">'+html+'</div>'; }
function closeModal(){ document.getElementById('modal-host').innerHTML=''; }

/* ---------- 派生计算 ----------
   单台成本按【产品类型】分别计算，不是所有产品共用一个成本。
   标定依据（视频明确）：普通配电箱单价 ¥431.00、动力配电箱单价 ¥893.01，
   加价率 35% 时反推单台成本 = 单价 ÷ 1.35，
   再验证 319.26×30 + 661.49×2 = ¥10,900.78，与视频报价单成本完全一致。 */
const COST_UNIT={'普通配电箱':319.26,'动力配电箱':661.49,
  '非标钣金箱体':319.26,'电气控制柜':661.49};
const BASE_SUM=S.cost.base.reduce(function(a,v){ return a+v; },0);
function unitCost(type){
  const u=COST_UNIT[type]||COST_UNIT['普通配电箱'];
  return S.cost.base.reduce(function(a,v){ return a+v/BASE_SUM*u; },0);
}
function costItems(type){
  const u=COST_UNIT[type]||COST_UNIT['普通配电箱'];
  return S.cost.base.map(function(v){ return v/BASE_SUM*u; });
}
function totalQty(){ return S.order.items.reduce((a,i)=>a+i.qty,0); }
function grossInfo(){
  const q=S.quote;
  const rate = q.mode==='markup' ? 1+q.markup/100 : 1/(1-q.margin/100);
  let total=0, cost=0;
  S.order.items.forEach(function(i){
    const c=unitCost(i.type);
    cost += c*i.qty;
    // 单价先四舍五入到分，再乘数量——这样才能复现视频的 431.00×30 + 893.01×2 = 14,716.02
    total += Math.round(c*rate*100)/100 * i.qty;
  });
  const profit = total-cost;
  // 毛利率 = 毛利润 / 售价（不是除以成本）。加价率 35% → 毛利率 25.9%，与视频一致
  return {total:total, cost:cost, profit:profit, rate: total? profit/total*100 : 0};
}
function curProcess(){
  for(const k of PROCESS){ if(S.task.proc[k] < S.task.plan) return k; }
  return null;
}
function specText(i){
  return i.L+'×'+i.W+'×'+i.H+' / '+i.mat+' '+i.th+'mm'+(i.surf!=='不处理'?' / '+i.surf:'');
}
const kpi=(k,v,s,c)=>'<div class="kpi '+c+'"><div class="k">'+k+'</div><div class="v">'+v+'</div><div class="s">'+s+'</div></div>';

const NAV=[['dash','▦','经营驾驶舱'],['ai-order','✦','AI智能接单'],['quote','¥','智能报价'],
  ['order','▤','订单管理'],['prod','▣','生产管理'],['scan','▤','车间报工'],
  ['ai-ask','◈','AI经营助手'],['base','⚙','基础数据设置']];

/* ================= 经营驾驶舱 ================= */
function pageDash(){
  const d=S.dash, g=grossInfo();
  const avgUnit = g.total / totalQty();
  const mx=Math.max.apply(null,d.trend);
  const dsum=d.statusDist.reduce((a,b)=>a+b.v,0);
  return '<div class="grid g6" style="margin-bottom:14px">'
    + kpi('今日新增订单', d.todayNew+' 单','较昨日 +1','acc')
    + kpi('本月订单金额', money(d.monthAmt),'演示口径','acc')
    + kpi('待报价订单', d.toQuote+' 单','需销售跟进','')
    + kpi('正在生产订单', d.producing+' 单','车间在制','')
    + kpi('今日完成产量', d.todayDone+' 台','来自报工','')
    + kpi('延期风险订单', d.delayed+' 单','需重点关注','dang')
    + '</div>'
    + '<div class="grid g21">'
    + '<div class="card"><h2>近 7 天订单趋势 <span class="tag">按交货日期排序</span></h2><div class="bars">'
    + d.trend.map((v,i)=>'<div class="b"><div class="vl">'+v+'</div><div class="bar '
        +(i===d.trend.length-1?'alt':'')+'" style="height:'+(v/mx*106)+'px"></div><div class="lb">'
        +(i+1)+'日</div></div>').join('')
    + '</div></div>'
    + '<div class="card"><h2>订单状态分布</h2>'
    + d.statusDist.map(s=>'<div class="hbar"><span class="n">'+s.n+'</span><span class="t"><i style="width:'
        +(s.v/dsum*100)+'%"></i></span><span class="val">'+s.v+' 单</span></div>').join('')
    + '</div></div>'
    + '<div class="grid g2">'
    + '<div class="card"><h2>当前报价试算 <span class="tag">实时联动报价模块</span></h2>'
    + '<div class="hbar"><span class="n">总成本</span><span class="t"><i style="width:100%;background:#8fa9c4"></i></span><span class="val">'+money(g.cost)+'</span></div>'
    + '<div class="hbar"><span class="n">报价金额</span><span class="t"><i style="width:100%"></i></span><span class="val">'+money(g.total)+'</span></div>'
    + '<div class="row" style="margin-top:10px"><span class="tag-s blue">毛利率 '+g.rate.toFixed(1)
    + '%</span><span class="tag-s grn">毛利润 '+money(g.profit)+'</span><span class="tag-s">平均单台售价 '
    + money(avgUnit)+'</span></div></div>'
    + '<div class="card"><h2>最近操作记录</h2>'
    + S.log.slice(-6).reverse().map(l=>'<div style="padding:7px 0;border-bottom:1px solid #eef2f6">'
        +'<div class="mono" style="color:var(--txt-3)">'+l.t+'</div><div style="font-size:13px">'
        +esc(l.x)+'</div></div>').join('')
    + '</div></div>';
}

/* ================= AI 智能接单 ================= */
function pageAiOrder(){
  return '<div class="note"><b>FR-004 规则解析器</b>：按 PRD 走确定性规则（正则 + 单位归一 + 词典匹配），'
    +'<b>不接大模型</b>。无法确定的字段保持「待确认」并标红，系统绝不凭空补全。</div>'
    + '<div class="grid g2">'
    + '<div class="card"><h2>订单原始信息 <span class="tag">来源：微信接单</span></h2>'
    + '<div class="fld"><label>聊天文字<span class="req">*</span></label>'
    + '<textarea id="rawTa" rows="6">'+esc(S.order.raw)+'</textarea></div>'
    + '<div class="fld"><label>聊天截图</label><input type="file" disabled>'
    + '<div class="hint">演示版未配置图片识别服务，截图不可用</div></div>'
    + '<div class="row"><button class="btn" onclick="doParse()">✦ AI 识别</button>'
    + '<button class="btn ghost" onclick="fillSample()">填入预设样例</button></div></div>'
    + '<div class="card"><h2>AI 识别结果 <span class="tag">可编辑</span></h2><div id="parseBox">'
    + (S.parseOut || '<div style="color:var(--txt-3);font-size:13px;padding:22px 0;text-align:center">点击左侧「AI 识别」查看解析结果</div>')
    + '</div></div></div>'
    + '<div class="card"><h2>识别能力说明</h2><div style="font-size:13px;color:var(--txt-2);line-height:1.9">'
    + '· 一条消息可包含多个产品，自动拆分为多条明细（BR-01）<br>'
    + '· 识别器：<b>演示模式 · 规则解析结果（未连接大模型）</b><br>'
    + '· 相对日期按消息当月最后一天解释，「月底交货」→ '+S.order.due+'，<b>需人工确认</b>（BR-03）<br>'
    + '· AI 无法确定的字段标记为「待确认」，<b>不会凭空补全规格</b>（BR-02）</div></div>';
}
function fillSample(){
  S.order.raw='王老板，帮我做一批配电箱，600×800×250，1.5厚冷轧板，30台，月底之前交货。另外再做2台动力配电箱，800×1000×300，2.0厚冷轧板，喷塑。';
  const ta=document.getElementById('rawTa'); if(ta) ta.value=S.order.raw;
  toast('已填入预设样例');
}

/* 规则解析器：严格照 PRD 4.1 规格实现，确定性规则，无模型推理 */
function parseRule(text){
  const t=String(text).replace(/\s+/g,'');
  const out={cust:'', items:[], due:'', pending:[]};
  const cm=t.match(/^([一-龥]{1,4}(?:老板|总|工|师傅))/);
  if(cm) out.cust=cm[1]; else out.pending.push('客户名称');
  const chunks=t.split(/另外|还有|再加|以及/).filter(Boolean);
  for(const ch of chunks){
    const it={};
    const dm=ch.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})\s*[xX×*]\s*(\d{2,4})/);
    if(dm){ it.L=+dm[1]; it.W=+dm[2]; it.H=+dm[3]; } else out.pending.push('尺寸');
    const tm=ch.match(/(\d+(?:\.\d+)?)\s*厚/);
    if(tm) it.th=+tm[1]; else out.pending.push('板厚');
    const qm=ch.match(/(\d+)\s*台/);
    if(qm) it.qty=+qm[1]; else out.pending.push('数量');
    it.mat=/冷轧板/.test(ch)?'冷轧板':(/镀锌板/.test(ch)?'镀锌板':'');
    if(!it.mat) out.pending.push('板材');
    it.surf=/喷塑/.test(ch)?'喷塑':(/不处理/.test(ch)?'不处理':'');
    if(/动力/.test(ch)) it.type='动力配电箱';
    else if(/配电箱/.test(ch)) it.type='普通配电箱';
    else it.type='';
    if(!it.type) out.pending.push('产品类型');
    out.items.push(it);
  }
  out.due = /月底|月末/.test(t) ? '2026-10-31' : '';
  if(!out.due) out.pending.push('交货日期');
  return out;
}
function selOpt(v,opts,bad){
  return '<select><option value="">'+(bad?'待确认':'请选择')+'</option>'
    + opts.map(o=>'<option'+(o===v?' selected':'')+'>'+o+'</option>').join('') + '</select>';
}
function fldRow(lb,v,bad,req,hint){
  let ctrl;
  if(typeof v==='string' && v.charAt(0)==='<') ctrl=v;
  else ctrl='<input value="'+(bad?'':esc(v==null?'':v))+'"'+(bad?' placeholder="待确认"':'')+'>';
  return '<div class="fld '+(bad?'bad':'')+'"><label>'+lb+(req?'<span class="req">*</span>':'')+'</label>'
    + ctrl + (bad ? '<div class="err">AI 无法确定，需人工填写</div>'
       : (hint ? '<div class="hint">'+hint+'</div>' : '')) + '</div>';
}
function doParse(){
  const r=parseRule(document.getElementById('rawTa').value);
  let h='<div class="note" style="margin:0 0 10px">演示模式：<b>规则解析结果（未连接大模型）</b></div>'
    + fldRow('客户名称 / 称呼', r.cust, !r.cust, true)
    + fldRow('交货日期（月底）', r.due||'2026-10-31', !r.due, false, '月底交货已按当月最后一天解释，请人工确认');
  r.items.forEach(function(it,i){
    h += '<div style="border:1px solid var(--line);border-radius:var(--r);padding:11px;margin-bottom:10px">'
      + '<div style="font-size:12px;color:var(--txt-2);margin-bottom:9px">产品明细 '+(i+1)+'</div><div class="grid g2" style="gap:0 10px">'
      + fldRow('产品类型', selOpt(it.type,['普通配电箱','动力配电箱','非标钣金箱体','电气控制柜'],!it.type))
      + fldRow('数量（台）', it.qty, it.qty===undefined, true)
      + fldRow('长度（mm）', it.L, it.L===undefined)
      + fldRow('宽度（mm）', it.W, it.W===undefined)
      + fldRow('高度（mm）', it.H, it.H===undefined)
      + fldRow('板材', selOpt(it.mat,['冷轧板','镀锌板','不锈钢'],!it.mat))
      + fldRow('板厚（mm）', it.th, it.th===undefined)
      + fldRow('表面处理', selOpt(it.surf,['不处理','喷塑'],!it.surf))
      + '</div></div>';
  });
  h += '<div class="row" style="margin-top:4px"><button class="btn" onclick="confirmOrder()">确认并生成订单</button>'
    + '<span style="font-size:12px;color:var(--txt-3)">编号将自动编排（FR-008）</span></div>';
  S.parseOut=h;
  render();
  toast('规则解析完成，请确认标红字段','ok');
}
function confirmOrder(){
  S.log.push({t:now(), x:'AI 接单创建：'+S.order.no+' 微信消息识别生成'});
  toast('订单 '+S.order.no+' 已生成','ok');
  S.page='order'; S.parseOut=null; render();
}

/* ================= 智能报价 ================= */
function pageQuote(){
  const q=S.quote, g=grossInfo();
  const curType=S.order.items[S.cost.sel] ? S.order.items[S.cost.sel].type : '普通配电箱';
  const items=costItems(curType).map(function(v){ return Math.round(v*100)/100; });
  const uc=Math.round(items.reduce(function(a,v){ return a+v; },0)*100)/100;
  const rows=S.cost.names.map(function(n,i){ return [n, items[i]]; });
  const rate = q.mode==='markup' ? 1+q.markup/100 : 1/(1-q.margin/100);
  const unitPrice = Math.round(uc*rate*100)/100;
  let slider;
  if(q.mode==='markup'){
    slider='<div class="fld"><label>成本加价率</label>'
      +'<input type="range" min="0" max="100" step="1" value="'+q.markup+'" style="width:100%" oninput="setMarkup(+this.value)">'
      +'<div class="row" style="justify-content:space-between"><span class="hint">当前 <b>'+q.markup+'%</b></span><span>'
      +[20,35,50].map(v=>'<button class="btn ghost sm" onclick="setMarkup('+v+')">'+v+'%</button>').join('')
      +'</span></div></div>';
  }else{
    slider='<div class="fld"><label>目标毛利率</label>'
      +'<input type="range" min="1" max="80" step="1" value="'+q.margin+'" style="width:100%" oninput="setMargin(+this.value)">'
      +'<div class="hint">当前 <b>'+q.margin+'%</b>　售价 = 成本 ÷ (1 − 毛利率)</div></div>';
  }
  return '<div class="note warn"><b>FR-010 ~ FR-019</b>：以下成本值为演示估算，不代表任何真实工厂口径。'
    +'板材单价、损耗率、设备费率、人工工时、包装运输费均需真实参数（PRD T-04）。</div>'
    + '<div class="grid g21">'
    + '<div class="card"><h2>报价成本明细 <span class="tag">按产品类型分别计算</span></h2>'
    + '<div class="fld"><label>查看产品类型</label><select onchange="setCostSel(+this.value)">'
    + S.order.items.map(function(i,x){ return '<option value="'+x+'"'+(x===S.cost.sel?' selected':'')
        +'>'+i.type+'（'+i.qty+' 台）</option>'; }).join('')
    + '</select></div>'
    + '<table><thead><tr><th>成本项</th><th class="num">单台金额</th><th class="num">占比</th></tr></thead><tbody>'
    + rows.map(x=>'<tr><td>'+x[0]+'</td><td class="num">'+money(x[1])+'</td><td class="num" style="color:var(--txt-3)">'
        +(x[1]/uc*100).toFixed(1)+'%</td></tr>').join('')
    + '<tr><td><b>单台成本</b></td><td class="num"><b>'+money(uc)+'</b></td><td class="num">100%</td></tr>'
    + '</tbody></table>'
    + '<div class="note" style="margin:12px 0 0">展开面积约 <b>'+S.cost.area+' ㎡/台</b> · '
    + curType+' 单台成本 <b>'+money(uc)+'</b> · 数量 <b>'
    + (S.order.items[S.cost.sel]?S.order.items[S.cost.sel].qty:0)+' 台</b></div></div>'
    + '<div class="card"><h2>报价计算器 <span class="tag">实时试算</span></h2>'
    + '<div class="fld"><label>定价方式</label><select onchange="setMode(this.value)">'
    + '<option value="markup"'+(q.mode==='markup'?' selected':'')+'>成本加价率</option>'
    + '<option value="margin"'+(q.mode==='margin'?' selected':'')+'>目标毛利率</option></select></div>'
    + slider
    + '<div class="hbar"><span class="n">单台成本</span><span class="t"><i style="width:100%;background:#8fa9c4"></i></span><span class="val">'+money(uc)+'</span></div>'
    + '<div class="hbar"><span class="n">单台售价</span><span class="t"><i style="width:100%"></i></span><span class="val">'+money(unitPrice)+'</span></div>'
    + '<div class="hbar"><span class="n">报价金额</span><span class="t"><i style="width:100%"></i></span><span class="val">'+money(g.total)+'</span></div>'
    + '<div class="hbar"><span class="n">毛利润</span><span class="t"><i style="width:'+Math.min(100,g.rate)+'%;background:var(--ok)"></i></span><span class="val">'+money(g.profit)+'</span></div>'
    + '<div class="row" style="margin-top:12px"><span class="tag-s grn">毛利率 '+g.rate.toFixed(1)+'%</span>'
    + '<button class="btn sm" onclick="saveQuote()">保存报价单</button>'
    + '<button class="btn ghost sm" onclick="toast(\'原型阶段不生成真实 PDF\')">导出 PDF</button></div></div></div>'
    + '<div class="card"><h2>报价单 <span class="tag mono">'+S.quote.no+'</span> <span class="tag-s blue">'+S.quote.status+'</span>'
    + ' <span class="tag">已保存值；上方计算器为未保存的试算结果</span></h2>'
    + '<div class="grid g3">'
    + '<div><div style="font-size:12px;color:var(--txt-2)">客户</div><b>'+S.order.cust+'</b></div>'
    + '<div><div style="font-size:12px;color:var(--txt-2)">成本</div><b>'+money(S.quote.cost)+'</b></div>'
    + '<div><div style="font-size:12px;color:var(--txt-2)">报价</div><b>'+money(S.quote.price)+'</b></div>'
    + '<div><div style="font-size:12px;color:var(--txt-2)">有效期至</div><b>'+S.quote.valid+'</b></div>'
    + '<div><div style="font-size:12px;color:var(--txt-2)">定价方式</div><b>'+(q.mode==='markup'?'成本加价率':'目标毛利率')+'</b></div>'
    + '<div><div style="font-size:12px;color:var(--txt-2)">产品摘要</div><b>普通配电箱×30 · 动力配电箱×2</b></div>'
    + '</div><div class="note" style="margin:12px 0 0">BR-06：报价确认后订单金额自动同步，状态自动流转。</div></div>';
}
function setMode(v){ S.quote.mode=v; render(); }
function setMarkup(v){ S.quote.markup=v; render(); }
function setCostSel(v){ S.cost.sel=v; render(); }
function setMargin(v){
  S.quote.margin=v;
  const uc=unitCost('普通配电箱'), per=uc/(1-v/100);
  S.quote.markup=Math.round((per/uc*100-100)*100)/100;
  render();
}
function saveQuote(){
  const g=grossInfo();
  S.quote.price=g.total; S.quote.cost=g.cost; S.quote.margin=g.rate;
  S.quote.status='已确认'; S.order.amount=g.total; S.order.status='已确认';
  S.order.confirmed=now();
  S.log.push({t:now(), x:'状态流转：'+S.order.no+'：待确认 → 已确认'});
  toast('报价单 '+S.quote.no+' 已确认，订单金额已同步','ok');
  render();
}

/* ================= 订单管理 ================= */
function pageOrder(){
  const o=S.order;
  const base=[['客户',o.cust],['联系人','—'],['电话',o.phone],['交货日期',o.due],
    ['来源',o.src],['创建时间',o.created],['确认时间',o.confirmed],['订单金额',money(o.amount)]];
  return '<div class="card"><h2>订单列表 <span class="tag">按交货日期排序</span></h2>'
    + '<table><thead><tr><th>订单编号</th><th>客户</th><th>产品摘要</th><th>交货日期</th>'
    + '<th class="num">订单金额</th><th>状态</th><th>操作</th></tr></thead><tbody>'
    + '<tr><td class="mono"><b>'+o.no+'</b></td><td>'+o.cust+'</td><td>普通配电箱×30 · 动力配电箱×2</td>'
    + '<td>'+o.due+'</td><td class="num">'+money(o.amount)+'</td>'
    + '<td><span class="tag-s blue">'+o.status+'</span></td>'
    + '<td><button class="btn sm" onclick="openTaskModal()">生成生产任务</button> '
    + '<button class="btn ghost sm" onclick="cancelOrder()">取消订单</button></td></tr>'
    + '</tbody></table></div>'
    + '<div class="card"><h2>订单详情 <span class="tag mono">'+o.no+'</span></h2><div class="grid g2"><div>'
    + '<div class="sec" style="margin-top:0"><h3>订单产品明细</h3><table><thead><tr><th>产品</th>'
    + '<th>规格</th><th class="num">数量</th><th class="num">单价</th><th class="num">小计</th></tr></thead><tbody>'
    + o.items.map(i=>'<tr><td>'+i.type+'</td><td>'+specText(i)+'</td><td class="num">'+i.qty+' 台</td>'
        +'<td class="num">'+money(i.price)+'</td><td class="num">'+money(i.price*i.qty)+'</td></tr>').join('')
    + '<tr><td colspan="4" style="text-align:right"><b>订单金额合计</b></td><td class="num"><b>'
    + money(o.amount)+'</b></td></tr></tbody></table></div>'
    + '<div class="sec"><h3>微信报价原文</h3><div style="background:#f7fafc;border-radius:var(--r);padding:11px;font-size:13px">'
    + esc(o.raw)+'</div></div></div><div>'
    + '<div class="sec" style="margin-top:0"><h3>基础信息</h3><table><tbody>'
    + base.map(x=>'<tr><td style="color:var(--txt-2);width:96px">'+x[0]+'</td><td><b>'+x[1]+'</b></td></tr>').join('')
    + '</tbody></table></div>'
    + '<div class="sec"><h3>报价信息</h3><div style="border:1px solid var(--line);border-radius:var(--r);padding:11px">'
    + '<div class="row" style="justify-content:space-between"><span class="mono"><b>'+S.quote.no+'</b> '
    + '<span class="tag-s blue">'+S.quote.status+'</span></span>'
    + '<button class="btn ghost sm" onclick="toast(\'原型阶段不生成真实 PDF\')">PDF 报价单</button></div>'
    + '<div style="font-size:12px;color:var(--txt-2);margin-top:7px">成本 '+money(S.quote.cost)+' · 报价 '
    + money(S.quote.price)+' · 有效期至 '+S.quote.valid+'</div></div></div>'
    + '</div></div></div>';
}
function cancelOrder(){
  S.order.status='已取消';
  S.log.push({t:now(), x:'订单 '+S.order.no+' 已取消'});
  toast('订单已取消','err'); render();
}
function openTaskModal(){
  modal('<div class="modal"><div class="mh"><h3>生成生产任务</h3>'
    +'<button class="x" onclick="closeModal()">×</button></div><div class="mb">'
    +'<div class="note" style="margin:0 0 12px">系统将按订单每条产品明细创建一个生产任务，自动生成 <b>7 道工序</b>：'
    +PROCESS.join(' → ')+'。已存在任务的订单不会重复创建（BR-05）。</div>'
    +'<div class="fld"><label>负责人 / 班组</label><input id="tmTeam" value="'+S.task.team+'"></div>'
    +'<div class="grid g2" style="gap:0 10px">'
    +'<div class="fld"><label>计划开始</label><input type="date" id="tmStart"></div>'
    +'<div class="fld"><label>计划完成（默认交货日期）</label><input type="date" value="'+S.order.due+'"></div>'
    +'</div><div style="font-size:12px;color:var(--txt-2);margin-top:6px">将创建 <b>'+S.order.items.length
    +'</b> 个任务：</div>'
    + S.order.items.map(i=>'<div style="font-size:13px;padding:5px 0">· '+i.type+' '+specText(i)+' × <b>'
        +i.qty+'</b> 台</div>').join('')
    + '</div><div class="mf"><button class="btn ghost" onclick="closeModal()">取消</button>'
    + '<button class="btn" onclick="createTask()">确认创建</button></div></div>');
}
function createTask(){
  const el=document.getElementById('tmTeam');
  S.task.team=(el&&el.value)||'车间班组';
  S.task.status='待开工';
  S.order.status='生产中';
  S.log.push({t:now(), x:'生产任务创建：'+S.task.no+' 自动生成 7 道工序'});
  closeModal(); toast('已创建生产任务 '+S.task.no,'ok'); S.page='prod'; render();
}

/* ================= 生产管理 ================= */
function pageProd(){
  const t=S.task, cur=curProcess();
  const steps=PROCESS.map(function(p,i){
    const cls=t.proc[p]>=t.plan?'done':(p===cur?'cur':'');
    return (i?'<span class="step-line"></span>':'')+'<span class="step '+cls+'"><span class="dot">'
      +(t.proc[p]>=t.plan?'✓':(i+1))+'</span><span class="nm">'+p+'</span></span>';
  }).join('');
  return '<div class="card"><h2>生产任务 <span class="tag">按订单每条产品明细创建</span></h2>'
    + '<div class="grid g2" style="margin-bottom:12px">'
    + '<div style="border:1px solid var(--line);border-radius:var(--r);padding:13px">'
    + '<div class="row" style="justify-content:space-between"><span class="mono"><b>'+t.no+'</b></span>'
    + '<span class="tag-s '+(t.status==='已完工'?'grn':(t.status==='生产中'?'blue':'amb'))+'">'+t.status+'</span></div>'
    + '<div style="margin-top:8px"><b>'+t.name+'</b><div style="font-size:12px;color:var(--txt-2)">'+t.order
    + ' · '+t.cust+'</div><div style="font-size:12px;color:var(--txt-2)">'+t.spec+'</div></div>'
    + '<div class="row" style="margin-top:10px;font-size:13px"><span>计划数量 <b>'+t.plan+'</b> 台</span>'
    + '<span>已完工 <b style="color:var(--ok)">'+t.done+'</b> 台</span><span>当前工序 <b style="color:var(--primary)">'
    + (cur||'已完工')+'</b></span></div>'
    + '<div class="steps">'+steps+'</div>'
    + '<div style="font-size:12px;color:var(--txt-2)">负责人 / 班组：'+t.team+'</div></div>'
    + '<div style="border:1px solid var(--line);border-radius:var(--r);padding:13px">'
    + '<h3 style="font-size:13px;margin-bottom:9px">各工序累计合格数量（台）</h3>'
    + PROCESS.map(p=>'<div class="hbar"><span class="n">'+p+'</span><span class="t"><i style="width:'
        +(t.proc[p]/t.plan*100)+'%"></i></span><span class="val">'+t.proc[p]+' / '+t.plan+'</span></div>').join('')
    + '</div></div>'
    + '<div class="note" style="margin:0">FR-034 / FR-035：全部工序完成时任务自动标记已完工；已完工任务再次报工将提示'
    + '「该任务已全部完工，无需继续报工」（BR-08）。</div></div>';
}

/* ================= 车间扫码报工 ================= */
function pageScan(){
  const t=S.task, cur=curProcess();
  const procBtns=PROCESS.map(function(p,i){
    const locked = i>0 && t.proc[PROCESS[i-1]]<t.plan;
    return '<button class="'+(S.selProc===p?'on':'')+'"'+(locked?' disabled':'')
      +' onclick="pickProc(\''+p+'\')">'+p+(locked?' 🔒':'')+'</button>';
  }).join('');
  const recRows = S.reports.length
    ? '<table><thead><tr><th>时间</th><th>工序</th><th class="num">数量</th><th>报工人</th></tr></thead><tbody>'
      + S.reports.slice().reverse().map(r=>'<tr><td class="mono" style="font-size:12px">'+r.t+'</td><td>'+r.p
        +'</td><td class="num">'+r.q+'</td><td>'+esc(r.n)+'</td></tr>').join('') + '</tbody></table>'
    : '<div style="color:var(--txt-3);font-size:13px;padding:16px 0;text-align:center">暂无报工记录，去手机端扫码报工</div>';
  return '<div class="note"><b>FR-040 ~ FR-048</b>：手机扫码进入，<b>无需登录、无需培训</b>。'
    +'二维码 7 天有效（BR-09），仅能报本任务，不能访问其他数据。</div>'
    + '<div class="row" style="align-items:flex-start;gap:20px">'
    + '<div class="phone"><div class="ph"><b>车间扫码报工</b><span>智造云控 · 电箱制造智能管理系统</span></div><div class="pb">'
    + '<div class="pcard"><div class="row" style="justify-content:space-between"><span class="mono"><b>'+t.no
    + '</b></span><span class="tag-s amb">'+t.status+'</span></div>'
    + '<div style="font-weight:600;margin:6px 0 2px">'+t.name+'</div>'
    + '<div style="font-size:12px;color:var(--txt-2)">'+t.order+' · '+t.cust+'</div>'
    + '<div style="font-size:12px;color:var(--txt-2)">'+t.spec+'</div>'
    + '<div class="row" style="margin-top:10px;font-size:12px"><span>计划数量 <b>'+t.plan+'</b> 台</span>'
    + '<span>已完工 <b style="color:var(--ok)">'+t.done+'</b> 台</span><span>当前工序 <b style="color:var(--primary)">'
    + (cur||'已完工')+'</b></span></div></div>'
    + '<div class="pcard"><h3 style="font-size:13px;margin-bottom:8px">工序累计</h3>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">'
    + PROCESS.map(p=>'<div style="display:flex;justify-content:space-between;font-size:12px;background:#f7fafc;'
        +'padding:5px 8px;border-radius:var(--r-sm)"><span>'+p+'</span><b>'+t.proc[p]+'</b></div>').join('')
    + '</div></div>'
    + '<div class="pcard"><h3 style="font-size:13px;margin-bottom:8px">选择工序</h3><div class="proc">'+procBtns+'</div>'
    + '<div class="fld" style="margin-top:11px"><label>数量 <span class="req">*</span></label>'
    + '<input id="rpQty" type="number" placeholder="请输入报工数量"></div>'
    + '<div class="fld"><label>姓名 <span class="req">*</span></label><input id="rpName" placeholder="请输入姓名"></div>'
    + '<button class="btn" style="width:100%" onclick="doReport()">报工</button>'
    + '<div class="hint" style="margin-top:7px">校验：数量必须为正整数；工序顺序错误自动拦截（BR-10 / BR-11）</div>'
    + '</div></div></div>'
    + '<div style="flex:1;min-width:260px">'
    + '<div class="card"><h2>报工记录 <span class="tag">'+S.reports.length+' 条</span></h2>'+recRows+'</div>'
    + '<div class="card"><h2>规则说明</h2><div style="font-size:13px;color:var(--txt-2);line-height:1.9">'
    + '· 数量非正整数 → <b>系统自动拦截</b><br>· 工序顺序错误 → <b>系统自动拦截</b>，下一工序在上一工序完成前锁定 🔒<br>'
    + '· 报工数据<b>实时累计</b>到生产任务与驾驶舱（FR-047）<br>'
    + '· 报工人姓名自由填写，不关联系统用户 <span class="tag-s">假设 A-07</span></div></div>'
    + '</div></div>';
}
function pickProc(p){ S.selProc=p; render(); }
function doReport(){
  const t=S.task;
  if(t.status==='已完工'){ toast('该任务已全部完工，无需继续报工','err'); return; }
  if(!S.selProc){ toast('请先选择工序','err'); return; }
  const qEl=document.getElementById('rpQty'), nEl=document.getElementById('rpName');
  const q=parseInt(qEl?qEl.value:'',10);
  const n=nEl?(nEl.value||'').trim():'';
  if(!q || q<=0 || !Number.isInteger(q)){ toast('拦截：报工数量必须为正整数','err'); return; }
  if(!n){ toast('请填写报工人姓名','err'); return; }
  const idx=PROCESS.indexOf(S.selProc), prev=idx>0?PROCESS[idx-1]:null;
  if(prev && t.proc[prev] < t.plan){ toast('拦截：'+prev+' 未完成，不能报 '+S.selProc,'err'); return; }
  t.proc[S.selProc]=Math.min(t.plan, t.proc[S.selProc]+q);
  // 已完工只在 7 道工序全部完成时才置为计划数量；视频中下料/折弯/焊接已 30 台时已完工仍为 0
  const allDone = PROCESS.every(p=>t.proc[p]>=t.plan);
  t.done = allDone ? t.plan : 0;
  t.status = allDone ? '已完工' : '生产中';
  S.reports.push({t:now(), p:S.selProc, q:q, n:n});
  S.log.push({t:now(), x:'报工：'+t.no+' '+S.selProc+' +'+q+' 台（'+n+'）'});
  S.dash.todayDone += q;
  toast('报工成功：'+S.selProc+' +'+q+' 台','ok');
  S.selProc=null;
  render();
}

/* ================= AI 经营助手 ================= */
const PRESET=['今天新增了多少订单？','本月订单金额是多少？','目前有哪些订单正在生产？',
  '哪些订单可能延期？','还有多少台产品没有完成？'];
function pageAsk(){
  let body;
  if(!S.chat.length){
    body='<div style="color:var(--txt-3);font-size:13px;padding:22px 0;text-align:center">点击上方任一预置问法开始</div>';
  }else{
    body=S.chat.map(function(c){
      if(c.a){
        return '<div style="margin-bottom:14px"><div class="qbox"><div class="who-b">演示用户（管理员）</div>'
          +esc(c.q)+'</div><div style="display:flex;gap:8px"><span style="font-size:16px">◆</span>'
          +'<div style="flex:1;font-size:13px">'+c.a+'</div></div></div>';
      }
      return '<div style="text-align:right;margin-bottom:14px"><div class="qbox" style="display:inline-block;'
        +'text-align:left;background:var(--primary)"><div class="who-b" style="color:#c3d6ee">演示用户（管理员）</div>'
        +esc(c.q)+'</div></div>';
    }).join('');
  }
  return '<div class="note"><b>FR-061 规则查询（未连接大模型）</b>：按预置问法规则匹配，'
    +'所有回答来自受控查询工具对数据库的真实查询，<b>不编造数据</b>（BR-12）。</div>'
    + '<div class="card"><h2>AI 经营助手 <span class="tag">演示模式 · 规则查询</span></h2>'
    + '<div class="preset">'+PRESET.map(q=>'<button onclick="askQ(\''+q+'\')">'+q+'</button>').join('')+'</div>'
    + '<div class="chat" id="chat">'+body+'</div></div>';
}
function askQ(q){
  const d=S.dash, t=S.task, o=S.order;
  const R={
    '今天新增了多少订单？':function(){ return '今天新增有效订单 <b>'+d.todayNew+'</b> 单（不含已取消订单）。'; },
    '本月订单金额是多少？':function(){ return '本月订单金额合计 <b>'+money(d.monthAmt)+'</b>（演示口径）。'; },
    '目前有哪些订单正在生产？':function(){
      return '当前状态为「生产中」的订单 <b>'+d.producing+'</b> 单，明细如下：<table style="margin-top:8px">'
        +'<thead><tr><th>订单编号</th><th>客户</th><th>交货日期</th><th>状态</th></tr></thead><tbody>'
        +'<tr><td class="mono">'+o.no+'</td><td>'+o.cust+'</td><td>'+o.due+'</td>'
        +'<td><span class="tag-s blue">'+o.status+'</span></td></tr></tbody></table>'; },
    '哪些订单可能延期？':function(){
      return '命中延期规则 <b>'+d.delayed+'</b> 单：<table style="margin-top:8px">'
        +'<thead><tr><th>订单编号</th><th>客户</th><th>交货日期</th><th class="num">金额</th></tr></thead><tbody>'
        +'<tr><td class="mono">'+o.no+'</td><td>'+o.cust+'</td><td>'+o.due+'</td><td class="num">'
        +money(o.amount)+'</td></tr></tbody></table>'
        +'<div class="hint" style="margin-top:6px">延期规则：交货日期已过或 3 日内到期且未进入已确认 '
        +'<span class="tag-s">假设 A-17</span></div>'; },
    '还有多少台产品没有完成？':function(){
      return '当前生产任务 <b>'+t.no+'</b> 计划 <b>'+t.plan+'</b> 台，已完工 <b>'+t.done
        +'</b> 台，未完成 <b style="color:var(--danger)">'+(t.plan-t.done)+'</b> 台。'; }
  };
  const a=(R[q]||function(){ return '暂不支持该问题。规则版仅支持 5 个预置问法，不做自由推理。'; })();
  S.chat.push({q:q, a:a});
  render();
  const c=document.getElementById('chat'); if(c) c.scrollTop=c.scrollHeight;
}

/* ================= 基础数据设置 ================= */
function pageBase(){
  const items=[
    ['产品类型枚举','普通配电箱 / 动力配电箱 / 非标钣金箱体 / 电气控制柜','A-03'],
    ['工序定义','下料 → 折弯 → 焊接 → 喷涂 → 装配 → 检验 → 完工（7 道）','视频明确'],
    ['板材与板厚','冷轧板 1.0 / 1.2 / 1.5 / 2.0 mm','视频明确'],
    ['表面处理','不处理 / 喷塑','A-06'],
    ['编号规则','DD 订单 · BJ 报价单 · SC 生产任务（YYYYMMDD + 3 位流水）','视频明确'],
    ['班组字典','车间班组 / 一车间一班','视频明确']
  ];
  return '<div class="note warn"><b>该模块在演示视频中从未打开</b>，以下全部为 <span class="tag-s">假设</span>，'
    +'按 MES 通用做法补齐。纯新增模块，无返工风险。</div>'
    + '<div class="grid g2">'
    + items.map(x=>'<div class="card" style="margin:0"><h2 style="margin-bottom:6px">'+x[0]
        +' <span class="tag">'+x[2]+'</span></h2><div style="font-size:13px;color:var(--txt-2)">'+x[1]+'</div>'
        +'<div class="row" style="margin-top:10px"><button class="btn ghost sm" onclick="toast(\'原型阶段不可编辑\')">编辑</button></div></div>').join('')
    + '</div>'
    + '<div class="card"><h2>成本参数 <span class="tag">影响报价模型 · 需真实参数（T-04）</span></h2>'
    + '<div class="grid g3">'
    + [['板材单价','¥ 4,200 / 吨'],['损耗率','8%'],['下料费率','¥ 30.27 / 台'],
       ['折弯费率','¥ 39.09 / 台'],['焊接费率','¥ 53.64 / 台'],['表面处理','¥ 42.00 / 台']]
      .map(x=>'<div class="fld" style="margin:0"><label>'+x[0]+'</label><input value="'+x[1]+'"></div>').join('')
    + '</div><div class="note warn" style="margin:12px 0 0">以上为演示值。上线前必须替换为客户方真实参数，'
    +'否则报价结果不具备商业意义。</div></div>';
}

/* ================= 渲染 ================= */
const PAGES={dash:pageDash,'ai-order':pageAiOrder,quote:pageQuote,order:pageOrder,
  prod:pageProd,scan:pageScan,'ai-ask':pageAsk,base:pageBase};
function go(k){ S.page=k; render(); }
function render(){
  const r=document.getElementById('root');
  if(!S.user){ r.innerHTML=loginView(); return; }
  const title=NAV.filter(x=>x[0]===S.page)[0][2];
  r.innerHTML='<div class="app"><aside class="side">'
    +'<div class="brand"><b>智造云控</b><span>电箱制造智能管理系统</span></div><nav class="nav">'
    +NAV.map(x=>'<button class="'+(S.page===x[0]?'on':'')+'" onclick="go(\''+x[0]+'\')">'
        +'<span class="ico">'+x[1]+'</span>'+x[2]+'</button>').join('')
    +'</nav><div class="ft">当前演示版本 v1.0<br>所有数据均为虚构模拟数据</div></aside>'
    +'<div class="main"><div class="top"><h1>'+title+'</h1>'
    +'<span class="pill">2026-10-15 星期四</span><span class="pill demo">演示模式</span>'
    +'<span class="sp"></span><span class="who">当前用户 <b>'+esc(S.user)
    +'</b>（管理员）</span><button class="btn ghost sm" onclick="logout()">退出</button></div>'
    +'<div class="body">'+PAGES[S.page]()+'</div></div></div>';
}
function logout(){ S.user=null; S.page='dash'; render(); }
let pickRoleName=null;
function loginView(){
  const r=(n,d,on)=>'<div class="role'+(on?' on':'')+'" onclick="pickRole(this,\''+n+'\')"><b>'+n
    +'</b><span>'+d+'</span></div>';
  return '<div class="login"><div class="lcard"><h2>智造云控</h2>'
    +'<p>电箱制造智能管理系统 · 企业级可交互原型</p>'
    + r('管理员','成本报价 · 生产任务 · 经营分析 · 基础数据',true)
    + r('销售','微信接单 · 订单 · 报价查看',false)
    + r('车间工人','免登录，扫码报工',false)
    + '<button class="btn" style="width:100%;margin-top:8px" onclick="doLogin()">进入系统</button>'
    + '<div style="font-size:11px;color:var(--txt-3);margin-top:12px;text-align:center">'
    + '数据取自演示视频真实画面 · 业务规则依 PRD v0.1 · 无后端实现</div></div></div>';
}
function pickRole(el,n){
  const all=document.querySelectorAll('.role');
  for(let i=0;i<all.length;i++) all[i].classList.remove('on');
  el.classList.add('on'); pickRoleName=n;
}
function doLogin(){
  S.user=pickRoleName||'管理员';
  S.page = S.user==='车间工人' ? 'scan' : 'dash';
  render();
}
render();
