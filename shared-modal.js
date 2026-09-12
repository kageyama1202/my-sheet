/* shared-modal.js — 共通モーダル【全即時保存版・通信履歴機能削除済・現場チェック追加・日時重複チェック強化版・連絡区分チェック追加・施工日変更定型文追加・希望日程未定オプション追加・状況連絡機能追加・下見実施チェック追加・浴室現場チェック追加(タブ切替)】*/
// VERSION: 2026-09-12-008

var FB_URL = "https://project-6745138395263517914-default-rtdb.firebaseio.com";

// ★2026-09-12追加★ 現場チェックのキッチン用グループ。項目は従来通り(フィールドキーは既存データ互換のため変更なし)。
// { label, field, type }: type省略時は'text'。'number'/'select'(要options)/'multi'(要options・複数選択)に対応。
var SITECHECK_GROUPS_KITCHEN = [
  { title: '床暖まわり', items: [
    { label:'床暖', field:'yukadan' }, { label:'巾木厚さ', field:'habakiAtsusa' }, { label:'搬入時刻', field:'hannyuJikoku' },
    { label:'電動シャッター', field:'dendouShutter' }, { label:'追い焚き有無', field:'oidaki' },
    { label:'角依頼(屋さん合番)', field:'kadoIraiYasan' }, { label:'依頼状況', field:'iraiJoukyou' },
    { label:'クラウド報告', field:'cloudHoukoku' }, { label:'施工日確認(帳場さん)', field:'sekoKakuninBanba' }
  ]},
  { title: '養生まわり', items: [
    { label:'養生', field:'yousei' }, { label:'図面吊戸棚高', field:'zumenTsuridanaTakasa' }, { label:'図面天井高', field:'zumenTenjouTakasa' },
    { label:'レンジフード変更', field:'rangeHoodHenkou' }, { label:'天井高さ', field:'tenjouTakasa' }, { label:'施工日確認(相手)', field:'sekoKakuninAite' }
  ]},
  { title: '窓台まわり', items: [
    { label:'窓台高さ', field:'madodaiTakasa' }, { label:'天吊りフード', field:'tentsuriHood' }, { label:'ニッチ', field:'nicchi' },
    { label:'SK下がり壁', field:'skSagariKabe' }, { label:'CB下がり壁', field:'cbSagariKabe' }, { label:'設備', field:'setsubi' },
    { label:'KP貼り方', field:'kpHarikata' }, { label:'コンセント', field:'consent' }, { label:'ダクト', field:'duct' }
  ]},
  { title: '大工完了まわり', items: [
    { label:'大工完了', field:'daikuKanryo' }, { label:'搬入経路', field:'hannyuKeiro' }, { label:'パネルカット', field:'panelCut' },
    { label:'駐車スペース', field:'chuushaSpace' }, { label:'写メ', field:'shame' }, { label:'キーBOX', field:'keyBox' },
    { label:'SK下地', field:'skShita' }, { label:'天板下地', field:'tenbanShita' }, { label:'CB下地', field:'cbShita' }
  ]}
];

// ★2026-09-12追加★ 現場チェックの浴室用グループ。
var SITECHECK_GROUPS_BATH = [
  { title: '間口・開口', items: [
    { label:'ドア位置', field:'bathDoorPosition', type:'select', options:['右','左'] },
    { label:'間口', field:'bathMaguchi', type:'number' },
    { label:'奥行き(浴槽側)', field:'bathOkuyuki', type:'number' },
    { label:'製品間口', field:'bathSeihinMaguchi', type:'number' },
    { label:'製品奥行き', field:'bathSeihinOkuyuki', type:'number' },
    { label:'開口寸法(額縁開口)', field:'bathKaikou', type:'number' },
    { label:'リモコン開口 有無', field:'bathRemoconUmu', type:'select', options:['有','無'] },
    { label:'リモコン開口 メモ', field:'bathRemoconMemo' },
    { label:'ハンドバー設置方法', field:'bathHandbarHouhou', type:'select', options:['図面通り','要確認'] }
  ]},
  { title: '石膏ボード', items: [
    { label:'石膏ボード部分', field:'bathSekkouBoard', type:'multi', options:['右','左','正面','ドア横'] }
  ]},
  { title: '高さ・床構成', items: [
    { label:'天井高さ(現場の天井)', field:'bathTenjouTakasa', type:'number' },
    { label:'脱衣室高さ', field:'bathDatsuishitsuTakasa', type:'number' },
    { label:'風呂の高さ(製品)', field:'bathFuroTakasa', type:'number' },
    { label:'換気扇の高さ', field:'bathKankisenTakasa', type:'number' },
    { label:'枠材の厚み', field:'bathWakuzaiAtsumi', type:'number' },
    { label:'設置方法', field:'bathSetchiHouhou' },
    { label:'床構成', field:'bathYukaKousei' },
    { label:'スラブ寸法(スラブ〜床面高さ)', field:'bathSlabYukaTakasa', type:'number' },
    { label:'床合わせ', field:'bathYukaAwase', type:'select', options:['○','✕'] },
    { label:'床上がり高さ(床合わせ✕の場合)', field:'bathYukaAgariTakasa', type:'number' },
    { label:'天井とのクリア(自動計算)', field:'bathTenjouClear', type:'computed' },
    { label:'上下総寸法(自動計算)', field:'bathJougeSousunpou', type:'computed' },
    { label:'上下総寸法(実測値・解体後計測)', field:'bathJougeSousunpouJissoku', type:'number' }
  ]},
  { title: '窓', items: [
    { label:'窓幅(W)', field:'bathMadoW', type:'number' },
    { label:'窓高さ(H)', field:'bathMadoH', type:'number' },
    { label:'窓奥行(D)', field:'bathMadoD', type:'number' },
    { label:'位置:上', field:'bathMadoUe', type:'number' },
    { label:'位置:下', field:'bathMadoShita', type:'number' },
    { label:'位置:左', field:'bathMadoHidari', type:'number' },
    { label:'位置:右', field:'bathMadoMigi', type:'number' }
  ]},
  { title: 'ダクト・吊り金具', items: [
    { label:'ダクト高さ', field:'bathDuctTakasa', type:'number' },
    { label:'吊り金具(区分)', field:'bathTsuriKanaguKubun', type:'select', options:['62','20'] },
    { label:'吊り金具(型)', field:'bathTsuriKanaguSize', type:'select', options:['S','SN','M','L'] },
    { label:'吊り金具 現地入れ', field:'bathTsuriKanaguGenchi', type:'select', options:['○','✕'] }
  ]},
  { title: 'メモ・連絡事項', items: [
    { label:'メモ・連絡事項', field:'bathMemoRenraku' }
  ]}
];

