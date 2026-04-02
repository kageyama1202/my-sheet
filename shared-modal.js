function openTestModal() {
  document.getElementById("test-modal").style.display = "block";
  document.getElementById("test-modal-overlay").style.display = "block";
}

function closeTestModal() {
  document.getElementById("test-modal").style.display = "none";
  document.getElementById("test-modal-overlay").style.display = "none";
}

// 保存処理（仮）
function saveTest() {
  const checked = document.getElementById("confirmCheck").checked;

  if (checked) {
    alert("施工日決定 → ON");
  } else {
    alert("未決定");
  }

  closeTestModal();
}

// ESCキーで閉じる
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeTestModal();
  }
});
