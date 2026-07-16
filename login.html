<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>ログイン</title>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    background: #0f0f0f;
    color: #e8e8e8;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .box { width: 100%; max-width: 280px; text-align: center; }
  .box h1 { font-size: 17px; font-weight: 600; margin-bottom: 24px; color: #ccc; }
  #pin {
    width: 100%;
    font-size: 30px;
    letter-spacing: 10px;
    text-align: center;
    background: #1a1a1a;
    border: 1px solid #2e2e2e;
    border-radius: 10px;
    color: #e8e8e8;
    padding: 14px 8px;
    outline: none;
    -webkit-appearance: none;
  }
  #pin:focus { border-color: #4f8ef7; }
  #err { color: #e05c5c; font-size: 13px; margin-top: 10px; min-height: 18px; }
  #go {
    width: 100%;
    margin-top: 16px;
    background: #4f8ef7;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
  #go:active { opacity: 0.75; }
</style>
</head>
<body>
<div class="box">
  <h1>暗証番号を入力</h1>
  <input type="tel" id="pin" maxlength="8" inputmode="numeric" autocomplete="off" placeholder="••••" autofocus>
  <div id="err"></div>
  <button id="go" onclick="tryLogin()">入る</button>
</div>

<script>
var firebaseConfig={apiKey:"AIzaSyDznSykpSebsejNdQtpOgfORuzZSoW3_fs",authDomain:"project-6745138395263517914.firebaseapp.com",databaseURL:"https://project-6745138395263517914-default-rtdb.firebaseio.com",projectId:"project-6745138395263517914",storageBucket:"project-6745138395263517914.firebasestorage.app",messagingSenderId:"1054295910908",appId:"1:1054295910908:web:4072df05bd90bbdc896a79"};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

// 既にログイン済みならPIN画面を出さず即遷移
if (localStorage.getItem('userKey')) {
  goNext();
}

firebase.auth().signInAnonymously().catch(function (e) { console.warn('auth error', e); });

document.getElementById('pin').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') tryLogin();
});

function tryLogin() {
  var pin = document.getElementById('pin').value.trim();
  var errEl = document.getElementById('err');
  errEl.textContent = '';
  if (!pin) { errEl.textContent = '暗証番号を入力してください'; return; }

  // ここだけは全ユーザー共通の場所（config/authorized_pins）を直接参照する
  firebase.database().ref('config/authorized_pins/' + pin).once('value').then(function (snap) {
    var val = snap.val();
    if (!val || !val.userKey) {
      errEl.textContent = '暗証番号が違います';
      document.getElementById('pin').value = '';
      document.getElementById('pin').focus();
      return;
    }
    localStorage.setItem('userKey', val.userKey);
    localStorage.setItem('userName', val.name || val.userKey);
    goNext();
  }).catch(function (e) {
    console.error(e);
    errEl.textContent = '通信エラー、もう一度お試しください';
  });
}

function goNext() {
  var params = new URLSearchParams(location.search);
  var ret = params.get('return') || 'today.html';
  location.href = ret;
}
</script>
</body>
</html>
