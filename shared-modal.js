/* shared-modal.js — 共通モーダル【全即時保存版・通信履歴機能削除済】*/

var FB_URL = "https://project-6745138395263517914-default-rtdb.firebaseio.com";

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

function openCaseModal(key, obj, globalHeaders, globalTasks, fullData, firebaseDB, onSaveCallback) {
  var cols = obj.csvData; if (!cols) return;
  var sekouStr = getSafeValModal(cols,2).replace(/\s+/g,"")||"未定";
  var shitamiStr = formatToYMDModal(getSafeValModal(cols,12))||"未定";
  var yoteiStr = obj.date||"未定";
  var ankenText = getSafeValModal(cols,4).trim()||"名称未設定";
  var timeOpts = generateTimeOptions();
  var isFlagged = obj.flagged || false;
  var isNeedsContact = obj.needsContact || false;

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
  html += '<div class="modal-input-row"><label>📅 予定日:</label><input type="date" id="modal-date" value="'+(obj.date||'')+'" /></div>';
  html += '<div class="modal-input-row"><label>⏰ 時間:</label><select id="modal-time">'+timeOpts+'</select></div>';
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

  html += '<div style="margin-top:18px;text-align:center;">';
  html += '<button class="modal-flag-btn'+(isFlagged?' flagged':'')+'" id="modal-flag-btn">'+(isFlagged?'⚑ 注目中':'⚐ 注目')+'</button>';
  html += '<button class="modal-contact-btn'+(isNeedsContact?' active':'')+'" id="modal-contact-btn" style="margin:4px 6px;padding:5px 14px;border-radius:4px;font-size:12px;font-weight:bold;cursor:pointer;border:1px solid #00838f;background:'+(isNeedsContact?'#00bcd4':'#e0f7fa')+';color:'+(isNeedsContact?'#fff':'#006064')+';">'+(isNeedsContact?'📞 連絡必要中':'📞 連絡必要')+'</button>';
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

  // 日付・時間・順番（change/blurで即時）
  document.getElementById('modal-date').addEventListener('change', function(){
    saveField({date: this.value});
    document.querySelector('.modal-date-row').innerHTML='🔨 '+sekouStr+' | 📋 '+shitamiStr+' | 📅 '+(this.value||"未定");
  });
  document.getElementById('modal-time').addEventListener('change', function(){
    saveField({time: this.value});
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

function escHtmlModal(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
