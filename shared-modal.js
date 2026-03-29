/* shared-modal.js — 共通モーダル（通信履歴+メモ付き） */

var FB_URL = "https://project-6745138395263517914-default-rtdb.firebaseio.com";
var modalCommData = null; // キャッシュ
var modalContactData = null; // キャッシュ

function normalizePhoneModal(raw) {
  if (!raw) return "";
  var s = raw.replace(/[\s\-\(\)\.\u200B\u200C\u200D\uFEFF]/g, "");
  s = s.replace(/^\+81/, "0");
  s = s.replace(/^81(?=\d{9,10})/, "0");
  s = s.replace(/[^0-9]/g, "");
  return s;
}

function extractEmailModal(fromStr) {
  if (!fromStr) return "";
  var m = fromStr.match(/<([^>]+)>/);
  if (m) return m[1].toLowerCase().trim();
  if (fromStr.indexOf("@") > -1) return fromStr.toLowerCase().trim();
  return "";
}

function generateTimeOptions() {
  var o = '<option value="">--:--</option>';
  for (var h = 8; h <= 20; h++) {
    var hh = ("0" + h).slice(-2);
    o += '<option value="' + hh + ':00">' + hh + ':00</option>';
    o += '<option value="' + hh + ':30">' + hh + ':30</option>';
  }
  return o;
}

function formatCommDate(dt) {
  try {
    var d = new Date(dt);
    var m = d.getMonth() + 1;
    var dd = d.getDate();
    var hh = ("0" + d.getHours()).slice(-2);
    var mm = ("0" + d.getMinutes()).slice(-2);
    return m + "/" + dd + " " + hh + ":" + mm;
  } catch (e) { return dt; }
}

function getSafeValModal(c, i) {
  if (!c) return "";
  if (Array.isArray(c)) return c.length > i && c[i] != null ? String(c[i]) : "";
  if (typeof c === "object") return c[i] != null ? String(c[i]) : "";
  return "";
}

function formatToYMDModal(ds) {
  if (!ds) return "";
  var d = String(ds).replace(/\s+/g, "").replace(/\//g, "-").replace(/\./g, "-");
  var p = d.split("-");
  if (p.length === 3) return p[0] + "-" + String(p[1]).padStart(2, "0") + "-" + String(p[2]).padStart(2, "0");
  return d;
}

// 通信データをロード（初回のみ）
function loadCommData(callback) {
  if (modalCommData !== null) { callback(modalCommData); return; }
  fetch(FB_URL + "/app_communications.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data) { modalCommData = []; callback([]); return; }
      var arr = Array.isArray(data) ? data : Object.values(data);
      modalCommData = arr.filter(function (r) { return r != null; });
      callback(modalCommData);
    })
    .catch(function () { modalCommData = []; callback([]); });
}

// 連絡先データをロード（初回のみ）
function loadContactData(callback) {
  if (modalContactData !== null) { callback(modalContactData); return; }
  fetch(FB_URL + "/app_contacts.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data) { modalContactData = {}; callback({}); return; }
      var arr = Array.isArray(data) ? data : Object.values(data);
      var map = {};
      for (var i = 0; i < arr.length; i++) {
        if (!arr[i]) continue;
        var email = (arr[i].email || "").toLowerCase().trim();
        if (email && !map[email]) map[email] = arr[i];
      }
      modalContactData = map;
      callback(map);
    })
    .catch(function () { modalContactData = {}; callback({}); });
}

// 案件に関連する通信を取得
function findCaseComms(csvData, allComms, contacts) {
  var phone = normalizePhoneModal(getSafeValModal(csvData, 6));
  var person = getSafeValModal(csvData, 5);
  var caseName = getSafeValModal(csvData, 4);
  var matched = [];

  for (var i = 0; i < allComms.length; i++) {
    var rec = allComms[i];
    if (!rec) continue;
    // SMS: 電話番号マッチ
    if (rec.src === "imessage" && phone) {
      var recPhone = normalizePhoneModal(rec.contact);
      if (recPhone === phone) {
        matched.push(rec);
        continue;
      }
    }
    // Gmail: 担当者メアドマッチ（連絡先から電話→メアド逆引き）
    if (rec.src === "gmail" && contacts) {
      var recEmail = extractEmailModal(rec.contact);
      // app_contactsで同じ電話番号を持つ人のメアドとマッチ
      for (var email in contacts) {
        var ct = contacts[email];
        if (ct.phone && normalizePhoneModal(ct.phone) === phone && email === recEmail) {
          matched.push(rec);
          break;
        }
      }
    }
  }

  // 日付順（新しい順）
  matched.sort(function (a, b) {
    var da = new Date(a.dt).getTime() || 0;
    var db = new Date(b.dt).getTime() || 0;
    return db - da;
  });

  return matched;
}

