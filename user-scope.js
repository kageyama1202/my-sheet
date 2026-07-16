/* user-scope.js
   複数ユーザー分離の共通スクリプト。
   全HTMLファイルで firebase-database.js の直後・自分のfirebaseConfigスクリプトより前に読み込むこと。

   やること：
   1. localStorageにuserKeyが無ければ login.html にリダイレクト
   2. scopedDatabase(firebase.database()) で users/{userKey}/ 配下だけを見るDBラッパーを提供
   3. 画面右下に「誰としてログイン中か」バッジを表示（タップで切替）
*/
(function () {
  var LOGIN_PAGE = 'login.html';

  var key = localStorage.getItem('userKey');
  if (!key) {
    var here = location.pathname.split('/').pop() || 'today.html';
    location.replace(LOGIN_PAGE + '?return=' + encodeURIComponent(here));
    return;
  }

  window.getUserKey = function () {
    return localStorage.getItem('userKey') || '';
  };

  window.getUserName = function () {
    return localStorage.getItem('userName') || window.getUserKey();
  };

  window.logoutUser = function () {
    localStorage.removeItem('userKey');
    localStorage.removeItem('userName');
    location.href = LOGIN_PAGE;
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

  window.addEventListener('DOMContentLoaded', function () {
    var badge = document.createElement('div');
    badge.textContent = '👤 ' + window.getUserName();
    badge.style.cssText = 'position:fixed;bottom:6px;right:6px;z-index:99999;'
      + 'background:rgba(0,0,0,0.65);color:#fff;font-size:11px;padding:4px 9px;'
      + 'border-radius:6px;cursor:pointer;font-family:sans-serif;user-select:none;';
    badge.onclick = function () {
      if (confirm('別のユーザーに切り替えますか？\n（' + window.getUserName() + ' からログアウトします）')) {
        window.logoutUser();
      }
    };
    document.body.appendChild(badge);
  });
})();
