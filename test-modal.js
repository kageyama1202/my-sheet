function openTestModal(){

  const html = `
    <div id="test-modal">
      <button onclick="closeTestModal()">閉じる</button>

      <h3>施工管理テスト</h3>

      <div class="test-tab">
        <button onclick="switchTestTab('info')" id="tab-info-btn" class="active">基本</button>
        <button onclick="switchTestTab('mail')" id="tab-mail-btn">メーラー</button>
      </div>

      <div id="tab-info" class="test-content active">
        <label>
          <input type="checkbox" id="testFlag"> 施工日決定
        </label>
      </div>

      <div id="tab-mail" class="test-content">
        <textarea id="testMail"></textarea>
        <br><br>
        <button onclick="saveTestMail()">仮保存</button>
        <button onclick="sendTestMail()">送信</button>
      </div>
    </div>
  `;

  const overlay = document.getElementById("test-modal-overlay");
  overlay.innerHTML = html;
  overlay.style.display = "block";

  document.getElementById("testMail").value = createTemplate();
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

function createTemplate(){
  return `施工日が確定しました。

よろしくお願いいたします。`;
}

function saveTestMail(){
  alert("仮保存OK（テスト）");
}

function sendTestMail(){
  const body = document.getElementById("testMail").value;
  location.href = `sms:?body=${encodeURIComponent(body)}`;
}