function renderCommTimeline(comms) {
  if (!comms || comms.length === 0) {
    return '<div class="comm-empty">📭 この案件に関連する通信はありません</div>';
  }
  var html = "";
  var limit = Math.min(comms.length, 50);
  for (var i = 0; i < limit; i++) {
    var rec = comms[i];
    var isSms = rec.src === "imessage";
    var dir = rec.dir === "sent" ? "↑送信" : "↓受信";
    html += '<div class="comm-item">';
    html += '<div class="comm-meta">';
    html += '<div><span class="comm-badge ' + (isSms ? "sms" : "gmail") + '">' + (isSms ? "💬 SMS" : "📧 Gmail") + '</span>';
    html += ' <span class="comm-dir">' + dir + '</span></div>';
    html += '<span class="comm-time">' + formatCommDate(rec.dt) + '</span>';
    html += '</div>';
    if (rec.subject) {
      html += '<div class="comm-subject">📋 ' + rec.subject + '</div>';
    }
    if (rec.body) {
      var body = rec.body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (body.length > 200) body = body.substring(0, 200) + "...";
      html += '<div class="comm-body">' + body + '</div>';
    }
    html += '</div>';
  }
  if (comms.length > 50) {
    html += '<div class="comm-empty">他 ' + (comms.length - 50) + ' 件（comm.htmlで全件表示）</div>';
  }
  return html;
}