// ★2026-09-12追加★ 現場チェックのタブ(キッチン/浴室)を1つのHTML文字列に組み立てる共通レンダラー。
// siteCheckObjは案件のsiteCheckデータ全体(キッチン/浴室のフィールドが混在して入っている想定)。
function renderSiteCheckGroups(groups, siteCheckObj) {
  var html = '';
  groups.forEach(function(group){
    html += '<div style="font-weight:bold;font-size:12px;color:#555;margin:10px 0 4px;border-bottom:1px solid #eee;padding-bottom:2px;">'+group.title+'</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px 10px;margin-bottom:8px;">';
    group.items.forEach(function(item){
      var label = item.label, fkey = item.field, type = item.type || 'text';
      var v = siteCheckObj[fkey] != null ? siteCheckObj[fkey] : '';
      html += '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:2px;">'+label+'</label>';
      if (type === 'select') {
        html += '<select class="sitecheck-input" data-field="'+fkey+'" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:12px;border:1px solid #ccc;border-radius:3px;background:#fff;">';
        html += '<option value=""'+(v===''?' selected':'')+'>--</option>';
        (item.options||[]).forEach(function(opt){
          html += '<option value="'+opt+'"'+(v===opt?' selected':'')+'>'+opt+'</option>';
        });
        html += '</select>';
      } else if (type === 'multi') {
        var savedArr = v ? String(v).split(',') : [];
        html += '<div class="sitecheck-multi" data-field="'+fkey+'" style="display:flex;flex-wrap:wrap;gap:4px 8px;padding:4px 0;">';
        (item.options||[]).forEach(function(opt){
          var checked = savedArr.indexOf(opt) !== -1 ? ' checked' : '';
          html += '<label style="font-size:11px;color:#333;white-space:nowrap;"><input type="checkbox" class="sitecheck-multi-cb" value="'+opt+'"'+checked+'> '+opt+'</label>';
        });
        html += '</div>';
      } else if (type === 'computed') {
        html += '<div class="sitecheck-computed" data-field="'+fkey+'" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:3px;background:#f5f5f5;color:#333;min-height:18px;">'+escHtmlModal(v)+'</div>';
      } else {
        html += '<input type="'+(type==='number'?'number':'text')+'" class="sitecheck-input" data-field="'+fkey+'" value="'+escHtmlModal(v)+'" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:12px;border:1px solid #ccc;border-radius:3px;" />';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  return html;
}

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

// ★2026-09-01追加★
// localStorageの案件キャッシュキー'appData'が以前は全ユーザー共通だったため、
// 同じ端末を複数人（複数PIN=複数userKey）で使い回すと、後からログインした人が
// 取得したデータでキャッシュが上書きされ、先にログインしたままの人の画面にも
// 他人の案件が混ざって見える不具合があった。index.html/today.html/calendar.htmlと
// 同じくuserKeyごとにキャッシュキー自体を分ける。
function modalAppDataKey() {
  return 'appData_' + ((typeof getUserKey === 'function') ? getUserKey() : '');
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
  var isVisited = obj.shitamiVisited || false;

  // 即時保存用ヘルパー
  function saveField(updates) {
    firebaseDB.ref('app_tasks/'+key).update(updates);
    for (var k in updates) { globalTasks[key][k] = updates[k]; }
    if (fullData) { fullData.app_tasks = globalTasks; localStorage.setItem(modalAppDataKey(), JSON.stringify(fullData)); }
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

  // 📞 連絡区分（こちらから連絡して決定 ／ 先方にて日時指定あり）※排他選択・即時保存・解除可
  html += '<div class="modal-check-row" id="schedule-type-row" style="margin-bottom:10px;">';
  html += '<label><input type="radio" name="modal-schedule-type" id="modal-schedule-ours" value="ours"'+(scheduleType==='ours'?' checked':'')+'> 📞 こちらから連絡して決定</label>';
  html += '<label><input type="radio" name="modal-schedule-type" id="modal-schedule-client" value="client"'+(scheduleType==='client'?' checked':'')+'> 📅 先方にて日時指定あり</label>';
  html += '<button type="button" id="modal-schedule-clear" style="margin-left:8px;font-size:11px;color:#888;background:none;border:1px solid #ccc;border-radius:3px;padding:2px 8px;cursor:pointer;">✕ 解除</button>';
  html += '</div>';

  html += '<div class="modal-input-row"><label>📅 予定日:</label><input type="date" id="modal-date" value="'+(obj.date||'')+'" /></div>';
  html += '<div class="modal-input-row"><label>⏰ 時間:</label><select id="modal-time">'+timeOpts+'</select></div>';
  html += '<div id="modal-time-warn" style="display:none;background:#fff3cd;color:#7a5b00;font-size:11px;padding:5px 8px;border-radius:4px;margin:2px 0 6px;white-space:pre-line;"></div>';
  var orderValInt = parseInt(obj.order, 10);
  var orderValSafe = (!isNaN(orderValInt) && orderValInt >= 1) ? orderValInt : '';
  html += '<div class="modal-input-row"><label>🔢 順:</label><input type="number" id="modal-order" min="1" step="1" placeholder="番号" value="'+orderValSafe+'" /></div></div>';

  // 🚗 下見実施チェック（2026-09-01追加）：agenda.htmlの「毎朝の未確認チェック」と同じロジックの
  // モーダル側ミラー。GPS等での自動判定は不可能なため、本人が手動でチェックする一手間を前提にする。
  // 「✅ 行った」：専用フラグshitamiVisitedのみを立てる（localStatusには連動させない＝ステータス管理は
  //   現状形骸化しているためそこには触れない方針）。
  // 「❌ 行けなかった」：メモ欄末尾に自動記録を追記＋予定date/timeをクリア＋連絡必要フラグを自動ON。
  html += '<div class="modal-section"><h4 style="color:#5c6bc0;margin-bottom:6px;">🚗 下見実施チェック</h4>';
  html += '<div id="modal-visited-status" style="font-size:12px;color:#888;margin-bottom:8px;">'
    + (isVisited ? ('✅ 実施済み' + (obj.shitamiVisitedAt ? '（' + String(obj.shitamiVisitedAt).slice(0,16).replace('T',' ') + '）' : '')) : '未確認')
    + '</div>';
  html += '<button type="button" id="modal-visited-yes" style="font-size:12px;padding:6px 12px;border:1px solid #2e7d32;border-radius:4px;background:#e8f5e9;color:#1b5e20;font-weight:bold;cursor:pointer;margin-right:6px;margin-bottom:4px;">✅ 現地下見完了</button>';
  html += '<button type="button" id="modal-visited-revisit" style="font-size:12px;padding:6px 12px;border:1px solid #ef6c00;border-radius:4px;background:#fff3e0;color:#e65100;font-weight:bold;cursor:pointer;margin-right:6px;margin-bottom:4px;">🔁 再訪問が必要</button>';
  html += '<button type="button" id="modal-visited-no" style="font-size:12px;padding:6px 12px;border:1px solid #c62828;border-radius:4px;background:#ffebee;color:#b71c1c;font-weight:bold;cursor:pointer;margin-bottom:4px;">❌ 行けなかった</button>';
  html += '</div>';

  // 🔄 施工日の変更希望（定型文）：ビルダー・邸名・住所・現在日程はCSVから自動、希望日程とメモのみ手入力。
  // コピーボタンで定型文をクリップボードへ。工務担当者名(cols[8])に完全一致する電話番号がkoumu_contactsに
  // 登録されていれば、そのままメッセージアプリを起動できるリンクも表示する（送信は人間が行う）。
  var changeReqKibouVal = obj.changeReqKibou || '';
  var changeReqBikoVal = obj.changeReqBiko || '';
  var changeReqMiteiVal = obj.changeReqMitei || false;
  html += '<div class="modal-section"><h4 style="color:#8e24aa;margin-bottom:6px;">🔄 施工日の変更希望</h4>';
  html += '<div class="modal-input-row"><label>希望日程:</label><input type="text" id="modal-changereq-kibou" placeholder="例：〇〇/〇〇〜〇〇" value="'+escHtmlModal(changeReqKibouVal)+'"'+(changeReqMiteiVal?' disabled':'')+' /></div>';
  html += '<div class="modal-check-row" style="margin-top:0;margin-bottom:8px;"><label><input type="checkbox" id="modal-changereq-mitei"'+(changeReqMiteiVal?' checked':'')+'> 希望日程は未定（現状の施工日には間に合わない）</label></div>';
  html += '<div class="modal-input-row"><label>備考:</label><input type="text" id="modal-changereq-biko" placeholder="備考" value="'+escHtmlModal(changeReqBikoVal)+'" /></div>';
  html += '<div style="margin-top:8px;">';
  html += '<button type="button" id="modal-changereq-copy" style="font-size:12px;padding:6px 14px;border:1px solid #8e24aa;border-radius:4px;background:#f3e5f5;color:#6a1b9a;font-weight:bold;cursor:pointer;">📋 定型文コピー</button>';
  html += '<a id="modal-changereq-sms" href="#" style="display:none;margin-left:8px;font-size:12px;padding:6px 14px;border-radius:4px;background:#6a1b9a;color:#fff;font-weight:bold;text-decoration:none;">💬 工務担当者へメッセージ</a>';
  html += '</div>';
  html += '<div id="modal-changereq-status" style="font-size:11px;color:#888;margin-top:6px;"></div>';
  html += '</div>';

  // 📞 状況連絡：施工日変更とは無関係な一般連絡用。引用する自動項目は変更依頼と同じ、自由記述の「状況」欄のみ。
  var statusReportVal = obj.statusReportText || '';
  html += '<div class="modal-section"><h4 style="color:#00695c;margin-bottom:6px;">📞 状況連絡</h4>';
  html += '<div class="modal-input-row"><label>状況:</label><input type="text" id="modal-statusreport-text" placeholder="例：下見の日程について確認中です" value="'+escHtmlModal(statusReportVal)+'" /></div>';
  html += '<div style="margin-top:8px;">';
  html += '<button type="button" id="modal-statusreport-copy" style="font-size:12px;padding:6px 14px;border:1px solid #00695c;border-radius:4px;background:#e0f2f1;color:#004d40;font-weight:bold;cursor:pointer;">📋 定型文コピー</button>';
  html += '<a id="modal-statusreport-sms" href="#" style="display:none;margin-left:8px;font-size:12px;padding:6px 14px;border-radius:4px;background:#004d40;color:#fff;font-weight:bold;text-decoration:none;">💬 工務担当者へメッセージ</a>';
  html += '</div>';
  html += '<div id="modal-statusreport-status" style="font-size:11px;color:#888;margin-top:6px;"></div>';
  html += '</div>';

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

  // 🛠️ 現場チェック（メモとは別。テキスト入力・項目離脱時に即時保存。キッチン/浴室をタブで手動切替）
  // タブの選択状態はこの案件のsiteCheckLastTabに保存し、次回モーダルを開いた時も直前のタブを復元する。
  var siteCheckLastTab = (siteCheckObj.__lastTab === 'bath') ? 'bath' : 'kitchen';
  html += '<div class="modal-section"><h4 style="color:#e65100;margin-bottom:6px;">🛠️ 現場チェック</h4>';
  html += '<div style="margin-bottom:8px;">';
  html += '<button type="button" class="sitecheck-tab-btn" data-tab="kitchen" style="font-size:12px;padding:6px 14px;border-radius:4px 0 0 4px;border:1px solid #e65100;cursor:pointer;'
    + (siteCheckLastTab==='kitchen' ? 'background:#e65100;color:#fff;font-weight:bold;' : 'background:#fff;color:#e65100;')
    + '">🍳 キッチン</button>';
  html += '<button type="button" class="sitecheck-tab-btn" data-tab="bath" style="font-size:12px;padding:6px 14px;border-radius:0 4px 4px 0;border:1px solid #e65100;border-left:none;cursor:pointer;'
    + (siteCheckLastTab==='bath' ? 'background:#e65100;color:#fff;font-weight:bold;' : 'background:#fff;color:#e65100;')
    + '">🛁 浴室</button>';
  html += '</div>';
  html += '<div id="sitecheck-area">';
  html += renderSiteCheckGroups(siteCheckLastTab === 'bath' ? SITECHECK_GROUPS_BATH : SITECHECK_GROUPS_KITCHEN, siteCheckObj);
  html += '</div></div>';

  // ★2026-09-12追加★ 📐 浴室図面：現場チェック(浴室タブ)で入力した数値を4象限レイアウトのSVGに反映し、PDF化するボタン。
  // まずモーダル内で完結させる方針(重くなれば別HTMLへ切り出す想定)。
  html += '<div class="modal-section"><h4 style="color:#00695c;margin-bottom:6px;">📐 浴室図面</h4>';
  html += '<button type="button" id="bath-diagram-pdf-btn" style="font-size:12px;padding:8px 16px;border:1px solid #00695c;border-radius:4px;background:#e0f2f1;color:#004d40;font-weight:bold;cursor:pointer;">📄 図面PDF作成(浴室)</button>';
  html += '<div id="bath-diagram-status" style="font-size:11px;color:#888;margin-top:6px;"></div>';
  html += '<div id="bath-diagram-preview" style="margin-top:10px;"></div>';
  html += '</div>';

  // 📎 添付ファイル（Firebase Storage: users/{userKey}/case_files/{key}/）
  // capture="environment"を外し、accept + multiple のみにする。
  // → タップ時に「カメラで撮影／写真ライブラリから選択／ファイルを選択」の
  //   選択肢が出るようになる（capture指定があるとカメラ直起動に固定されてしまう）。
  html += '<div class="modal-section"><h4 style="color:#00897b;margin-bottom:6px;">📎 添付ファイル</h4>';
  html += '<div id="attach-list" style="font-size:12px;color:#888;margin-bottom:8px;">読込中...</div>';
  html += '<input type="file" id="attach-file-input" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style="font-size:12px;" />';
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

  // 🚗 下見実施チェック（即時）
  document.getElementById('modal-visited-yes').addEventListener('click', function(){
    var nowIso = new Date().toISOString();
    isVisited = true;
    saveField({ shitamiVisited: true, shitamiVisitedAt: nowIso });
    var st = document.getElementById('modal-visited-status');
    if (st) st.textContent = '✅ 実施済み（' + nowIso.slice(0,16).replace('T',' ') + '）';
  });
  function buildStamp() {
    var d = new Date();
    return d.getFullYear() + '/' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + ('0'+d.getDate()).slice(-2)
      + ' ' + ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
  }
  function clearScheduleWithMemo(label) {
    var stamp = buildStamp();
    var prevDate = obj.date || '未設定';
    var prevTime = obj.time || '';
    var memoElNow = document.getElementById('modal-memo');
    var currentMemo = memoElNow ? memoElNow.value : (obj.memo || '');
    var noteLine = '【' + label + ' ' + stamp + '】予定日時 ' + prevDate + (prevTime ? ' ' + prevTime : '') + ' → クリア';
    var newMemo = (currentMemo ? currentMemo + '\n\n' : '') + noteLine;
    if (memoElNow) memoElNow.value = newMemo;
    saveField({ date: '', time: '', order: '', memo: newMemo });
    var dEl = document.getElementById('modal-date'); if (dEl) dEl.value = '';
    var tEl = document.getElementById('modal-time'); if (tEl) tEl.value = '';
    var oEl = document.getElementById('modal-order'); if (oEl) oEl.value = '';
    var st = document.getElementById('modal-visited-status');
    if (st) st.textContent = '未確認（' + stamp + ' ' + label + '）';
    document.querySelector('.modal-date-row').innerHTML='🔨 '+sekouStr+' | 📋 '+shitamiStr+' | 📅 未定';
    checkTimeConflict();
  }
  document.getElementById('modal-visited-revisit').addEventListener('click', function(){
    if (!confirm('現地には行ったが「再訪問が必要」として記録します。\n予定日時をクリアします。よろしいですか？')) return;
    clearScheduleWithMemo('再訪問必要');
  });
  document.getElementById('modal-visited-no').addEventListener('click', function(){
    if (!confirm('この下見を「行けなかった」として記録します。\n予定日時をクリアします。よろしいですか？')) return;
    clearScheduleWithMemo('下見未実施');
  });

  // 📞 連絡区分（こちらから連絡して決定／先方にて日時指定あり）※排他・即時保存・解除可
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
  var scheduleClearBtn = document.getElementById('modal-schedule-clear');
  if (scheduleClearBtn) {
    scheduleClearBtn.addEventListener('click', function(){
      var radios = document.getElementsByName('modal-schedule-type');
      for (var ri=0; ri<radios.length; ri++) { radios[ri].checked = false; }
      scheduleType = '';
      saveField({scheduleType: ''});
    });
  }

  // 🗑 削除ボタン（確認あり。削除するとFirebase側のonTaskChangedが
  // 既存のcleanupDeletedTaskを自動で呼び、カレンダー・管理表からも消える）
  // ローカルのglobalTasks/localStorageからも即座に消して、リロードなしで
  // 一覧（today.htmlなど）にすぐ反映されるようにする。
  document.getElementById('modal-delete-btn').addEventListener('click', function(){
    var caseLabel = getSafeValModal(cols,4).trim() || key;
    if (!confirm('「'+caseLabel+'」を削除します。\nカレンダー・管理表からも自動で削除されます。\n\nこの操作は取り消せません。よろしいですか？')) return;
    firebaseDB.ref('app_tasks/'+key).remove().then(function(){
      if (globalTasks && globalTasks[key]) { delete globalTasks[key]; }
      if (fullData) { fullData.app_tasks = globalTasks; localStorage.setItem(modalAppDataKey(), JSON.stringify(fullData)); }
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

  // 🛠️ 現場チェック（テキスト/数値は離脱時、選択系(select・複数選択)は選択時に即時保存。イベント委譲で1リスナー）
  var sitecheckArea = document.getElementById('sitecheck-area');

  // ★2026-09-12追加★ 浴室タブの自動計算：
  // 天井とのクリア = 天井高さ − (床上がり高さ + 風呂の高さ + 換気扇の高さ)
  // 上下総寸法     = 天井高さ + スラブ寸法(スラブ〜床面高さ)
  function computeBathAutoFields() {
    if (!sitecheckArea) return;
    var clearEl = sitecheckArea.querySelector('[data-field="bathTenjouClear"]');
    var totalEl = sitecheckArea.querySelector('[data-field="bathJougeSousunpou"]');
    if (!clearEl && !totalEl) return; // 浴室タブが表示されていない
    var tenjou = parseFloat(siteCheckObj.bathTenjouTakasa);
    var agari = parseFloat(siteCheckObj.bathYukaAgariTakasa) || 0;
    var furo = parseFloat(siteCheckObj.bathFuroTakasa);
    var kankisen = parseFloat(siteCheckObj.bathKankisenTakasa);
    var slab = parseFloat(siteCheckObj.bathSlabYukaTakasa);
    var clearVal = (!isNaN(tenjou) && !isNaN(furo) && !isNaN(kankisen)) ? String(tenjou - agari - furo - kankisen) : '';
    var totalVal = (!isNaN(tenjou) && !isNaN(slab)) ? String(tenjou + slab) : '';
    siteCheckObj.bathTenjouClear = clearVal;
    siteCheckObj.bathJougeSousunpou = totalVal;
    if (clearEl) clearEl.textContent = clearVal;
    if (totalEl) totalEl.textContent = totalVal;
  }
  // ★2026-09-12追加★ 床合わせが○の時は「床上がり高さ」を無効化(該当なしのため)
  function applyBathYukaAwaseState() {
    if (!sitecheckArea) return;
    var awaseSel = sitecheckArea.querySelector('[data-field="bathYukaAwase"]');
    var agariInput = sitecheckArea.querySelector('[data-field="bathYukaAgariTakasa"]');
    if (!awaseSel || !agariInput) return;
    var disable = awaseSel.value === '○';
    agariInput.disabled = disable;
    agariInput.style.background = disable ? '#eee' : '#fff';
    if (disable && agariInput.value !== '') {
      agariInput.value = '';
      siteCheckObj.bathYukaAgariTakasa = '';
      computeBathAutoFields();
    }
  }

  if (sitecheckArea) {
    applyBathYukaAwaseState();
    computeBathAutoFields();

    // 数値入力中もリアルタイムで自動計算欄を更新(保存は従来通りfocusout時)
    sitecheckArea.addEventListener('input', function(e){
      var t = e.target;
      if (t && t.classList && t.classList.contains('sitecheck-input') && t.tagName !== 'SELECT') {
        var calcFields = ['bathTenjouTakasa','bathYukaAgariTakasa','bathFuroTakasa','bathKankisenTakasa','bathSlabYukaTakasa'];
        if (calcFields.indexOf(t.getAttribute('data-field')) !== -1) {
          siteCheckObj[t.getAttribute('data-field')] = t.value;
          computeBathAutoFields();
        }
      }
    });

    sitecheckArea.addEventListener('focusout', function(e){
      var t = e.target;
      if (t && t.classList && t.classList.contains('sitecheck-input') && t.tagName !== 'SELECT') {
        var fkey = t.getAttribute('data-field');
        siteCheckObj[fkey] = t.value;
        saveField({siteCheck: siteCheckObj});
      }
    });
    sitecheckArea.addEventListener('change', function(e){
      var t = e.target;
      if (t && t.classList && t.classList.contains('sitecheck-input') && t.tagName === 'SELECT') {
        var fkey = t.getAttribute('data-field');
        siteCheckObj[fkey] = t.value;
        if (fkey === 'bathYukaAwase') applyBathYukaAwaseState();
        saveField({siteCheck: siteCheckObj});
      } else if (t && t.classList && t.classList.contains('sitecheck-multi-cb')) {
        var group = t.closest('.sitecheck-multi');
        if (group) {
          var fkey2 = group.getAttribute('data-field');
          var checkedVals = Array.prototype.slice.call(group.querySelectorAll('.sitecheck-multi-cb:checked')).map(function(cb){ return cb.value; });
          siteCheckObj[fkey2] = checkedVals.join(',');
          saveField({siteCheck: siteCheckObj});
        }
      }
    });
  }

  // 🍳/🛁 現場チェックのタブ切替（キッチン⇔浴室）。切替時にそのタブの入力欄一式を再描画し、
  // 直前に開いていたタブをsiteCheck.__lastTabとして保存(次回モーダルを開いた時に復元するため)。
  document.querySelectorAll('.sitecheck-tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tab = this.getAttribute('data-tab');
      siteCheckObj.__lastTab = tab;
      saveField({siteCheck: siteCheckObj});
      document.querySelectorAll('.sitecheck-tab-btn').forEach(function(b){
        var active = b.getAttribute('data-tab') === tab;
        b.style.background = active ? '#e65100' : '#fff';
        b.style.color = active ? '#fff' : '#e65100';
        b.style.fontWeight = active ? 'bold' : 'normal';
      });
      if (sitecheckArea) {
        sitecheckArea.innerHTML = renderSiteCheckGroups(tab === 'bath' ? SITECHECK_GROUPS_BATH : SITECHECK_GROUPS_KITCHEN, siteCheckObj);
        applyBathYukaAwaseState();
        computeBathAutoFields();
      }
    });
  });



  // 🔄 施工日の変更希望（定型文コピー＋工務担当者へのメッセージ起動）
  (function(){
    var kibouEl = document.getElementById('modal-changereq-kibou');
    var bikoEl = document.getElementById('modal-changereq-biko');
    var miteiEl = document.getElementById('modal-changereq-mitei');
    var copyBtn = document.getElementById('modal-changereq-copy');
    var smsLink = document.getElementById('modal-changereq-sms');
    var statusEl = document.getElementById('modal-changereq-status');
    if (!kibouEl || !bikoEl || !copyBtn) return;

    var koumuName = getSafeValModal(cols, 8).replace(/[\s\u3000]+/g, '');
    var koumuPhone = null; // lookupKoumuPhoneModal完了後に設定される

    function buildChangeReqText() {
      var builder = getSafeValModal(cols, 5);
      var teiName = getSafeValModal(cols, 4);
      var addr = getSafeValModal(cols, 11).replace(/[\r\n]+/g, '');
      var genzai = getSafeValModal(cols, 2);
      var kibouLine = miteiEl && miteiEl.checked
        ? '未定（現状の施工日には間に合わないため要相談）'
        : kibouEl.value;
      return 'お疲れ様です\n'
        + '施工日の変更希望\n'
        + 'ビルダー : ' + builder + '\n'
        + '邸名　　 : ' + teiName + '\n'
        + '住所概略 : ' + addr + '\n'
        + '現在日程 : ' + genzai + '\n'
        + '希望日程 : ' + kibouLine + '\n'
        + '備考　　:  ' + bikoEl.value;
    }

    // 希望日程未定チェック：ONなら日付入力を無効化（排他）。即時保存。
    if (miteiEl) {
      miteiEl.addEventListener('change', function(){
        kibouEl.disabled = this.checked;
        saveField({ changeReqMitei: this.checked });
      });
    }

    // 希望日程・備考は入力欄を離れた時点で即時保存
    var changeReqDebounce;
    function bindChangeReqField(el, field) {
      el.addEventListener('input', function(){
        clearTimeout(changeReqDebounce);
        var elAtInput = this;
        changeReqDebounce = setTimeout(function(){
          var upd = {}; upd[field] = elAtInput.value; saveField(upd);
        }, 800);
      });
    }
    bindChangeReqField(kibouEl, 'changeReqKibou');
    bindChangeReqField(bikoEl, 'changeReqBiko');

    // 工務担当者名(cols[8])に完全一致する電話番号をkoumu_contactsから検索（全ユーザー共通データのためscopedDatabase不使用）
    if (koumuName && typeof firebase !== 'undefined' && firebase.database) {
      firebase.database().ref('koumu_contacts').once('value').then(function(snap){
        var val = snap.val() || {};
        Object.keys(val).forEach(function(k){
          var c = val[k];
          if (c && c.name && c.name.replace(/[\s\u3000]+/g, '') === koumuName && c.phone) {
            koumuPhone = c.phone;
          }
        });
      }).catch(function(){ /* 読み込み失敗時は電話番号なし扱いで続行 */ });
    }

    copyBtn.addEventListener('click', function(){
      var text = buildChangeReqText();
      navigator.clipboard.writeText(text).then(function(){
        if (koumuPhone) {
          smsLink.href = 'sms:' + koumuPhone + '?body=' + encodeURIComponent(text);
          smsLink.style.display = 'inline-block';
          statusEl.textContent = '✔ コピーしました（工務担当者：' + koumuName + '）';
        } else {
          smsLink.style.display = 'none';
          statusEl.textContent = koumuName
            ? '✔ コピーしました（工務担当者「' + koumuName + '」の電話番号が未登録：koumu-contacts.htmlで追加してください）'
            : '✔ コピーしました（工務担当者名が案件データに未入力です）';
        }
        clearTimeout(statusEl._t);
        statusEl._t = setTimeout(function(){ statusEl.textContent = ''; }, 5000);

        // 履歴用：コピーした定型文を日時付きでメモ欄末尾に自由記述として残す（自分の身を守るための記録）
        var d = new Date();
        var stamp = d.getFullYear() + '/' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + ('0'+d.getDate()).slice(-2)
          + ' ' + ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
        var memoEl = document.getElementById('modal-memo');
        var currentMemo = memoEl ? memoEl.value : (obj.memo || '');
        var newMemo = (currentMemo ? currentMemo + '\n\n' : '') + '【施工日変更依頼 ' + stamp + '】\n' + text;
        if (memoEl) memoEl.value = newMemo;
        saveField({ memo: newMemo });
      }).catch(function(e){
        statusEl.textContent = '❌ コピーに失敗しました：' + e.message;
      });
    });
  })();

  // 📞 状況連絡（定型文コピー＋工務担当者へのメッセージ起動）：施工日変更とは独立した一般連絡用
  (function(){
    var textEl = document.getElementById('modal-statusreport-text');
    var copyBtn = document.getElementById('modal-statusreport-copy');
    var smsLink = document.getElementById('modal-statusreport-sms');
    var statusEl = document.getElementById('modal-statusreport-status');
    if (!textEl || !copyBtn) return;

    var koumuName = getSafeValModal(cols, 8).replace(/[\s\u3000]+/g, '');
    var koumuPhone = null;

    function buildStatusReportText() {
      var builder = getSafeValModal(cols, 5);
      var teiName = getSafeValModal(cols, 4);
      var addr = getSafeValModal(cols, 11).replace(/[\r\n]+/g, '');
      var genzai = getSafeValModal(cols, 2);
      return 'お疲れ様です\n'
        + '状況連絡\n'
        + 'ビルダー : ' + builder + '\n'
        + '邸名　　 : ' + teiName + '\n'
        + '住所概略 : ' + addr + '\n'
        + '現在日程 : ' + genzai + '\n'
        + '状況　　 : ' + textEl.value;
    }

    var statusReportDebounce;
    textEl.addEventListener('input', function(){
      clearTimeout(statusReportDebounce);
      var elAtInput = this;
      statusReportDebounce = setTimeout(function(){
        saveField({ statusReportText: elAtInput.value });
      }, 800);
    });

    if (koumuName && typeof firebase !== 'undefined' && firebase.database) {
      firebase.database().ref('koumu_contacts').once('value').then(function(snap){
        var val = snap.val() || {};
        Object.keys(val).forEach(function(k){
          var c = val[k];
          if (c && c.name && c.name.replace(/[\s\u3000]+/g, '') === koumuName && c.phone) {
            koumuPhone = c.phone;
          }
        });
      }).catch(function(){ /* 読み込み失敗時は電話番号なし扱いで続行 */ });
    }

    copyBtn.addEventListener('click', function(){
      var text = buildStatusReportText();
      navigator.clipboard.writeText(text).then(function(){
        if (koumuPhone) {
          smsLink.href = 'sms:' + koumuPhone + '?body=' + encodeURIComponent(text);
          smsLink.style.display = 'inline-block';
          statusEl.textContent = '✔ コピーしました（工務担当者：' + koumuName + '）';
        } else {
          smsLink.style.display = 'none';
          statusEl.textContent = koumuName
            ? '✔ コピーしました（工務担当者「' + koumuName + '」の電話番号が未登録：koumu-contacts.htmlで追加してください）'
            : '✔ コピーしました（工務担当者名が案件データに未入力です）';
        }
        clearTimeout(statusEl._t);
        statusEl._t = setTimeout(function(){ statusEl.textContent = ''; }, 5000);

        // 履歴用：状況連絡もメモ欄末尾に日時付きで残す
        var d = new Date();
        var stamp = d.getFullYear() + '/' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + ('0'+d.getDate()).slice(-2)
          + ' ' + ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
        var memoEl = document.getElementById('modal-memo');
        var currentMemo = memoEl ? memoEl.value : (obj.memo || '');
        var newMemo = (currentMemo ? currentMemo + '\n\n' : '') + '【状況連絡 ' + stamp + '】\n' + text;
        if (memoEl) memoEl.value = newMemo;
        saveField({ memo: newMemo });
      }).catch(function(e){
        statusEl.textContent = '❌ コピーに失敗しました：' + e.message;
      });
    });
  })();

  // 📎 添付ファイル 初期化（Firebase Storage SDKを必要時のみ動的読込）
  initCaseAttachments(key);

  // 📐 浴室図面PDF作成（html2canvas + jsPDFを必要時のみ動的読込）
  (function(){
    var btn = document.getElementById('bath-diagram-pdf-btn');
    var statusEl = document.getElementById('bath-diagram-status');
    var previewEl = document.getElementById('bath-diagram-preview');
    if (!btn) return;
    btn.addEventListener('click', function(){
      statusEl.textContent = '⏳ 図面を作成中...';
      ensurePdfLibsModal(function(){
        previewEl.innerHTML = '<div id="bath-diagram-render" style="background:#fff;display:inline-block;"></div>';
        document.getElementById('bath-diagram-render').innerHTML = buildBathDiagramSVG(siteCheckObj);
        html2canvas(document.getElementById('bath-diagram-render'), { scale: 2, backgroundColor: '#ffffff' }).then(function(canvas){
          var imgData = canvas.toDataURL('image/png');
          var jsPDFCtor = window.jspdf.jsPDF;
          var pdf = new jsPDFCtor({ orientation: 'landscape', unit: 'pt', format: 'a4' });
          var pageW = pdf.internal.pageSize.getWidth();
          var pageH = pdf.internal.pageSize.getHeight();
          var ratio = Math.min(pageW / canvas.width, pageH / canvas.height) * 0.95;
          var w = canvas.width * ratio, h = canvas.height * ratio;
          var x = (pageW - w) / 2, y = (pageH - h) / 2;
          pdf.addImage(imgData, 'PNG', x, y, w, h);
          var caseLabel = getSafeValModal(cols,4).trim() || key;
          pdf.save(caseLabel + '_浴室図面.pdf');
          statusEl.textContent = '✅ 出力完了';
          setTimeout(function(){ statusEl.textContent = ''; }, 2500);
        }).catch(function(e){
          statusEl.textContent = '❌ 失敗：' + e.message;
        });
      });
    });
  })();

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

var IMAGE_EXT_RE_MODAL = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;

// ライトボックス（画像を大きく表示し、左右矢印/スワイプで送る）
function ensureLightboxModal() {
  var el = document.getElementById('attach-lightbox');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'attach-lightbox';
  el.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;flex-direction:column;';
  el.innerHTML =
    '<div style="position:absolute;top:12px;right:16px;color:#fff;font-size:28px;cursor:pointer;z-index:2;" id="lightbox-close">&times;</div>' +
    '<div style="position:absolute;top:12px;left:16px;color:#fff;font-size:13px;" id="lightbox-counter"></div>' +
    '<img id="lightbox-img" style="max-width:92%;max-height:80%;object-fit:contain;" />' +
    '<div style="margin-top:14px;color:#eee;font-size:12px;max-width:90%;word-break:break-all;text-align:center;" id="lightbox-name"></div>' +
    '<div style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#fff;font-size:36px;cursor:pointer;padding:8px 14px;user-select:none;" id="lightbox-prev">&#8249;</div>' +
    '<div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#fff;font-size:36px;cursor:pointer;padding:8px 14px;user-select:none;" id="lightbox-next">&#8250;</div>';
  document.body.appendChild(el);

  var imgEl = el.querySelector('#lightbox-img');
  var nameEl = el.querySelector('#lightbox-name');
  var counterEl = el.querySelector('#lightbox-counter');
  var items = [], idx = 0;

  function show(i) {
    if (!items.length) return;
    idx = (i + items.length) % items.length;
    imgEl.src = items[idx].url;
    nameEl.textContent = items[idx].name;
    counterEl.textContent = (idx + 1) + ' / ' + items.length;
  }
  el.open = function (list, startIndex) {
    items = list; show(startIndex || 0);
    el.style.display = 'flex';
  };
  el.querySelector('#lightbox-close').addEventListener('click', function () { el.style.display = 'none'; });
  el.addEventListener('click', function (e) { if (e.target === el) el.style.display = 'none'; });
  el.querySelector('#lightbox-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
  el.querySelector('#lightbox-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });

  // スワイプ対応
  var touchStartX = null;
  el.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; });
  el.addEventListener('touchend', function (e) {
    if (touchStartX == null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 40) show(idx - 1); else if (dx < -40) show(idx + 1);
    touchStartX = null;
  });
  return el;
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

        var gridBox = document.createElement('div');
        gridBox.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px;margin-bottom:8px;';
        var fileListBox = document.createElement('div');

        var urlPromises = res.items.map(function (itemRef) {
          return itemRef.getDownloadURL().then(function (url) { return { ref: itemRef, name: itemRef.name, url: url }; });
        });

        Promise.all(urlPromises).then(function (entries) {
          var imageEntries = entries.filter(function (e) { return IMAGE_EXT_RE_MODAL.test(e.name); });
          var otherEntries = entries.filter(function (e) { return !IMAGE_EXT_RE_MODAL.test(e.name); });
          var lightboxItems = imageEntries.map(function (e) { return { url: e.url, name: e.name }; });
          var lightbox = ensureLightboxModal();

          imageEntries.forEach(function (e, i) {
            var cell = document.createElement('div');
            cell.style.cssText = 'position:relative;';
            var thumb = document.createElement('img');
            thumb.src = e.url;
            thumb.style.cssText = 'width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid #ddd;';
            thumb.addEventListener('click', function () { lightbox.open(lightboxItems, i); });
            var delBtn = document.createElement('button');
            delBtn.textContent = '×';
            delBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;width:20px;height:20px;line-height:18px;text-align:center;padding:0;font-size:13px;color:#c62828;background:#fff;border:1px solid #c62828;border-radius:50%;cursor:pointer;';
            delBtn.addEventListener('click', function (ev) {
              ev.stopPropagation();
              if (!confirm('「' + e.name + '」を削除しますか？')) return;
              e.ref.delete().then(refreshList).catch(function (err) { alert('削除できませんでした：' + err.message); });
            });
            cell.appendChild(thumb);
            cell.appendChild(delBtn);
            gridBox.appendChild(cell);
          });

          otherEntries.forEach(function (e) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;';
            var link = document.createElement('a');
            link.href = e.url; link.target = '_blank';
            link.style.cssText = 'color:#0056b3;font-size:12px;word-break:break-all;';
            link.textContent = '📄 ' + e.name;
            var delBtn = document.createElement('button');
            delBtn.textContent = '削除';
            delBtn.style.cssText = 'margin-left:8px;font-size:11px;color:#c62828;background:#fff;border:1px solid #c62828;border-radius:3px;padding:2px 8px;cursor:pointer;flex-shrink:0;';
            delBtn.addEventListener('click', function () {
              if (!confirm('「' + e.name + '」を削除しますか？')) return;
              e.ref.delete().then(refreshList).catch(function (err) { alert('削除できませんでした：' + err.message); });
            });
            row.appendChild(link);
            row.appendChild(delBtn);
            fileListBox.appendChild(row);
          });

          if (imageEntries.length) listBox.appendChild(gridBox);
          if (otherEntries.length) listBox.appendChild(fileListBox);
        });
      }).catch(function (e) {
        listBox.textContent = '読込エラー：' + e.message;
      });
    }
    refreshList();

    input.addEventListener('change', function () {
      var files = input.files;
      if (!files || files.length === 0) return;
      statusBox.textContent = '⏳ アップロード中... (0/' + files.length + ')';
      var done = 0, failed = 0;
      Array.prototype.forEach.call(files, function (file) {
        var fileRef = storageRef.child(Date.now() + '_' + file.name);
        fileRef.put(file).then(function () {
          done++;
          statusBox.textContent = '⏳ アップロード中... (' + done + '/' + files.length + ')';
          if (done + failed === files.length) {
            statusBox.textContent = failed ? '⚠ 一部失敗しました（' + failed + '件）' : '✅ アップロード完了';
            input.value = '';
            refreshList();
            setTimeout(function () { statusBox.textContent = ''; }, 2000);
          }
        }).catch(function (e) {
          failed++;
          if (done + failed === files.length) {
            statusBox.textContent = '❌ アップロード失敗：' + e.message;
          }
        });
      });
    });
  });
}

// ============ 📐 浴室図面（4象限レイアウトのSVG生成 + PDF化） ============
function ensurePdfLibsModal(cb) {
  var need = [];
  if (typeof html2canvas === 'undefined') need.push('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (typeof window.jspdf === 'undefined') need.push('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if (need.length === 0) { cb(); return; }
  var loaded = 0;
  need.forEach(function(src){
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ loaded++; if (loaded === need.length) cb(); };
    document.head.appendChild(s);
  });
}

function numModal(v, def) {
  var n = parseFloat(v);
  return isNaN(n) ? (def === undefined ? null : def) : n;
}

// 間口(w)×奥行き(d)[mm]を、maxW×maxHの枠に収まる比率でスケールしたピクセルサイズに変換
function fitBoxModal(w, d, maxW, maxH) {
  if (!w || !d) return { w: maxW, h: maxH, scale: 1 };
  var scale = Math.min(maxW / w, maxH / d);
  return { w: w * scale, h: d * scale, scale: scale };
}

// 現場チェック(浴室)の入力値から、IMG_6909の4象限レイアウトを模したSVGを組み立てる。
// 初版のため、位置・比率は今後の見た目調整を前提とする。
function buildBathDiagramSVG(sc) {
  sc = sc || {};
  var W = 1150, H = 900, MX = 500, MY = 450;
  var svg = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif">';
  svg += '<rect width="'+W+'" height="'+H+'" fill="#fdfaf3"/>';
  svg += '<line x1="'+MX+'" y1="0" x2="'+MX+'" y2="'+H+'" stroke="#c0392b" stroke-width="2"/>';
  svg += '<line x1="0" y1="'+MY+'" x2="'+W+'" y2="'+MY+'" stroke="#c0392b" stroke-width="2"/>';

  // ---------- 左上：平面図（間口・奥行き／勝手／石膏ボード） ----------
  var maguchi = numModal(sc.bathMaguchi), okuyuki = numModal(sc.bathOkuyuki);
  var seiMaguchi = numModal(sc.bathSeihinMaguchi), seiOkuyuki = numModal(sc.bathSeihinOkuyuki);
  var outerBox = fitBoxModal(maguchi || seiMaguchi || 1600, okuyuki || seiOkuyuki || 1600, 300, 300);
  var ox = 60, oy = 40, ow = outerBox.w, oh = outerBox.h;
  svg += '<text x="'+(ox+ow/2)+'" y="'+(oy-14)+'" text-anchor="middle" font-size="13" fill="#555">間口'+(maguchi?'：'+maguchi:'')+'</text>';
  svg += '<rect x="'+ox+'" y="'+oy+'" width="'+ow+'" height="'+oh+'" fill="none" stroke="#c0392b" stroke-width="2"/>';
  var padX = 12, padY = 12;
  if (seiMaguchi && maguchi) padX = Math.max(4, ow * (maguchi - seiMaguchi) / maguchi / 2);
  if (seiOkuyuki && okuyuki) padY = Math.max(4, oh * (okuyuki - seiOkuyuki) / okuyuki / 2);
  var ix = ox + padX, iy = oy + padY, iw = ow - padX*2, ih = oh - padY*2;
  svg += '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="#dcecec" stroke="#00695c" stroke-width="1.5"/>';
  svg += '<text x="'+(ox+ow+8)+'" y="'+(oy+oh/2)+'" font-size="12" fill="#555" transform="rotate(90 '+(ox+ow+8)+' '+(oy+oh/2)+')" text-anchor="middle">奥行き'+(okuyuki?'：'+okuyuki:'')+'</text>';

  // 勝手(ドアの開き)：右勝手/左勝手のどちらか一方だけ描く
  var doorPos = sc.bathDoorPosition || '';
  var doorY = oy + oh;
  if (doorPos === '右') {
    svg += '<path d="M'+(ox+ow)+','+(doorY-40)+' L'+(ox+ow)+','+(doorY+30)+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+(ox+ow)+','+(doorY+30)+' L'+(ox+ow-40)+','+(doorY-8)+'" stroke="#222" stroke-width="1.3"/>';
    svg += '<path d="M'+(ox+ow)+','+(doorY-40)+' A48,48 0 0 0 '+(ox+ow-40)+','+(doorY-8)+'" fill="none" stroke="#999" stroke-width="0.8" stroke-dasharray="3,3"/>';
    svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+45)+'" font-size="12" fill="#c0392b">右勝手</text>';
  } else if (doorPos === '左') {
    svg += '<path d="M'+ox+','+(doorY-40)+' L'+ox+','+(doorY+30)+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+ox+','+(doorY+30)+' L'+(ox+40)+','+(doorY-8)+'" stroke="#222" stroke-width="1.3"/>';
    svg += '<path d="M'+ox+','+(doorY-40)+' A48,48 0 0 1 '+(ox+40)+','+(doorY-8)+'" fill="none" stroke="#999" stroke-width="0.8" stroke-dasharray="3,3"/>';
    svg += '<text x="'+(ox-70)+'" y="'+(doorY+45)+'" font-size="12" fill="#c0392b">左勝手</text>';
  } else {
    svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+45)+'" text-anchor="middle" font-size="11" fill="#aaa">(勝手未選択)</text>';
  }

  // 石膏ボード部分：選択された壁面ごとに強調線＋ラベル
  var sekkou = sc.bathSekkouBoard ? String(sc.bathSekkouBoard).split(',') : [];
  var sekkouWalls = {
    '右': { x1: ix+iw, y1: iy, x2: ix+iw, y2: iy+ih },
    '左': { x1: ix, y1: iy, x2: ix, y2: iy+ih },
    '正面': { x1: ix, y1: iy, x2: ix+iw, y2: iy },
    'ドア横': { x1: ix, y1: iy+ih, x2: ix+iw, y2: iy+ih }
  };
  sekkou.forEach(function(w){
    var seg = sekkouWalls[w];
    if (!seg) return;
    svg += '<line x1="'+seg.x1+'" y1="'+seg.y1+'" x2="'+seg.x2+'" y2="'+seg.y2+'" stroke="#8e24aa" stroke-width="6" stroke-linecap="round" opacity="0.85"/>';
  });
  if (sekkou.length) {
    svg += '<text x="'+ix+'" y="'+(iy+ih+40)+'" font-size="11" fill="#8e24aa">石膏ボード：'+sekkou.join('・')+'</text>';
  }

  // ---------- 右上：高さ関係（断面） ----------
  var rx = 640;
  var tenjou = numModal(sc.bathTenjouTakasa);
  var datsui = numModal(sc.bathDatsuishitsuTakasa);
  var furo = numModal(sc.bathFuroTakasa);
  var kankisen = numModal(sc.bathKankisenTakasa);
  var agari = numModal(sc.bathYukaAgariTakasa, 0);
  var clear = numModal(sc.bathTenjouClear);
  var slab = numModal(sc.bathSlabYukaTakasa);
  var total = numModal(sc.bathJougeSousunpou);
  var totalJissoku = numModal(sc.bathJougeSousunpouJissoku);

  var totalMM = tenjou || ((furo||0)+(kankisen||0)+(agari||0)+(clear||0)) || 2400;
  var pxScale = 300 / totalMM;
  var baseY = 400; // 床(0mm)の位置

  function segY(mmFromFloor) { return baseY - mmFromFloor * pxScale; }

  var yAgariTop = segY(agari);
  var yFuroTop = segY(agari + (furo||0));
  var yKankisenTop = segY(agari + (furo||0) + (kankisen||0));
  var yTenjou = tenjou ? segY(tenjou) : yKankisenTop;

  // 床上がり
  if (agari) {
    svg += '<rect x="'+rx+'" y="'+yAgariTop+'" width="26" height="'+(baseY-yAgariTop)+'" fill="#e0e0e0" stroke="#888" stroke-width="1"/>';
  }
  // 風呂の高さ(製品)
  if (furo) {
    svg += '<rect x="'+rx+'" y="'+yFuroTop+'" width="26" height="'+(yAgariTop-yFuroTop)+'" fill="#dcecec" stroke="#00695c" stroke-width="1.3"/>';
    svg += '<text x="'+(rx+34)+'" y="'+((yFuroTop+yAgariTop)/2+4)+'" font-size="11" fill="#00695c">風呂の高さ：'+furo+'</text>';
  }
  // 換気扇の高さ
  if (kankisen) {
    svg += '<rect x="'+rx+'" y="'+yKankisenTop+'" width="26" height="'+(yFuroTop-yKankisenTop)+'" fill="#ffe0b2" stroke="#ef6c00" stroke-width="1.3"/>';
    svg += '<text x="'+(rx+34)+'" y="'+((yKankisenTop+yFuroTop)/2+4)+'" font-size="11" fill="#ef6c00">換気扇高さ：'+kankisen+'</text>';
  }
  // 天井とのクリア
  if (clear !== null && tenjou) {
    svg += '<rect x="'+rx+'" y="'+yTenjou+'" width="26" height="'+(yKankisenTop-yTenjou)+'" fill="#fff" stroke="#c0392b" stroke-width="1" stroke-dasharray="4,3"/>';
    svg += '<text x="'+(rx+34)+'" y="'+((yTenjou+yKankisenTop)/2+4)+'" font-size="11" fill="#c0392b">天井とのクリア：'+clear+'</text>';
  }
  // 天井ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+yTenjou+'" x2="'+(rx+260)+'" y2="'+yTenjou+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-30)+'" y="'+(yTenjou-6)+'" text-anchor="end" font-size="12" fill="#555">天井高さ'+(tenjou?'：'+tenjou:'')+'</text>';
  // 床ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+baseY+'" x2="'+(rx+260)+'" y2="'+baseY+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-30)+'" y="'+(baseY+16)+'" text-anchor="end" font-size="12" fill="#555">床構成'+(sc.bathYukaKousei?'：'+escHtmlModal(sc.bathYukaKousei):'')+'</text>';

  // 脱衣室高さ(別ブラケット・左側)
  if (datsui) {
    var yDatsuiTop = baseY - datsui * pxScale;
    svg += '<line x1="'+(rx-70)+'" y1="'+baseY+'" x2="'+(rx-70)+'" y2="'+yDatsuiTop+'" stroke="#5c6bc0" stroke-width="1"/>';
    svg += '<text x="'+(rx-80)+'" y="'+((baseY+yDatsuiTop)/2)+'" text-anchor="end" font-size="11" fill="#5c6bc0" transform="rotate(0)">脱衣室高さ：'+datsui+'</text>';
  }

  // スラブ寸法＋上下総寸法（床の下側。実寸スケールではなく見やすさ優先の固定オフセット）
  if (slab) {
    var ySlab = baseY + 35;
    svg += '<line x1="'+(rx-20)+'" y1="'+ySlab+'" x2="'+(rx+260)+'" y2="'+ySlab+'" stroke="#333" stroke-width="1"/>';
    svg += '<text x="'+(rx-30)+'" y="'+(ySlab+13)+'" text-anchor="end" font-size="12" fill="#555">スラブ寸法：'+slab+'</text>';
    svg += '<line x1="'+(rx+280)+'" y1="'+yTenjou+'" x2="'+(rx+280)+'" y2="'+ySlab+'" stroke="#00695c" stroke-width="1"/>';
    svg += '<text x="'+(rx+290)+'" y="'+((yTenjou+ySlab)/2-6)+'" font-size="11" fill="#00695c">上下総寸法：'+(total!==null?total:'?')+'</text>';
    if (totalJissoku !== null) {
      svg += '<text x="'+(rx+290)+'" y="'+((yTenjou+ySlab)/2+10)+'" font-size="11" fill="#c0392b">実測：'+totalJissoku+'</text>';
    }
  }

  // ---------- 左下：メモ・連絡事項 ----------
  svg += '<text x="30" y="'+(MY+40)+'" font-size="13" fill="#3b6d11">メモ・連絡事項</text>';
  var memo = sc.bathMemoRenraku || '';
  var memoLines = memo ? String(memo).split('\n') : ['(未入力)'];
  memoLines.forEach(function(line, i){
    svg += '<text x="30" y="'+(MY+64+i*16)+'" font-size="12" fill="#333">'+escHtmlModal(line)+'</text>';
  });
  var extraNotes = [];
  if (sc.bathSetchiHouhou) extraNotes.push('設置方法：'+sc.bathSetchiHouhou);
  if (sc.bathRemoconUmu) extraNotes.push('リモコン開口：'+sc.bathRemoconUmu + (sc.bathRemoconMemo?'（'+sc.bathRemoconMemo+'）':''));
  if (sc.bathHandbarHouhou) extraNotes.push('ハンドバー：'+sc.bathHandbarHouhou);
  if (sc.bathTsuriKanaguKubun || sc.bathTsuriKanaguSize) extraNotes.push('吊り金具：'+(sc.bathTsuriKanaguKubun||'?')+' / '+(sc.bathTsuriKanaguSize||'?')+' / 現地入れ'+(sc.bathTsuriKanaguGenchi||'?'));
  if (sc.bathWakuzaiAtsumi) extraNotes.push('枠材の厚み：'+sc.bathWakuzaiAtsumi);
  extraNotes.forEach(function(line, i){
    svg += '<text x="30" y="'+(MY+64+(memoLines.length+i+1)*16)+'" font-size="11" fill="#666">'+escHtmlModal(line)+'</text>';
  });

  // ---------- 右下：窓位置 ----------
  var wx = 695, wy = MY+40, wallW = 260, wallH = 260;
  svg += '<text x="'+(wx+wallW/2)+'" y="'+(wy-14)+'" text-anchor="middle" font-size="13" fill="#333">窓位置</text>';
  svg += '<rect x="'+wx+'" y="'+wy+'" width="'+wallW+'" height="'+wallH+'" fill="#eef3ee" stroke="#00695c" stroke-width="1.5"/>';
  var madoW = numModal(sc.bathMadoW), madoH = numModal(sc.bathMadoH);
  var madoUe = numModal(sc.bathMadoUe), madoShita = numModal(sc.bathMadoShita), madoHidari = numModal(sc.bathMadoHidari), madoMigi = numModal(sc.bathMadoMigi);
  var mW = madoW ? Math.min(wallW*0.6, madoW*0.15) : wallW*0.35;
  var mH = madoH ? Math.min(wallH*0.6, madoH*0.15) : wallH*0.35;
  var mx1 = wx + (madoHidari!=null && madoMigi!=null ? (madoHidari/(madoHidari+madoMigi))*(wallW-mW) : (wallW-mW)/2);
  var my1 = wy + (madoUe!=null && madoShita!=null ? (madoUe/(madoUe+madoShita))*(wallH-mH) : (wallH-mH)/2);
  svg += '<rect x="'+mx1+'" y="'+my1+'" width="'+mW+'" height="'+mH+'" fill="#dcecec" stroke="#004d40" stroke-width="1.5"/>';
  svg += '<line x1="'+wx+'" y1="'+(my1+mH/2)+'" x2="'+mx1+'" y2="'+(my1+mH/2)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW)+'" y1="'+(my1+mH/2)+'" x2="'+(wx+wallW)+'" y2="'+(my1+mH/2)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW/2)+'" y1="'+wy+'" x2="'+(mx1+mW/2)+'" y2="'+my1+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW/2)+'" y1="'+(my1+mH)+'" x2="'+(mx1+mW/2)+'" y2="'+(wy+wallH)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy-2)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoUe!=null?madoUe:'')+'</text>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy+wallH+14)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoShita!=null?madoShita:'')+'</text>';
  svg += '<text x="'+(wx-6)+'" y="'+(my1+mH/2+4)+'" text-anchor="end" font-size="10" fill="#004d40">'+(madoHidari!=null?madoHidari:'')+'</text>';
  svg += '<text x="'+(wx+wallW+6)+'" y="'+(my1+mH/2+4)+'" font-size="10" fill="#004d40">'+(madoMigi!=null?madoMigi:'')+'</text>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+4)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoW||'?')+'×'+(madoH||'?')+'</text>';

  svg += '</svg>';
  return svg;
}

function escHtmlModal(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
