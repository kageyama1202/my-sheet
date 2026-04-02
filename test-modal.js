function openTestModal(){

  const html = `
    <div id="test-modal">
      <button onclick="closeTestModal()">閉じる</button>

      <h3>テストモーダル</h3>

      <div class="test-tab">
        <button onclick="switchTestTab('info')" id="tab-info-btn" class="active">基本</button>
        <button onclick="switchTestTab('mail')" id="tab-mail-btn">メーラー</button>
      </div>

      <div id="tab-info" class="test-content active">
        <label>
          <input type="checkbox" id="testFlag">施工日決定
        </label>
      </div>

      <div id="tab-mail" class="test-content">
        <textarea id="testMail"></textarea>
        <br>
        <button onclick="saveTestMail()">仮保存</button>
        <button onclick="sendTestMail()">送信</button>
      </div>
    </div>
  `;

  document.getElementById("test-modal-overlay").innerHTML = html;
  document.getElementById("test-modal-overlay").style.display = "block";

  document.getElementById("testMail").value = createTestTemplate();
}

function closeTestModal(){
  document.getElementById("test-modal-overlay").style.display = "none";
}

function switchTestTab(tab){

  document.querySelectorAll(".test-content")
    .forEach(el=>el.classList.remove("active"));

  document.getElementById("tab-"+tab).classList.add("active");

  document.querySelectorAll(".test-tab button")
    .forEach(el=>el.classList.remove("active"));

  document.getElementById("tab-"+tab+"-btn").classList.add("active");
}

function createTestTemplate(){
  return `施工日確定のお知らせです。

よろしくお願いします。`;
}

function saveTestMail(){
  alert("仮保存（テスト）");
}

function sendTestMail(){
  const body = document.getElementById("testMail").value;
  location.href = `sms:?body=${encodeURIComponent(body)}`;
}
