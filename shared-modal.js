/* shared-modal.js — 共通モーダル【全即時保存版・通信履歴機能削除済・現場チェック追加・日時重複チェック強化版・連絡区分チェック追加】*/
// VERSION: 2026-08-19

var FB_URL = "https://project-6745138395263517914-default-rtdb.firebaseio.com";

var SITECHECK_GROUPS = [
  { title: '床暖まわり', items: [
    ['床暖','yukadan'],['巾木厚さ','habakiAtsusa'],['搬入時刻','hannyuJikoku'],
    ['電動シャッター','dendouShutter'],['追い焚き有無','oidaki'],
    ['角依頼(屋さん合番)','kadoIraiYasan'],['依頼状況','iraiJoukyou'],
    ['クラウド報告','cloudHoukoku'],['施工日確認(帳場さん)','sekoKakuninBanba']
  ]},
  { title: '養生まわり', items: [
    ['養生','yousei'],['図面吊戸棚高','zumenTsuridanaTakasa'],['図面天井高','zumenTenjouTakasa'],
    ['レンジフード変更','rangeHoodHenkou'],['天井高さ','tenjouTakasa'],['施工日確認(相手)','sekoKakuninAite']
  ]},
  { title: '窓台まわり', items: [
    ['窓台高さ','madodaiTakasa'],['天吊りフード','tentsuriHood'],['ニッチ','nicchi'],
    ['SK下がり壁','skSagariKabe'],['CB下がり壁','cbSagariKabe'],['設備','setsubi'],
    ['KP貼り方','kpHarikata'],['コンセント','consent'],['ダクト','duct']
  ]},
  { title: '大工完了まわり', items: [
    ['大工完了','daikuKanryo'],['搬入経路','hannyuKeiro'],['パネルカット','panelCut'],
    ['駐車スペース','chuushaSpace'],['写メ','shame'],['キーBOX','keyBox'],
    ['SK下地','skShita'],['天板下地','tenbanShita'],['CB下地','cbShita']
  ]}
];

