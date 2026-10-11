<!DOCTYPE html>
<!-- VERSION: 2026-10-11-001 -->
<!-- CREATED: 2026-10-11 -->
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>浴室図面</title>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
<script src="user-scope.js"></script>
<script>
var firebaseConfig={apiKey:"AIzaSyDznSykpSebsejNdQtpOgfORuzZSoW3_fs",authDomain:"project-6745138395263517914.firebaseapp.com",databaseURL:"https://project-6745138395263517914-default-rtdb.firebaseio.com",projectId:"project-6745138395263517914",storageBucket:"project-6745138395263517914.firebasestorage.app",messagingSenderId:"1054295910908",appId:"1:1054295910908:web:4072df05bd90bbdc896a79"};
if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
</script>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;color:#1a1a1a;min-height:100vh;}
.header-bar{display:flex;align-items:center;gap:6px;background:#fff;border-bottom:1px solid #e0e0e0;padding:8px 10px;position:sticky;top:0;z-index:11;}
.header-bar .hb-title{font-size:13px;font-weight:600;color:#00695c;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hb-btn{display:flex;align-items:center;gap:4px;font-size:12px;padding:6px 10px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;color:#555;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;font-family:inherit;}
.hb-btn:active{background:#f5f5f5;}
.wrap{max-width:1000px;margin:0 auto;padding:12px;padding-bottom:3rem;}
.case-info{background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px;line-height:1.7;}
.case-info .ci-name{font-weight:bold;font-size:14px;}
.case-info .ci-sub{font-size:12px;color:#666;}
.status{font-size:12px;color:#888;text-align:center;padding:1.5rem 0;}
.status.err{color:#c62828;}
.hint{font-size:11px;color:#888;text-align:center;margin-bottom:10px;}
#render{background:#fff;}
.picker-search{width:100%;font-size:15px;padding:10px 12px;border:1px solid #d0d0d0;border-radius:8px;background:#fff;margin-bottom:10px;font-family:inherit;-webkit-appearance:none;}
.picker-search:focus{outline:none;border-color:#00695c;}
.pick-item{display:block;width:100%;text-align:left;background:#fff;border:1px solid #e8e8e8;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}
.pick-item:active{background:#f5f5f5;}
.pick-name{font-size:14px;font-weight:600;color:#1a1a1a;}
.pick-sub{font-size:11px;color:#888;margin-top:3px;}
.badge-has{display:inline-block;font-size:10px;color:#004d40;background:#e0f2f1;border:1px solid #80cbc4;border-radius:4px;padding:1px 5px;margin-left:6px;font-weight:normal;}
</style>
</head>
<body>

<div class="header-bar">
  <button class="hb-btn" onclick="goBack()">‹ 戻る</button>
  <span class="hb-title" id="hb-title">📐 浴室図面</span>
  <button class="hb-btn" id="hb-reload" style="display:none;" onclick="reloadCase()">🔄 再読込</button>
  <button class="hb-btn" id="hb-change" style="display:none;" onclick="showPicker()">案件変更</button>
  <a class="hb-btn" href="index.html">🏠 トップ</a>
</div>

<div class="wrap">
  <div id="msg" class="status">⏳ 読み込み中...</div>

  <div id="picker" style="display:none;">
    <div class="hint">図面を作る案件を選んでください（現地情報の入力は案件モーダルの「現場チェック」で行います）</div>
    <input type="text" id="picker-search" class="picker-search" placeholder="案件名・住所で絞り込み">
    <div id="picker-list"></div>
  </div>

  <div id="case-area" style="display:none;">
    <div class="case-info" id="case-info"></div>
    <div class="hint" id="draw-hint">各図は1枚ずつスクショして使えます</div>
    <div id="render"></div>
  </div>
</div>

<script src="bath-diagram.js"></script>
<script>
// bath-diagram.js が使う escHtmlModal() は本来 shared-modal.js 側にある。
// このページでは shared-modal.js を読み込まないため、同じ処理をここで用意する。
if (typeof escHtmlModal !== 'function') {
  window.escHtmlModal = function (s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  };
}

var db = null;
var allTasks = null;      // app_tasks 全体（案件選択用に一度だけ取得）
var currentKey = '';

function $(id) { return document.getElementById(id); }
function esc(s) { return window.escHtmlModal(s); }
function col(task, i) {
  var c = task && task.csvData;
  if (!c) return '';
  return (c[i] != null) ? String(c[i]) : '';
}

function setMsg(text, isErr) {
  var m = $('msg');
  if (!text) { m.style.display = 'none'; return; }
  m.style.display = 'block';
  m.className = 'status' + (isErr ? ' err' : '');
  m.textContent = text;
}

function goBack() {
  if (window.history.length > 1 && document.referrer) { history.back(); }
  else { location.href = 'today.html'; }
}

function getKeyFromUrl() {
  var m = location.search.match(/[?&]key=([^&]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

// ---------- 案件を読み込んで図面を描く ----------
function loadCase(key) {
  currentKey = key;
  $('picker').style.display = 'none';
  $('case-area').style.display = 'none';
  $('hb-reload').style.display = 'none';
  $('hb-change').style.display = 'none';
  setMsg('⏳ 案件データを読み込み中...');

  db.ref('app_tasks/' + key).once('value').then(function (snap) {
    var task = snap.val();
    if (!task) {
      setMsg('案件が見つかりませんでした。「案件変更」から選び直してください。', true);
      $('hb-change').style.display = '';
      return;
    }
    renderCase(key, task);
  }).catch(function (e) {
    setMsg('読み込みに失敗しました：' + (e && e.message ? e.message : e), true);
    $('hb-change').style.display = '';
  });
}

function renderCase(key, task) {
  var name = col(task, 4).trim() || '名称未設定';
  var sekou = col(task, 2).replace(/\s+/g, '') || '未定';
  var addr = col(task, 11).trim();

  var sc = {};
  var src = task.siteCheck || {};
  for (var k in src) { if (src.hasOwnProperty(k)) sc[k] = src[k]; }

  // 案件モーダルと同じ既定値（未設定のときだけ）。モーダル側は図面の描画時にこの既定を使っている。
  if (sc.bathDoorType == null || sc.bathDoorType === '') sc.bathDoorType = '開き戸';
  if ((sc.bathHikidoAtsumi == null || sc.bathHikidoAtsumi === '') && sc.bathDoorType === '開き戸') {
    sc.bathHikidoAtsumi = '30';
  }

  // 施工図画像はFirebaseに保存しない運用。モーダルから開いた時だけ、一時的にsessionStorageで受け取る。
  var usedSekouZu = false;
  try {
    var imgKey = sessionStorage.getItem('bathSekouZuImageKey');
    var img = sessionStorage.getItem('bathSekouZuImage');
    if (img && imgKey === key) { sc.bathSekouZuImage = img; usedSekouZu = true; }
  } catch (e) {}

  var info = '<div class="ci-name">🏷️ ' + esc(name) + '</div>'
           + '<div class="ci-sub">🔨 施工日 ' + esc(sekou) + (addr ? ' ｜ 📍 ' + esc(addr) : '') + '</div>';
  $('case-info').innerHTML = info;
  $('hb-title').textContent = '📐 ' + name;
  $('draw-hint').textContent = usedSekouZu
    ? '各図は1枚ずつスクショして使えます（平面図は施工図画像を使用中）'
    : '各図は1枚ずつスクショして使えます';

  try {
    $('render').innerHTML = buildBathDiagramSVG(sc);
  } catch (e) {
    $('render').innerHTML = '';
    setMsg('図面の作成でエラー：' + (e && e.message ? e.message : e), true);
    $('case-area').style.display = 'block';
    $('hb-reload').style.display = '';
    $('hb-change').style.display = '';
    return;
  }

  setMsg('');
  $('case-area').style.display = 'block';
  $('hb-reload').style.display = '';
  $('hb-change').style.display = '';
}

function reloadCase() { if (currentKey) loadCase(currentKey); }

// ---------- 案件選択（indexから来た時など、key指定が無い場合） ----------
function hasSiteCheck(t) {
  var s = t && t.siteCheck;
  if (!s) return false;
  for (var k in s) { if (s.hasOwnProperty(k) && k !== '__lastTab' && s[k] !== '' && s[k] != null) return true; }
  return false;
}
function isBathTask(t) { return col(t, 3).indexOf('SB') >= 0; }

function showPicker() {
  currentKey = '';
  $('case-area').style.display = 'none';
  $('hb-reload').style.display = 'none';
  $('hb-change').style.display = 'none';
  $('hb-title').textContent = '📐 浴室図面';
  try { history.replaceState(null, '', location.pathname); } catch (e) {}

  if (allTasks) { buildPicker(); return; }
  setMsg('⏳ 案件一覧を読み込み中...');
  db.ref('app_tasks').once('value').then(function (snap) {
    allTasks = snap.val() || {};
    buildPicker();
  }).catch(function (e) {
    setMsg('案件一覧の読み込みに失敗しました：' + (e && e.message ? e.message : e), true);
  });
}

function buildPicker() {
  setMsg('');
  $('picker').style.display = 'block';
  drawPickerList();
}

function drawPickerList() {
  var q = ($('picker-search').value || '').trim().toLowerCase();
  var rows = [];
  Object.keys(allTasks || {}).forEach(function (key) {
    var t = allTasks[key];
    if (!t || !t.csvData) return;
    if (!(hasSiteCheck(t) || isBathTask(t))) return; // 浴室(SB)案件、または現場チェック入力済みの案件だけ
    var name = col(t, 4).trim() || '名称未設定';
    var addr = col(t, 11).trim();
    if (q && (name + ' ' + addr).toLowerCase().indexOf(q) < 0) return;
    rows.push({ key: key, t: t, name: name, addr: addr, sekou: col(t, 2).replace(/\s+/g, ''), has: hasSiteCheck(t) });
  });
  rows.sort(function (a, b) {
    if (a.has !== b.has) return a.has ? -1 : 1;           // 現場チェック入力済みを上に
    if (!a.sekou && b.sekou) return 1;
    if (a.sekou && !b.sekou) return -1;
    return a.sekou < b.sekou ? -1 : (a.sekou > b.sekou ? 1 : 0);
  });

  var list = $('picker-list');
  if (!rows.length) {
    list.innerHTML = '<div class="status">該当する案件がありません</div>';
    return;
  }
  var h = '';
  rows.slice(0, 80).forEach(function (r) {
    h += '<button type="button" class="pick-item" data-key="' + esc(r.key) + '">'
       + '<div class="pick-name">' + esc(r.name) + (r.has ? '<span class="badge-has">現場チェック入力済</span>' : '') + '</div>'
       + '<div class="pick-sub">🔨 ' + esc(r.sekou || '未定') + (r.addr ? ' ｜ ' + esc(r.addr) : '') + '</div>'
       + '</button>';
  });
  if (rows.length > 80) h += '<div class="status">他 ' + (rows.length - 80) + ' 件（絞り込んでください）</div>';
  list.innerHTML = h;
}

$('picker-list').addEventListener('click', function (e) {
  var el = e.target;
  while (el && el !== this && !(el.getAttribute && el.getAttribute('data-key'))) el = el.parentNode;
  if (!el || el === this) return;
  var key = el.getAttribute('data-key');
  try { history.replaceState(null, '', '?key=' + encodeURIComponent(key)); } catch (err) {}
  loadCase(key);
});
$('picker-search').addEventListener('input', drawPickerList);

// ---------- 起動 ----------
window.addEventListener('load', function () {
  db = scopedDatabase(firebase.database());
  var key = getKeyFromUrl();
  if (key) loadCase(key);
  else showPicker();
});
</script>
</body>
</html>
