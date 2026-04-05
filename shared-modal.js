/* shared-modal.js — 共通モーダル（保存コールバック対応 + メーラーリンク + 施工日確定チェック）【全張り替え版】 */

var FB_URL = "https://project-6745138395263517914-default-rtdb.firebaseio.com";
var modalCommData = null;
var modalContactData = null;

function normalizePhoneModal(raw) {
  if (!raw) return "";
  var s = raw.replace(/[\s\-\(\)\.\u200B\u200C\u200D\uFEFF]/g, "");
  s = s.replace(/^\+81/, "0"); s = s.replace(/^81(?=\d{9,10})/, "0");
  s = s.replace(/[^0-9]/g, ""); return s;
}
function extractEmailModal(f) {
  if (!f) return ""; var m = f.match(/<([^>]+)>/); if (m) return m[1].toLowerCase().trim();
  if (f.indexOf("@") > -1) return f.toLowerCase().trim(); return "";
}
function generateTimeOptions() {
  var o = '<option value="">--:--</option>';
  for (var h = 8; h <= 20; h++) { var hh = ("0"+h).slice(-2); o += '<option value="'+hh+':00">'+hh+':00</option><option value="'+hh+':30">'+hh+':30</option>'; }
  return o;
}
function formatCommDate(dt) {
  try { var d = new Date(dt); return (d.getMonth()+1)+"/"+d.getDate()+" "+("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); } catch(e) { return dt; }
}
function getSafeValModal(c, i) {
  if (!c) return ""; if (Array.isArray(c)) return c.length > i && c[i] != null ? String(c[i]) : ""; if (typeof c === "object") return c[i] != null ? String(c[i]) : ""; return "";
}
function formatToYMDModal(ds) {
  if (!ds) return ""; var d = String(ds).replace(/\s+/g,"").replace(/\//g,"-").replace(/\./g,"-"); var p = d.split("-");
  if (p.length === 3) return p[0]+"-"+String(p[1]).padStart(2,"0")+"-"+String(p[2]).padStart(2,"0"); return d;
}

function extractCaseKeywords(csvData) {
  var kw = [], cn = getSafeValModal(csvData, 4) || "";
  var pts = cn.replace(/【[^】]*】/g," ").replace(/[（()）\[\]]/g," ").split(/[\s\u3000・]+/);
  for (var i = 0; i < pts.length; i++) { var p = pts[i].trim(); if (p.length >= 2 && ["手配","新築","工事","リフォーム","様邸","Free"].indexOf(p) === -1) kw.push(p); }
  var nm = cn.match(/([^\s【】（）]+?)様/); if (nm && nm[1].length >= 2) kw.push(nm[1]);
  return kw;
}
function scoreMessageForCase(body, subj, kw) {
  if (!kw || !kw.length) return 0; var t = ((body||"")+" "+(subj||"")).toLowerCase(); if (!t.trim()) return 0;
  var s = 0; for (var i = 0; i < kw.length; i++) { if (t.indexOf(kw[i].toLowerCase()) !== -1) s += kw[i].length; } return s;
}

function loadCommData(cb) {
  if (modalCommData !== null) { cb(modalCommData); return; }
  fetch(FB_URL+"/app_communications.json").then(function(r){return r.json();}).then(function(d) {
    if (!d) { modalCommData = []; cb([]); return; }
    var a = Array.isArray(d) ? d : Object.values(d); modalCommData = a.filter(function(r){return r!=null;}); cb(modalCommData);
  }).catch(function(){modalCommData=[];cb([]);});
}
function loadContactData(cb) {
  if (modalContactData !== null) { cb(modalContactData); return; }
  fetch(FB_URL+"/app_contacts.json").then(function(r){return r.json();}).then(function(d) {
    if (!d) { modalContactData = {}; cb({}); return; }
    var a = Array.isArray(d) ? d : Object.values(d), map = {};
    for (var i = 0; i < a.length; i++) { if (!a[i]) continue; var e = (a[i].email||"").toLowerCase().trim(); if (e && !map[e]) map[e] = a[i]; }
    modalContactData = map; cb(map);
  }).catch(function(){modalContactData={};cb({});});
}

function findCaseComms(csvData, allComms, contacts, caseKey) {
  var phone = normalizePhoneModal(getSafeValModal(csvData, 6));
  var kw = extractCaseKeywords(csvData);
  var result = [];
  for (var i = 0; i < allComms.length; i++) {
    var rec = allComms[i]; if (!rec) continue;
    if (rec.assignedCase && rec.assignedCase === caseKey) { rec._matchScore = 100; result.push(rec); continue; }
    if (rec.src === "imessage" && phone) {
      if (normalizePhoneModal(rec.contact) === phone) { rec._matchScore = scoreMessageForCase(rec.body, rec.subject, kw); result.push(rec); continue; }
    }
    if (rec.src === "gmail" && contacts && phone) {
      var re = extractEmailModal(rec.contact);
      for (var em in contacts) { var ct = contacts[em]; if (ct.phone && normalizePhoneModal(ct.phone) === phone && em === re) { rec._matchScore = scoreMessageForCase(rec.body, rec.subject, kw); result.push(rec); break; } }
    }
  }
  result.sort(function(a,b) { if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore; return (new Date(b.dt).getTime()||0) - (new Date(a.dt).getTime()||0); });
  return result;
}

function renderCommTimeline(comms) {
  if (!comms || !comms.length) return '<div class="comm-empty">📭 通信なし</div>';
  var html = "", lim = Math.min(comms.length, 50);
  for (var i = 0; i < lim; i++) {
    var r = comms[i], sm = r.src === "imessage", dir = r.dir === "sent" ? "↑送信" : "↓受信";
    var ind = r._matchScore >= 100 ? ' <span style="color:#64b5f6;font-size:9px;">✔ 手動</span>' : r._matchScore > 0 ? ' <span style="color:#ffab40;font-size:9px;">★ KW</span>' : '';
    var bd = r._matchScore >= 100 ? 'border-left:3px solid #64b5f6;' : r._matchScore > 0 ? 'border-left:3px solid #ffab40;' : '';
    html += '<div class="comm-item" style="'+bd+'"><div class="comm-meta"><div><span class="comm-badge '+(sm?"sms":"gmail")+'">'+(sm?"💬":"📧")+'</span> <span class="comm-dir">'+dir+'</span>'+ind+'</div>';
    html += '<span class="comm-time">'+formatCommDate(r.dt)+'</span></div>';
    if (r.subject) html += '<div class="comm-subject">'+r.subject+'</div>';
    if (r.body) { var b = r.body.replace(/</g,"&lt;").replace(/>/g,"&gt;"); if (b.length > 200) b = b.substring(0,200)+"..."; html += '<div class="comm-body">'+b+'</div>'; }
    html += '</div>';
  }
  if (comms.length > 50) html += '<div class="comm-empty">他 '+(comms.length-50)+'件</div>';
  return html;
}

// ★ onSaveCallback: 保存後に呼ばれるコールバック（ダッシュボード再描画等）
function openCaseModal(key, obj, globalHeaders, globalTasks, fullData, firebaseDB, onSaveCallback) {
  var cols = obj.csvData; if (!cols) return;
  var sekouStr = getSafeValModal(cols,2).replace(/\s+/g,"")||"未定";
  var shitamiStr = formatToYMDModal(getSafeValModal(cols,12))||"未定";
  var yoteiStr = obj.date||"未定";
  var ankenText = getSafeValModal(cols,4).trim()||"名称未設定";
  var timeOpts = generateTimeOptions();

  var html = '<div class="modal-header-info">';
  html += '<div class="modal-date-row">🔨 '+sekouStr+' | 📋 '+shitamiStr+' | 📅 '+yoteiStr+'</div>';
  html += '<div class="modal-title-row">🏷️ '+ankenText+' <button id="modal-copy-btn" class="modal-copy-btn">コピー</button></div></div>';

  html += '<div class="modal-section"><h4>📄 CSVデータ</h4><table class="modal-table">';
  for (var idx = 0; idx < globalHeaders.length; idx++) {
    var val = getSafeValModal(cols,idx), dh = val.replace(/\n|\r/g,'<br>'), ct = val.replace(/\s+/g,'');
    if (idx===11&&ct!=="") dh='<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(ct)+'" target="_blank" style="color:#0056b3;font-weight:bold;">🗺️ '+val+'</a>';
    else if (idx===6&&ct!=="") dh='<a href="tel:'+ct+'" style="color:#0056b3;font-weight:bold;">📞 '+val+'</a>';
    html += '<tr><th>'+(globalHeaders[idx]||'列'+(idx+1))+'</th><td>'+dh+'</td></tr>';
  }
  html += '</table></div>';

  // 進捗管理
  html += '<div class="modal-section"><h4 class="green">📝 進捗管理</h4>';
  html += '<div style="margin:10px 0;"><label style="font-weight:bold;font-size:13px;">🚦 ステータス:</label>';
  html += '<div id="kanban-bar" style="margin-top:6px;"></div><div id="kanban-sf-note" style="margin-top:4px;font-size:11px;color:#888;"></div></div>';
  html += '<div class="modal-check-row">';
  html += '<label><input type="checkbox" id="modal-constructionDateConfirmed"'+(obj.constructionDateConfirmed?' checked':'')+'> 🔨 施工日確定</label></div>';
  
  html += '<div class="modal-check-row" style="margin-top:8px; padding-left:20px;">';
  html += '<label><input type="checkbox" id="modal-heardFromCarpenter"'+(obj.heardFromCarpenter?' checked':'')+'> 👨‍🔧 大工さん</label>';
  html += '<label><input type="checkbox" id="modal-heardFromAccountant"'+(obj.heardFromAccountant?' checked':'')+'> 📊 帳場さん</label></div>';
  
  html += '<div class="modal-check-row">';
  html += '<label><input type="checkbox" id="modal-emailSent"'+(obj.emailSent?' checked':'')+'> ✉️ 施工日確認メール済</label>';
  html += '<label><input type="checkbox" id="modal-finalReport"'+(obj.finalReport?' checked':'')+'> 📋 最終報告完了</label></div></div>';

  // スケジュール
  html += '<div class="modal-section"><h4 class="green">📅 下見スケジュール</h4>';
  html += '<div class="modal-input-row"><label>📅 予定日:</label><input type="date" id="modal-date" value="'+(obj.date||'')+'" /></div>';
  html += '<div class="modal-input-row"><label>⏰ 時間:</label><select id="modal-time">'+timeOpts+'</select></div>';
  html += '<div class="modal-input-row"><label>🔢 順:</label><input type="number" id="modal-order" min="1" placeholder="番号" value="'+(obj.order||'')+'" /></div></div>';

  // メモ
  html += '<div class="modal-section"><h4 class="blue">💬 メモ</h4>';
  html += '<textarea class="modal-memo" id="modal-memo" placeholder="メモを入力...">'+(obj.memo||'')+'</textarea></div>';

  // 通信履歴
  html += '<div class="modal-section"><h4 class="orange">📨 通信履歴 <span id="comm-count" class="comm-count">読込中...</span></h4>';
  html += '<div class="comm-timeline" id="modal-comm-area"><div class="comm-empty">⏳ 読み込み中...</div></div></div>';

  // 保存 + メーラーボタン
  html += '<div style="margin-top:18px;text-align:center;">';
  html += '<button class="modal-save-btn" id="modal-save-btn">💾 保存</button>';
  html += '<span class="modal-save-msg" id="modal-save-msg">✔ 保存しました</span>';
  html += '<a id="modal-mailer-link" href="mailer.html?key='+encodeURIComponent(key)+'" class="modal-mailer-btn">✉️ メール送信</a>';
  html += '</div>';

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('modal-time').value = obj.time || '';

  // カンバン（6段階）
  var kanbanStatuses=['依頼','連絡済','下見日確定','下見実施済','報告書提出済','施工日連絡済'];
  var kanbanColors=['#90a4ae','#42a5f5','#ffb300','#66bb6a','#26a69a','#00695c'];
  var sfStatus=getSafeValModal(cols,1).replace(/\s+/g,"");
  var sfMap={'下見実施中':'連絡済','下見日程確定':'下見日確定','下見完了':'報告書提出済'};
  var sfLocal=sfMap[sfStatus]||sfStatus||'依頼';
  var localSt=obj.localStatus||'';
  var sfRank=kanbanStatuses.indexOf(sfLocal);if(sfRank===-1)sfRank=0;
  var localRank=kanbanStatuses.indexOf(localSt);if(localRank===-1)localRank=-1;
  var currentStatus=localRank>=sfRank?localSt:sfLocal;
  if(kanbanStatuses.indexOf(currentStatus)===-1) currentStatus='依頼';

  var kanbanBar=document.getElementById('kanban-bar');var selectedStatus=currentStatus;
  kanbanStatuses.forEach(function(st,i){
    var btn=document.createElement('div');btn.className='kanban-step';
    var isActive=kanbanStatuses.indexOf(selectedStatus)>=i;
    btn.style.background=isActive?kanbanColors[i]:'#f5f5f5';btn.style.color=isActive?'#fff':'#999';btn.textContent=st;
    btn.addEventListener('click',function(){selectedStatus=st;var bs=kanbanBar.children;for(var j=0;j<bs.length;j++){var a=kanbanStatuses.indexOf(st)>=j;bs[j].style.background=a?kanbanColors[j]:'#f5f5f5';bs[j].style.color=a?'#fff':'#999';}});
    kanbanBar.appendChild(btn);
  });
  document.getElementById('kanban-sf-note').textContent='SF: '+sfStatus+' → ローカル: '+currentStatus;

  // コピー
  document.getElementById('modal-copy-btn').addEventListener('click',function(){var self=this;navigator.clipboard.writeText(ankenText).then(function(){self.textContent="✔";self.classList.add('copied');setTimeout(function(){self.textContent="コピー";self.classList.remove('copied');},2000);});});

  // ★ 保存（コールバック付き）
  document.getElementById('modal-save-btn').addEventListener('click',function(){
    var nd=document.getElementById('modal-date').value;
    var nt=document.getElementById('modal-time').value;
    var no=document.getElementById('modal-order').value;
    var cdc=document.getElementById('modal-constructionDateConfirmed').checked;
    var hfc=document.getElementById('modal-heardFromCarpenter').checked;
    var hfa=document.getElementById('modal-heardFromAccountant').checked;
    var es=document.getElementById('modal-emailSent').checked;
    var fr=document.getElementById('modal-finalReport').checked;
    var memo=document.getElementById('modal-memo').value;

    var updates={date:nd,time:nt,order:no,localStatus:selectedStatus,constructionDateConfirmed:cdc,heardFromCarpenter:hfc,heardFromAccountant:hfa,emailSent:es,finalReport:fr,memo:memo};
    firebaseDB.ref('app_tasks/'+key).update(updates);

    globalTasks[key].date=nd;globalTasks[key].time=nt;globalTasks[key].order=no;
    globalTasks[key].localStatus=selectedStatus;globalTasks[key].constructionDateConfirmed=cdc;
    globalTasks[key].heardFromCarpenter=hfc;globalTasks[key].heardFromAccountant=hfa;
    globalTasks[key].emailSent=es;globalTasks[key].finalReport=fr;globalTasks[key].memo=memo;
    if(fullData){fullData.app_tasks=globalTasks;localStorage.setItem('appData',JSON.stringify(fullData));}

    document.querySelector('.modal-date-row').innerHTML='🔨 '+sekouStr+' | 📋 '+shitamiStr+' | 📅 '+(nd||"未定");
    document.getElementById('kanban-sf-note').textContent='SF: '+sfStatus+' → ローカル: '+selectedStatus;

    var msg=document.getElementById('modal-save-msg');
    msg.style.display='inline';setTimeout(function(){msg.style.display='none';},2000);

    if(typeof onSaveCallback==='function') onSaveCallback();
  });

  // 通信履歴
  loadCommData(function(allComms){loadContactData(function(contacts){
    var cc=findCaseComms(cols,allComms,contacts,key);
    var kwC=0,manC=0;for(var k=0;k<cc.length;k++){if(cc[k]._matchScore>=100)manC++;else if(cc[k]._matchScore>0)kwC++;}
    document.getElementById('modal-comm-area').innerHTML=renderCommTimeline(cc);
    document.getElementById('comm-count').textContent=cc.length+'件（手動:'+manC+' KW:'+kwC+'）';
  });});

  // 閉じる
  document.getElementById('modal-close').addEventListener('click',function(){document.getElementById('modal-overlay').style.display='none';});
  document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
}
