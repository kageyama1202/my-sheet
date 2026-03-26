// ① あなた専用の合言葉（キーを設定済み）
const firebaseConfig = {
  apiKey: "AIzaSyDznSykpSebsejNdQtpOgfORuzZSoW3_fs",
  authDomain: "project-6745138395263517914.firebaseapp.com",
  projectId: "project-6745138395263517914",
  storageBucket: "project-6745138395263517914.firebasestorage.app",
  messagingSenderId: "1054295910908",
  appId: "1:1054295910908:web:4072df05bd90bbdc896a79",
  measurementId: "G-S7B2K9G2SK",
  // 念のため、データベースの通信URLも指定しておきます
  databaseURL: "https://project-6745138395263517914-default-rtdb.firebaseio.com"
};

// ② Firebase（神様）を起動して接続
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ③ 【送信】「保存」ボタンを押したときの全自動処理
document.getElementById('send').addEventListener('click', function() {
  const name = document.getElementById('name').value;
  const text = document.getElementById('text').value;
  
  if (name === "" || text === "") return; // 空欄の場合は何もしない
  
  // データベース（chatという階層）に自動でデータを送る
  db.ref('chat').push().set({
    name: name,
    text: text
  });
  
  // 送信後に枠の中の文字を消す
  document.getElementById('text').value = '';
});

// ④ 【受信】データが追加されたら、全自動で画面に表示する処理
db.ref('chat').on('child_added', function(data) {
  const msg = data.val();
  const output = document.getElementById('output');
  // 集まったデータの下に、新しいデータを自動で書き足す
  output.innerHTML += '<p><strong>' + msg.name + '</strong>: ' + msg.text + '</p>';
});