// メインのモーダル表示関数
function openCaseModal(key, obj, globalHeaders, globalTasks, fullData, firebaseDB) {
  var cols = obj.csvData;
  if (!cols) return;

  var sekouStr = getSafeValModal(cols, 2).replace(/\s+/g, "") || "未定";
  var shitamiStr = formatToYMDModal(getSafeValModal(cols, 12)) || "未定";
  var yoteiStr = obj.date || "未定";
  var ankenText = getSafeValModal(cols, 4).trim() || "名称未設定";
  var timeOpts = generateTimeOptions();

  var html = '';
  // ヘッダー
  html += '<div class="modal-header-info">';
  html += '<div class="modal-date-row">🔨 施工日: ' + sekouStr + '　|　📋 下見日: ' + shitamiStr + '　|　📅 予定日: ' + yoteiStr + '</div>';
  html += '<div class="modal-title-row">🏷️ ' + ankenText;
  html += ' <button id="modal-copy-btn" class="modal-copy-btn">コピー</button>';
  html += '</div></div>';

  // CSVデータ
  html += '<div class="modal-section"><h4>📄 CSVデータ</h4>';
  html += '<table class="modal-table">';
  for (var idx = 0; idx < globalHeaders.length; idx++) {
    var val = getSafeValModal(cols, idx);
    var dh = val.replace(/\n|\r/g, '<br>');
    var ct = val.replace(/\s+/g, '');
    if (idx === 11 && ct !== "") dh = '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ct) + '" target="_blank" style="color:#0056b3;font-weight:bold;">🗺️ ' + val + '</a>';
    else if (idx === 6 && ct !== "") dh = '<a href="tel:' + ct + '" style="color:#0056b3;font-weight:bold;">📞 ' + val + '</a>';
    html += '<tr><th>' + (globalHeaders[idx] || '列' + (idx + 1)) + '</th><td>' + dh + '</td></tr>';
  }
  html += '</table></div>';

  // 進捗管理
  html += '<div class="modal-section"><h4 class="green">📝 進捗管理</h4>';
  html += '<div style="margin:10px 0;"><label style="font-weight:bold;font-size:13px;">🚦 ステータス:</label>';
  html += '<div id="kanban-bar" style="margin-top:6px;"></div>';
  html += '<div id="kanban-sf-note" style="margin-top:4px;font-size:11px;color:#888;"></div></div>';
  html += '<div class="modal-check-row">';
  html += '<label><input type="checkbox" id="modal-emailSent"' + (obj.emailSent ? ' checked' : '') + '> ✉️ 施工日確認メール済</label>';
  html += '<label><input type="checkbox" id="modal-finalReport"' + (obj.finalReport ? ' checked' : '') + '> 📋 最終報告完了</label>';
  html += '</div></div>';

  // 下見スケジュール
  html += '<div class="modal-section"><h4 class="green">📅 下見スケジュール</h4>';
  html += '<div class="modal-input-row"><label>📅 下見予定日:</label><input type="date" id="modal-date" value="' + (obj.date || '') + '" /></div>';
  html += '<div class="modal-input-row"><label>⏰ 予定時間:</label><select id="modal-time">' + timeOpts + '</select></div>';
  html += '<div class="modal-input-row"><label>🔢 下見順:</label><input type="number" id="modal-order" min="1" placeholder="番号" value="' + (obj.order || '') + '" /></div>';
  html += '</div>';

  // メモ欄
  html += '<div class="modal-section"><h4 class="blue">💬 メモ</h4>';
  html += '<textarea class="modal-memo" id="modal-memo" placeholder="自由にメモを入力...">' + (obj.memo || '') + '</textarea>';
  html += '</div>';

  // 通信履歴（後からロード）
  html += '<div class="modal-section"><h4 class="orange">📨 通信履歴 <span id="comm-count" class="comm-count">読み込み中...</span></h4>';
  html += '<div class="comm-timeline" id="modal-comm-area"><div class="comm-empty">⏳ 読み込み中...</div></div>';
  html += '</div>';

  // 保存ボタン
  html += '<div style="margin-top:18px;text-align:center;">';
  html += '<button class="modal-save-btn" id="modal-save-btn">💾 保存</button>';
  html += '<span class="modal-save-msg" id="modal-save-msg">✔ 保存しました</span>';
  html += '</div>';

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('modal-time').value = obj.time || '';

  // カンバンバー構築
  var kanbanStatuses = ['依頼', '連絡済', '下見日確定', '下見実施済', '報告書提出済'];
  var kanbanColors = ['#90a4ae', '#42a5f5', '#ffb300', '#66bb6a', '#26a69a'];
  var sfStatus = getSafeValModal(cols, 1).replace(/\s+/g, "");
  var sfMap = { '下見実施中': '連絡済', '下見日程確定': '下見日確定', '下見完了': '報告書提出済' };
  var currentStatus = obj.localStatus || (sfMap[sfStatus] || sfStatus) || '依頼';
  if (kanbanStatuses.indexOf(currentStatus) === -1) currentStatus = '依頼';

  var kanbanBar = document.getElementById('kanban-bar');
  var selectedStatus = currentStatus;

  kanbanStatuses.forEach(function (st, i) {
    var btn = document.createElement('div');
    btn.className = 'kanban-step';
    var isActive = kanbanStatuses.indexOf(selectedStatus) >= i;
    btn.style.background = isActive ? kanbanColors[i] : '#f5f5f5';
    btn.style.color = isActive ? '#fff' : '#999';
    btn.textContent = st;
    btn.addEventListener('click', function () {
      selectedStatus = st;
      var btns = kanbanBar.children;
      for (var j = 0; j < btns.length; j++) {
        var act = kanbanStatuses.indexOf(st) >= j;
        btns[j].style.background = act ? kanbanColors[j] : '#f5f5f5';
        btns[j].style.color = act ? '#fff' : '#999';
      }
    });
    kanbanBar.appendChild(btn);
  });
  document.getElementById('kanban-sf-note').textContent = 'SF側: ' + sfStatus;

  // コピーボタン
  document.getElementById('modal-copy-btn').addEventListener('click', function () {
    var self = this;
    navigator.clipboard.writeText(ankenText).then(function () {
      self.textContent = "✔ コピー完了！"; self.classList.add('copied');
      setTimeout(function () { self.textContent = "コピー"; self.classList.remove('copied'); }, 2000);
    });
  });

  // 保存ボタン
  document.getElementById('modal-save-btn').addEventListener('click', function () {
    var nd = document.getElementById('modal-date').value;
    var nt = document.getElementById('modal-time').value;
    var no = document.getElementById('modal-order').value;
    var es = document.getElementById('modal-emailSent').checked;
    var fr = document.getElementById('modal-finalReport').checked;
    var memo = document.getElementById('modal-memo').value;
    var updates = { date: nd, time: nt, order: no, localStatus: selectedStatus, emailSent: es, finalReport: fr, memo: memo };
    firebaseDB.ref('app_tasks/' + key).update(updates);
    globalTasks[key].date = nd; globalTasks[key].time = nt; globalTasks[key].order = no;
    globalTasks[key].localStatus = selectedStatus; globalTasks[key].emailSent = es;
    globalTasks[key].finalReport = fr; globalTasks[key].memo = memo;
    if (fullData) {
      fullData.app_tasks = globalTasks;
      localStorage.setItem('appData', JSON.stringify(fullData));
    }
    var msg = document.getElementById('modal-save-msg');
    msg.style.display = 'inline';
    setTimeout(function () { msg.style.display = 'none'; }, 2000);
    document.querySelector('.modal-date-row').innerHTML = '🔨 施工日: ' + sekouStr + '　|　📋 下見日: ' + shitamiStr + '　|　📅 予定日: ' + (nd || "未定");
  });

  // 通信履歴をロード
  loadCommData(function (allComms) {
    loadContactData(function (contacts) {
      var caseComms = findCaseComms(cols, allComms, contacts);
      document.getElementById('modal-comm-area').innerHTML = renderCommTimeline(caseComms);
      document.getElementById('comm-count').textContent = caseComms.length + '件';
    });
  });

  // モーダル閉じる
  document.getElementById('modal-close').addEventListener('click', function () {
    document.getElementById('modal-overlay').style.display = 'none';
  });
  document.getElementById('modal-overlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').style.display = 'none';
    }
  });
}
