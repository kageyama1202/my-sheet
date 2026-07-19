/* user-scope.js
   複数ユーザー分離＋認証まわりの「唯一の正本」。

   【重要・今後のルール】
   認証関連のトラブルが繰り返し起きたため、Firebase初期化と認証セッションの
   整合性チェックはこのファイルに一本化した。各ページ側（sms.html等）で
   signInAnonymously() や独自の認証チェックを書くのは禁止。書くと今回の
   clipboard.htmlの事故（匿名ログインが本物のスタッフセッションを上書きし、
   全ページでPERMISSION_DENIEDになった）が再発する。

   全HTMLファイルで firebase-app.js / firebase-auth.js / firebase-database.js の
   直後・自分のfirebaseConfigスクリプトより前に読み込むこと（読み込み順はこれまで通り）。

   やること：
   1. Firebaseアプリをこのファイル自身が初期化する（各ページの重複initializeAppは
      無害な二重呼び出しとしてスキップされるので、既存ページの修正は不要）
   2. スタッフは localStorage にuserKeyが無ければ login.html にリダイレクト
   3. 閲覧者（viewerMode）は sessionStorage を使う → ブラウザ/タブを閉じると自動的にログアウト状態に戻る
   4. scopedDatabase(firebase.database()) で users/{userKey}/ 配下だけを見るDBラッパーを提供
   5. 画面右下に「誰としてログイン中か」バッジを表示（タップで切替）
   6. userKeyは残っているのにFirebase認証セッションだけ切れている状態を検知し、
      自動でログイン画面に戻す（このファイルの読み込み直後、各ページ自身のコードが
      動き出す前に監視を開始するので、ページ読み込み直後の書き込み失敗にも対応できる）
*/
(function () {
  var LOGIN_PAGE = 'login.html';
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDznSykpSebsejNdQtpOgfORuzZSoW3_fs",
    authDomain: "project-6745138395263517914.firebaseapp.com",
    databaseURL: "https://project-6745138395263517914-default-rtdb.firebaseio.com",
    projectId: "project-6745138395263517914",
    storageBucket: "project-6745138395263517914.firebasestorage.app",
    messagingSenderId: "1054295910908",
    appId: "1:1054295910908:web:4072df05bd90bbdc896a79"
  };

  // このファイルが最初にFirebaseを初期化する。各ページ自身の
  // `if(!firebase.apps.length)firebase.initializeApp(firebaseConfig)` は
  // その時点で既に初期化済みなので何もせずスキップされるだけで安全。
  if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

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

  // localStorage/sessionStorageにuserKeyは残っているが、Firebaseの実際の認証
  // セッション（トークン）が切れている場合を検知する。放置するとページは
  // 「ログイン中」に見えるのにDBの読み書きは全てPERMISSION_DENIEDになり、
  // データが「消えた」ように見える（実際は読めていないだけ）。
  // このファイルが自前でFirebaseを初期化するようになったので、この監視は
  // DOMContentLoadedを待たずページ読み込み直後（各ページ自身のコードより先）に開始できる。
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
  watchAuthSession();

  window.addEventListener('DOMContentLoaded', function () {
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