function normalizePhoneModal(raw) {
  if (!raw) return "";
  var s = raw.replace(/[\s\-\(\)\.\u200B\u200C\u200D\uFEFF]/g, "");
  s = s.replace(/^\+81/, "0"); s = s.replace(/^81(?=\d{9,10})/, "0");
  s = s.replace(/[^0-9]/g, ""); return s;
}
function generateTimeOptions() {
  var o = '<option value="">--:--</option>';
  for (var h = 8; h <= 20; h++) { var hh = ("0"+h).slice(-2); o += '<option value="'+hh+':00">'+hh+':00</option><option value="'+hh+':30">'+hh+':30</option>'; }
  return o;
}
function getSafeValModal(c, i) {
  if (!c) return ""; if (Array.isArray(c)) return c.length > i && c[i] != null ? String(c[i]) : ""; if (typeof c === "object") return c[i] != null ? String(c[i]) : ""; return "";
}
function formatToYMDModal(ds) {
  if (!ds) return ""; var d = String(ds).replace(/\s+/g,"").replace(/\//g,"-").replace(/\./g,"-"); var p = d.split("-");
  if (p.length === 3) return p[0]+"-"+String(p[1]).padStart(2,"0")+"-"+String(p[2]).padStart(2,"0"); return d;
}

// ============ 日時重複チェック（同時刻＝入力不可／前後72分＝警告のみ） ============
function timeToMinutesModal(t) {
  if (!t) return null;
  var p = String(t).split(':');
  if (p.length < 2) return null;
  var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
// 住所文字列から簡易エリア名（区・市・郡など）を抽出。移動時間の妥当性を判断する材料として警告文に添える。
function extractAreaModal(addr) {
  if (!addr) return '';
  var a = String(addr).replace(/\s+/g, '');
  var s = a.match(/札幌市(.+?区)/); if (s) return s[1];
  var c = a.match(/北海道(.+?市)/); if (c && c[1].indexOf('札幌') === -1) return c[1];
  var t = a.match(/郡(.+?[町村])/); if (t) return t[1];
  return '';
}
// 指定の日付・時間について、同じ対象者の他案件(globalTasks)と仮予約(kariData)を突き合わせる。
// exact=同時刻（入力不可）／nearby=前後72分以内（警告のみ）。selfKeyは自分自身の案件を除外するため。
function findConflictsModal(date, time, selfKey, globalTasks, kariData) {
  var exact = [], nearby = [];
  var tMin = timeToMinutesModal(time);
  if (!date || tMin == null) return { exact: exact, nearby: nearby };
  Object.keys(globalTasks || {}).forEach(function (k) {
    if (k === selfKey) return;
    var o = globalTasks[k];
    if (!o || o.date !== date || !o.time) return;
    var oMin = timeToMinutesModal(o.time);
    if (oMin == null) return;
    var area = extractAreaModal(o.csvData && o.csvData[11]);
    var label = o.time + ' ' + ((o.csvData && o.csvData[4]) ? o.csvData[4] : k) + (area ? '【' + area + '】' : '');
    if (oMin === tMin) exact.push(label);
    else if (Math.abs(oMin - tMin) <= 72) nearby.push(label);
  });
  if (kariData && kariData[date]) {
    Object.keys(kariData[date]).forEach(function (kid) {
      var e = kariData[date][kid];
      if (!e || !e.start) return;
      var eMin = timeToMinutesModal(e.start);
      if (eMin == null) return;
      var st = e.status === '確定' ? '✅確定' : '🟠仮予約';
      var label = e.start + ' ' + st + '：' + (e.case_name || '') + (e.tantou ? '（' + e.tantou + '）' : '') + (e.area ? '【' + e.area + '】' : '');
      if (eMin === tMin) exact.push(label);
      else if (Math.abs(eMin - tMin) <= 72) nearby.push(label);
    });
  }
  return { exact: exact, nearby: nearby };
}

function openCaseModal(key, obj, globalHeaders, globalTasks, fullData, firebaseDB, onSaveCallback) {
  var cols = obj.csvData; if (!cols) return;
  var sekouStr = getSafeValModal(cols,2).replace(/\s+/g,"")||"未定";
  var shitamiStr = formatToYMDModal(getSafeValModal(cols,12))||"未定";
  var yoteiStr = obj.date||"未定";
  var ankenText = getSafeValModal(cols,4).trim()||"名称未設定";
  var timeOpts = generateTimeOptions();
  var isFlagged = obj.flagged || false;
  var isNeedsContact = obj.needsContact || false;
  var siteCheckObj = obj.siteCheck || {};
  var scheduleType = obj.scheduleType || '';

  // 即時保存用ヘルパー
  function saveField(updates) {
    firebaseDB.ref('app_tasks/'+key).update(updates);
    for (var k in updates) { globalTasks[key][k] = updates[k]; }
    if (fullData) { fullData.app_tasks = globalTasks; localStorage.setItem('appData', JSON.stringify(fullData)); }
    showSavedMsg();
    if (typeof onSaveCallback === 'function') onSaveCallback();
  }
  function showSavedMsg() {
    var msg = document.getElementById('modal-save-msg');
    if (!msg) return;
    msg.style.display = 'inline';
    clearTimeout(msg._t);
    msg._t = setTimeout(function(){ msg.style.display = 'none'; }, 1500);
  }

  var html = '<div class="modal-header-info">';
  html += '<div class="modal-date-row">🔨 '+sekouStr+' | 📋 '+shitamiStr+' | 📅 '+yoteiStr+'</div>';
  html += '<div class="modal-title-row">🏷️ '+ankenText+' <button id="modal-copy-btn" class="modal-copy-btn">コピー</button></div></div>';

  var geoM = obj.geocode || null;
  var geoOkM = geoM && (geoM.confidence === 'exact' || geoM.confidence === 'high') && geoM.lat != null && geoM.lng != null;
  var geoNeedsReviewM = geoM && (geoM.confidence === 'low' || geoM.confidence === 'fail');

  html += '<div class="modal-section"><h4>📄 CSVデータ</h4><table class="modal-table">';
  for (var idx = 0; idx < globalHeaders.length; idx++) {
    var val = getSafeValModal(cols,idx), dh = val.replace(/\n|\r/g,'<br>'), ct = val.replace(/\s+/g,'');
    if (idx===11&&ct!=="") {
      var mapUrlM = geoOkM
        ? 'https://www.google.com/maps/search/?api=1&query='+geoM.lat+','+geoM.lng
        : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(ct);
      dh='<a href="'+mapUrlM+'" target="_blank" style="color:#0056b3;font-weight:bold;">🗺️ '+val+'</a>';
      if (geoNeedsReviewM) dh += ' <span style="color:#c9721f;font-size:11px;font-weight:600;" title="住所照合ツールで座標を特定できませんでした">📍要確認</span>';
    }
    else if (idx===6&&ct!=="") dh='<a href="tel:'+ct+'" style="color:#0056b3;font-weight:bold;">📞 '+val+'</a>';
    html += '<tr><th>'+(globalHeaders[idx]||'列'+(idx+1))+'</th><td>'+dh+'</td></tr>';
  }
  if (geoM) {
    var confLabelM = {exact:'🟡 地番一致', high:'🟢 高精度', mid:'🔵 中精度', low:'🟠 低精度', fail:'🔴 失敗'}[geoM.confidence] || geoM.confidence;
    var geoMapUrlM = 'https://www.google.com/maps/search/?api=1&query='+geoM.lat+','+geoM.lng;
    var geoRowHtml = confLabelM + ' &nbsp; <a href="'+geoMapUrlM+'" target="_blank" style="color:#0056b3;font-weight:bold;">🗺️ <code>'+geoM.lat+', '+geoM.lng+'</code></a>';
    if (geoM.address) geoRowHtml += '<br><span style="color:#888;font-size:11px;">'+geoM.address+'</span>';
    if (geoM.candidates && geoM.candidates.length > 0) {
      geoRowHtml += '<br><span style="color:#c9721f;font-size:11px;">丁目省略のため他候補あり（要確認）:</span>';
      geoM.candidates.forEach(function(c) {
        var cUrl = 'https://www.google.com/maps/search/?api=1&query='+c.lat+','+c.lng;
        geoRowHtml += '<br><span style="font-size:11px;color:#666;">'+c.key+' <a href="'+cUrl+'" target="_blank" style="color:#0056b3;">🗺️ 地図</a></span>';
      });
    }
    html += '<tr><th>📍座標(照合ツール)</th><td>'+geoRowHtml+'</td></tr>';
  }
  html += '</table></div>';

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
  html += '<label><input type="checkbox" id="modal-finalReport"'+(obj.finalReport?' checked':'')+'> 📋 最終報告完了</label></div>';
  html += '</div>';

  html += '<div class="modal-section"><h4 class="green">📅 下見スケジュール</h4>';

  // 📞 連絡区分（こちらから連絡して決定 ／ 先方にて日時指定あり）※排他選択・即時保存
  html += '<div class="modal-check-row" id="schedule-type-row" style="margin-bottom:10px;">';
  html += '<label><input type="radio" name="modal-schedule-type" id="modal-schedule-ours" value="ours"'+(scheduleType==='ours'?' checked':'')+'> 📞 こちらから連絡して決定</label>';
  html += '<label><input type="radio" name="modal-schedule-type" id="modal-schedule-client" value="client"'+(scheduleType==='client'?' checked':'')+'> 📅 先方にて日時指定あり</label>';
  html += '</div>';

  html += '<div class="modal-input-row"><label>📅 予定日:</label><input type="date" id="modal-date" value="'+(obj.date||'')+'" /></div>';
  html += '<div class="modal-input-row"><label>⏰ 時間:</label><select id="modal-time">'+timeOpts+'</select></div>';
  html += '<div id="modal-time-warn" style="display:none;background:#fff3cd;color:#7a5b00;font-size:11px;padding:5px 8px;border-radius:4px;margin:2px 0 6px;white-space:pre-line;"></div>';
  var orderValInt = parseInt(obj.order, 10);
  var orderValSafe = (!isNaN(orderValInt) && orderValInt >= 1) ? orderValInt : '';
  html += '<div class="modal-input-row"><label>🔢 順:</label><input type="number" id="modal-order" min="1" step="1" placeholder="番号" value="'+orderValSafe+'" /></div></div>';

  var memoVal = obj.memo || '';
  var memoIsLong = memoVal.length > 300;
  html += '<div class="modal-section"><h4 class="blue">💬 メモ';
  if (memoIsLong) html += ' <span style="font-size:11px;color:#888;font-weight:normal;">（' + memoVal.length + '文字）</span>';
  html += '</h4>';
  if (memoIsLong) {
    html += '<div id="memo-preview" style="font-size:12px;color:#666;background:#f5f5f5;padding:8px;border-radius:4px;margin-bottom:6px;max-height:80px;overflow:hidden;white-space:pre-wrap;">' + escHtmlModal(memoVal.substring(0, 200)) + '...</div>';
    html += '<button onclick="toggleMemoEdit()" style="font-size:12px;color:#1a73e8;background:none;border:none;cursor:pointer;margin-bottom:6px;">✏️ 編集する</button>';
    html += '<div id="memo-edit-area" style="display:none;">';
    html += '<textarea class="modal-memo" id="modal-memo" placeholder="メモを入力...">' + escHtmlModal(memoVal) + '</textarea>';
    html += '</div>';
  } else {
    html += '<textarea class="modal-memo" id="modal-memo" placeholder="メモを入力...">' + escHtmlModal(memoVal) + '</textarea>';
  }
  html += '</div>';

  // 🛠️ 現場チェック（メモとは別。テキスト入力・項目離脱時に即時保存）
  html += '<div class="modal-section"><h4 style="color:#e65100;margin-bottom:6px;">🛠️ 現場チェック</h4>';
  html += '<div id="sitecheck-area">';
  SITECHECK_GROUPS.forEach(function(group){
    html += '<div style="font-weight:bold;font-size:12px;color:#555;margin:10px 0 4px;border-bottom:1px solid #eee;padding-bottom:2px;">'+group.title+'</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px 10px;margin-bottom:8px;">';
    group.items.forEach(function(item){
      var label = item[0], fkey = item[1];
      var v = siteCheckObj[fkey] != null ? siteCheckObj[fkey] : '';
      html += '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:2px;">'+label+'</label>';
      html += '<input type="text" class="sitecheck-input" data-field="'+fkey+'" value="'+escHtmlModal(v)+'" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:12px;border:1px solid #ccc;border-radius:3px;" /></div>';
    });
    html += '</div>';
  });
  html += '</div></div>';

  // 📎 添付ファイル（Firebase Storage: users/{userKey}/case_files/{key}/）
  html += '<div class="modal-section"><h4 style="color:#00897b;margin-bottom:6px;">📎 添付ファイル</h4>';
  html += '<div id="attach-list" style="font-size:12px;color:#888;margin-bottom:8px;">読込中...</div>';
  html += '<input type="file" id="attach-file-input" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" capture="environment" style="font-size:12px;" />';
  html += '<div id="attach-upload-status" style="font-size:11px;color:#888;margin-top:4px;"></div>';
  html += '</div>';

  html += '<div style="margin-top:18px;text-align:center;">';
  html += '<button class="modal-flag-btn'+(isFlagged?' flagged':'')+'" id="modal-flag-btn">'+(isFlagged?'⚑ 注目中':'⚐ 注目')+'</button>';
  html += '<button class="modal-contact-btn'+(isNeedsContact?' active':'')+'" id="modal-contact-btn" style="margin:4px 6px;padding:5px 14px;border-radius:4px;font-size:12px;font-weight:bold;cursor:pointer;border:1px solid #00838f;background:'+(isNeedsContact?'#00bcd4':'#e0f7fa')+';color:'+(isNeedsContact?'#fff':'#006064')+';">'+(isNeedsContact?'📞 連絡必要中':'📞 連絡必要')+'</button>';
  html += '<button id="modal-delete-btn" style="margin:4px 6px;padding:5px 14px;border-radius:4px;font-size:12px;font-weight:bold;cursor:pointer;border:1px solid #c62828;background:#fff;color:#c62828;">🗑 この案件を削除</button>';
  html += '<span class="modal-save-msg" id="modal-save-msg">✔ 保存しました</span>';
  html += '<a id="modal-mailer-link" href="mailer-test.html?key='+encodeURIComponent(key)+'" class="modal-mailer-btn">✉️ メール送信</a>';
  var _smsTel = normalizePhoneModal(getSafeValModal(cols,6));
  var _smsLabel = encodeURIComponent(getSafeValModal(cols,5).trim()||key);
  var _smsCase = encodeURIComponent(getSafeValModal(cols,4).trim()||key);
  html += '<a href="sms.html?tel='+_smsTel+'&label='+_smsLabel+'&casename='+_smsCase+'&casekey='+encodeURIComponent(key)+'" class="modal-sms-btn">💬 SMS作成</a>';
  html += '</div>';

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('modal-time').value = obj.time || '';

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
    btn.addEventListener('click',function(){
      selectedStatus=st;
      var bs=kanbanBar.children;
      for(var j=0;j<bs.length;j++){var a=kanbanStatuses.indexOf(st)>=j;bs[j].style.background=a?kanbanColors[j]:'#f5f5f5';bs[j].style.color=a?'#fff':'#999';}
      saveField({localStatus:selectedStatus});
    });
    kanbanBar.appendChild(btn);
  });
  document.getElementById('kanban-sf-note').textContent='SF: '+sfStatus+' → ローカル: '+currentStatus;

  document.getElementById('modal-copy-btn').addEventListener('click',function(){var self=this;navigator.clipboard.writeText(ankenText).then(function(){self.textContent="✔";self.classList.add('copied');setTimeout(function(){self.textContent="コピー";self.classList.remove('copied');},2000);});});

  // ⚑ 注目ボタン（即時）
  document.getElementById('modal-flag-btn').addEventListener('click', function(){
    isFlagged = !isFlagged;
    this.classList.toggle('flagged', isFlagged);
    this.textContent = isFlagged ? '⚑ 注目中' : '⚐ 注目';
    saveField({flagged: isFlagged});
  });

  // 📞 連絡必要ボタン（即時）
  document.getElementById('modal-contact-btn').addEventListener('click', function(){
    isNeedsContact = !isNeedsContact;
    this.classList.toggle('active', isNeedsContact);
    this.textContent = isNeedsContact ? '📞 連絡必要中' : '📞 連絡必要';
    saveField({needsContact: isNeedsContact});
  });

  // 📞 連絡区分（こちらから連絡して決定／先方にて日時指定あり）※排他・即時保存
  var scheduleTypeRow = document.getElementById('schedule-type-row');
  if (scheduleTypeRow) {
    scheduleTypeRow.addEventListener('change', function(e){
      var t = e.target;
      if (t && t.name === 'modal-schedule-type' && t.checked) {
        scheduleType = t.value;
        saveField({scheduleType: scheduleType});
      }
    });
  }

  // 🗑 削除ボタン（確認あり。削除するとFirebase側のonTaskChangedが
  // 既存のcleanupDeletedTaskを自動で呼び、カレンダー・管理表からも消える）
  document.getElementById('modal-delete-btn').addEventListener('click', function(){
    var caseLabel = getSafeValModal(cols,4).trim() || key;
    if (!confirm('「'+caseLabel+'」を削除します。\nカレンダー・管理表からも自動で削除されます。\n\nこの操作は取り消せません。よろしいですか？')) return;
    firebaseDB.ref('app_tasks/'+key).remove().then(function(){
      document.getElementById('modal-overlay').style.display = 'none';
      if (typeof onSaveCallback === 'function') onSaveCallback();
    }).catch(function(e){
      alert('削除できませんでした：' + e.message);
    });
  });

  // チェックボックス類（即時）
  function bindCheck(id, field) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function(){ var upd={}; upd[field]=this.checked; saveField(upd); });
  }
  bindCheck('modal-constructionDateConfirmed','constructionDateConfirmed');
  bindCheck('modal-heardFromCarpenter','heardFromCarpenter');
  bindCheck('modal-heardFromAccountant','heardFromAccountant');
  bindCheck('modal-emailSent','emailSent');
  bindCheck('modal-finalReport','finalReport');

  // 日付・時間・順番
  // checkTimeConflict()：現在保存されている日時について、前後72分（1.2時間）以内の予定を
  // 警告ボックスに表示する（ブロックはしない。既に保存済みの状態を後から知らせるだけ）。
  function checkTimeConflict() {
    var warnBox = document.getElementById('modal-time-warn');
    if (!warnBox) return;
    var d = document.getElementById('modal-date').value;
    var t = document.getElementById('modal-time').value;
    if (!d || !t) { warnBox.style.display = 'none'; return; }
    var kariData = (typeof kariSlots !== 'undefined') ? kariSlots
                  : (typeof kariSlotsCache !== 'undefined') ? kariSlotsCache
                  : null;
    var res = findConflictsModal(d, t, key, globalTasks, kariData);
    var msgs = [];
    if (res.exact.length) msgs.push('⚠ 同じ日時（'+d+' '+t+'）に他の予定があります：'+res.exact.join('、'));
    if (res.nearby.length) msgs.push('🕐 前後1.2時間以内に予定があります。移動時間にご注意ください：'+res.nearby.join('、'));
    if (msgs.length) { warnBox.innerHTML = msgs.join('\n'); warnBox.style.display = 'block'; }
    else { warnBox.style.display = 'none'; }
  }
  checkTimeConflict();
  document.getElementById('modal-date').addEventListener('change', function(){
    var newDate = this.value;
    var t = document.getElementById('modal-time').value;
    var kariData = (typeof kariSlots !== 'undefined') ? kariSlots
                  : (typeof kariSlotsCache !== 'undefined') ? kariSlotsCache
                  : null;
    var res = findConflictsModal(newDate, t, key, globalTasks, kariData);
    if (res.exact.length) {
      // 同時刻の予定が既にある場合は変更不可。入力前の日付に戻す。
      alert('⚠ 同じ日時に他の予定があります：\n' + res.exact.join('\n') + '\n\nこの日時には変更できません。別の日時を選んでください。');
      this.value = obj.date || '';
      checkTimeConflict();
      return;
    }
    saveField({date: newDate});
    document.querySelector('.modal-date-row').innerHTML='🔨 '+sekouStr+' | 📋 '+shitamiStr+' | 📅 '+(newDate||"未定");
    checkTimeConflict();
  });
  document.getElementById('modal-time').addEventListener('change', function(){
    var newTime = this.value;
    var d = document.getElementById('modal-date').value;
    var kariData = (typeof kariSlots !== 'undefined') ? kariSlots
                  : (typeof kariSlotsCache !== 'undefined') ? kariSlotsCache
                  : null;
    var res = findConflictsModal(d, newTime, key, globalTasks, kariData);
    if (res.exact.length) {
      // 同時刻の予定が既にある場合は変更不可。入力前の時間に戻す。
      alert('⚠ 同じ日時に他の予定があります：\n' + res.exact.join('\n') + '\n\nこの時間には変更できません。別の時間を選んでください。');
      this.value = obj.time || '';
      checkTimeConflict();
      return;
    }
    saveField({time: newTime});
    checkTimeConflict();
  });
  // 🔢 順：他案件の自動並べ替えは廃止。入力した数値をそのまま保存するだけ。
  document.getElementById('modal-order').addEventListener('change', function(){
    var noRaw = parseInt(this.value, 10);
    var safeVal = (!isNaN(noRaw) && noRaw >= 1) ? noRaw : '';
    this.value = safeVal;
    saveField({order: safeVal});
  });

  // メモ（blurで即時）
  var memoDebounce;
  var modalMemoEl = document.getElementById('modal-memo');
  if (modalMemoEl) {
    modalMemoEl.addEventListener('input', function(){
      clearTimeout(memoDebounce);
      var memoElAtInput = this;
      memoDebounce = setTimeout(function(){
        saveField({memo: memoElAtInput.value});
      }, 1000);
    });
  }

  // 🛠️ 現場チェック（各項目、離脱時に即時保存。イベント委譲で1リスナー）
  var sitecheckArea = document.getElementById('sitecheck-area');
  if (sitecheckArea) {
    sitecheckArea.addEventListener('focusout', function(e){
      var t = e.target;
      if (t && t.classList && t.classList.contains('sitecheck-input')) {
        var fkey = t.getAttribute('data-field');
        siteCheckObj[fkey] = t.value;
        saveField({siteCheck: siteCheckObj});
      }
    });
  }

  // 📎 添付ファイル 初期化（Firebase Storage SDKを必要時のみ動的読込）
  initCaseAttachments(key);

  document.getElementById('modal-close').addEventListener('click',function(){document.getElementById('modal-overlay').style.display='none';});
  document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
}

