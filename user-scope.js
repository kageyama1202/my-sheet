/* user-scope.js
   複数ユーザー分離の共通スクリプト。
   全HTMLファイルで firebase-database.js の直後・自分のfirebaseConfigスクリプトより前に読み込むこと。

   やること：
   1. スタッフは localStorage にuserKeyが無ければ login.html にリダイレクト
   2. 閲覧者（viewerMode）は sessionStorage を使う → ブラウザ/タブを閉じると自動的にログアウト状態に戻る
   3. scopedDatabase(firebase.database()) で users/{userKey}/ 配下だけを見るDBワッパーを提供
   4. 画面右下に「誰としてログイン中か」バッジを表示（タップで切替）
   5. 【追加】userKeyは残っているのにFirebase認証セッションだけ切れている状態を検知し、
      自動でログイン画面に戻す（全ページでPERMISSION_DENIENDになる不具合の対策）
*/
(function () {
  var LOGIN_PAGE = 'login.html';

  function isViewing() {
    return sessionStorage.getItem('viewerMode') === '1';
  }

  var key = isViewing() ? sessionStorage.getItem('userKey') : localStorage.getItem('userKey');
  if (!key) {
    var here = location.pathname.split('/').pop() || 'today.html';
    location.replace(LOGIN_PAGE + '?return=' + encodeURIComponent(here));
    return;
  }

  window.getUserKey = function () {
    return isViewing() ? (sessionStorage.getItem('userKey') || '') : (localStorage.getItem('userKey') || '');
  };

  window.getUserName = function () {
    if (isViewing()) return sessionStorage.getItem('userName') || window.getUserKey();
    return localStorage.getItem('userName') || window.getUserKey();
  };

  window.logoutUser = function () {
    localStorage.removeItem('userKey');
    localStorage.removeItem('userName');
    sessionStorage.removeItem('userKey');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('viewerMode');
    location.href = LOGIN_PAGE;
  };

  window.isViewerMode = isViewing;

  window.exitViewerMode = function () {
    sessionStorage.removeItem('userKey');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('viewerMode');
    location.href = 'viewer.html';
  };

  // firebase.database() をそのまま渡すと、以後 database.ref('foo') は
  // 実際には users/{userKey}/foo を指すようになる。
  // ref()で返るのは本物のFirebase Referenceなので、.once/.on/.update/.push/.transaction等
  // 既存コードの呼び出し方は一切変更不要。
  window.scopedDatabase = function (realDb) {
    var base = 'users/' + window.getUserKey();
    return {
      ref: function (path) {
        return (path === undefined || path === '')
          ? realDb.ref(base)
          : realDb.ref(base + '/' + path);
      }
    };
  };

  function forceRelogin() {
    localStorage.removeItem('userKey');
    localStorage.removeItem('userName');
    sessionStorage.removeItem('userKey');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('viewerMode');
    var here = location.pathname.split('/').pop() || 'today.html';
    location.replace(LOGIN_PAGE + '?return=' + encodeURIComponent(here));
  }

  // 【追加】localStorage/sessionStorageにuserKeyは残っているが、
  // Firebaseの実際の認証セッション（トークン）が切れている場合を検知する。
  // この状態を放置すると、ページは「ログイン中」に見えるのにDBへの読み書きは
  // 全てPERMISSION_DENIEDになる（ボタンを押した瞬間にエラーになる不具合の原因）。
  //
  // 注意：このファイルは firebase.initializeApp() より前に読み込まれる決まりなので、
  // ここではまだ firebase.auth() は使えない。そのためDOMContentLoaded後（＝各ページの
  // firebaseConfig初期化スクリプトが実行済みのタイミング）まで待ってからチェックする。
  function watchAuthSession() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length || !firebase.auth) return;
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      forceRelogin();
    }, 4000); // 4秒以内に認証状態が確定しなければセッション切れとみなす

    firebase.auth().onAuthStateChanged(function (user) {
      if (settled) return; // 初回判定のみ使う（以後のトークン自動更新等は無視）
      settled = true;
      clearTimeout(timer);
      if (!user) forceRelogin();
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    watchAuthSession();

    var viewing = window.isViewerMode();
    var badge = document.createElement('div');
    badge.textContent = (viewing ? '🔍 閲覧中: ' : '👤 ') + window.getUserName();
    badge.style.cssText = 'position:fixed;bottom:6px;right:6px;z-index:99999;'
      + (viewing
          ? 'background:rgba(21,101,192,0.85);'
          : 'background:rgba(0,0,0,0.65);')
      + 'color:#fff;font-size:11px;padding:4px 9px;'
      + 'border-radius:6px;cursor:pointer;font-family:sans-serif;user-select:none;';
    badge.onclick = function () {
      if (viewing) {
        if (confirm('担当者選択に戻りますか？')) {
          window.exitViewerMode();
        }
        return;
      }
      if (confirm('別のユーザーに切り替えますか？\n（' + window.getUserName() + ' からログアウトします）')) {
        window.logoutUser();
      }
    };
    document.body.appendChild(badge);
  });
})();
