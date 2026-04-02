let currentTaskId = null;
let currentTaskData = null;

// ===== 開く =====
function openSharedModal(taskId, task){
  currentTaskId = taskId;
  currentTaskData = task;

  document.getElementById("modal-overlay").style.display = "block";

  renderModal(task);
}

// ===== 閉じる =====
function closeSharedModal(){
  document.getElementById("modal-overlay").style.display = "none";
}

// ===== 描画 =====
function renderModal(task){

  const html = `
    <button id="modal-close" onclick="closeSharedModal()">閉じる</button>

    <div id="modal-body">

      <div class="modal-title-row">
        ${task.name || "案件"}
        ${task.constructionConfirmed ? '<span class="flag-highlight">施工日確定</span>' : ''}
      </div>

      <!-- タブ -->
      <div class="modal-tabs">
        <button class="modal-tab active" data-tab="info">基本</button>
        <button class="modal-tab" data-tab="mailer">メーラー</button>
      </div>

      <!-- 基本 -->
      <div class="tab-content active" id="tab-info">

        <div class="modal-check-row">
          <label>
            <input type="checkbox" id="constructionFlag"
              ${task.constructionConfirmed ? "checked" : ""}>
            施工日決定
          </label>
        </div>

        <button class="modal-save-btn" onclick="saveTaskFlag()">保存</button>

      </div>

      <!-- メーラー -->
      <div class="tab-content" id="tab-mailer">

        <div class="mailer-box">

          <textarea id="mailBody" class="mailer-textarea"></textarea>

          <div class="mailer-actions">
            <button class="mailer-btn save" onclick="saveMail()">仮保存</button>
            <button class="mailer-btn send" onclick="sendNow()">今すぐ送信</button>
          </div>

        </div>

      </div>

    </div>
  `;

  document.getElementById("modal-content").innerHTML = html;

  setupTabs();

  document.getElementById("mailBody").value = createMailTemplate(task);

  document.getElementById("constructionFlag")
    .addEventListener("change", e=>{
      if(e.target.checked) switchTab("mailer");
    });
}

// ===== タブ =====
function setupTabs(){
  document.querySelectorAll(".modal-tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const tab = btn.dataset.tab;

      document.querySelectorAll(".modal-tab")
        .forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content")
        .forEach(c=>c.classList.remove("active"));

      document.getElementById("tab-" + tab)
        .classList.add("active");
    });
  });
}

function switchTab(name){
  document.querySelector(`[data-tab="${name}"]`).click();
}

// ===== フラグ保存 =====
async function saveTaskFlag(){
  const val = document.getElementById("constructionFlag").checked;

  await firebase.database()
    .ref("app_tasks/" + currentTaskId)
    .update({
      constructionConfirmed: val
    });

  alert("保存しました");
}

// ===== テンプレ =====
function createMailTemplate(task){
  return `お世話になっております。

施工日が確定しました。

■案件名：${task.name || ""}
■施工日：${task.date || ""}

よろしくお願いいたします。`;
}

// ===== 仮保存 =====
async function saveMail(){
  const body = document.getElementById("mailBody").value;

  await firebase.database()
    .ref("app_parked_mails")
    .push({
      taskId: currentTaskId,
      to: currentTaskData.phone || "",
      body: body,
      status: "pending",
      sendReadyAt: getNextMorning(),
      createdAt: Date.now()
    });

  alert("仮保存しました");
}

// ===== 送信 =====
function sendNow(){
  const body = document.getElementById("mailBody").value;
  const to = currentTaskData.phone;

  if(!to){
    alert("電話番号なし");
    return;
  }

  location.href = `sms:${to}?body=${encodeURIComponent(body)}`;
}

// ===== 朝9時 =====
function getNextMorning(){
  const d = new Date();
  d.setHours(9,0,0,0);

  if(Date.now() > d.getTime()){
    d.setDate(d.getDate() + 1);
  }

  return d.getTime();
}