function toggleMemoEdit() {
  var area = document.getElementById('memo-edit-area');
  var preview = document.getElementById('memo-preview');
  var btn = event.target;
  if (area.style.display === 'none') {
    area.style.display = 'block';
    if (preview) preview.style.display = 'none';
    btn.textContent = '▲ 閉じる';
  } else {
    area.style.display = 'none';
    if (preview) preview.style.display = 'block';
    btn.textContent = '✏️ 編集する';
  }
}

// ============ 📎 添付ファイル（Firebase Storage: users/{userKey}/case_files/{key}/） ============
function ensureStorageSDKModal(cb) {
  if (typeof firebase !== 'undefined' && firebase.storage) { cb(); return; }
  var existing = document.querySelector('script[data-fbstorage]');
  if (existing) { existing.addEventListener('load', cb); return; }
  var s = document.createElement('script');
  s.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js';
  s.setAttribute('data-fbstorage', '1');
  s.onload = cb;
  document.head.appendChild(s);
}

function initCaseAttachments(caseKey) {
  var listBox = document.getElementById('attach-list');
  var input = document.getElementById('attach-file-input');
  var statusBox = document.getElementById('attach-upload-status');
  if (!listBox || !input) return;

  ensureStorageSDKModal(function () {
    var userKey = (typeof getUserKey === 'function') ? getUserKey() : '';
    var folderPath = 'users/' + userKey + '/case_files/' + caseKey + '/';
    var storageRef = firebase.storage().ref(folderPath);

    function refreshList() {
      listBox.textContent = '読込中...';
      storageRef.listAll().then(function (res) {
        if (res.items.length === 0) { listBox.textContent = '添付ファイルはありません'; return; }
        listBox.innerHTML = '';
        res.items.forEach(function (itemRef) {
          itemRef.getDownloadURL().then(function (url) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;';
            var link = document.createElement('a');
            link.href = url; link.target = '_blank';
            link.style.cssText = 'color:#0056b3;font-size:12px;word-break:break-all;';
            link.textContent = '📄 ' + itemRef.name;
            var delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.style.cssText = 'margin-left:8px;font-size:11px;color:#c62828;background:#fff;border:1px solid #c62828;border-radius:3px;padding:2px 8px;cursor:pointer;flex-shrink:0;';
            delBtn.addEventListener('click', function () {
              if (!confirm('「' + itemRef.name + '」を削除しますか？')) return;
              itemRef.delete().then(refreshList).catch(function (e) { alert('削除できませんでした：' + e.message); });
            });
            row.appendChild(link);
            row.appendChild(delBtn);
            listBox.appendChild(row);
          });
        });
      }).catch(function (e) {
        listBox.textContent = '読込エラー：' + e.message;
      });
    }
    refreshList();

    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      statusBox.textContent = '⏳ アップロード中...';
      var fileRef = storageRef.child(Date.now() + '_' + file.name);
      fileRef.put(file).then(function () {
        statusBox.textContent = '✅ アップロード完了';
        input.value = '';
        refreshList();
        setTimeout(function () { statusBox.textContent = ''; }, 2000);
      }).catch(function (e) {
        statusBox.textContent = '❌ アップロード失敗：' + e.message;
      });
    });
  });
}

function escHtmlModal(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
