// VERSION: 2026-07-23-005
const { onValueWritten } = require("firebase-functions/v2/database");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const path = require("path");

admin.initializeApp({
  databaseURL: "https://project-6745138395263517914-default-rtdb.firebaseio.com"
});

const SERVICE_ACCOUNT = path.join(__dirname, "service-account.json");

const HEADER = [
  "ID","ステータス","区分","管理名","打合担当","携帯",
  "下見依頼日","工務担当","施工業者","備考","住所全文",
  "施工日","下見日CSV","下見予定日FB","下見時間","順番"
];

let _authClient = null;
function getAuth() {
  if (!_authClient) {
    _authClient = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT,
      scopes: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });
  }
  return _authClient;
}

let _calendarClient = null;
function getCalendarClient() {
  if (!_calendarClient) {
    _calendarClient = google.calendar({ version: "v3", auth: getAuth() });
  }
  return _calendarClient;
}

let _sheetsClient = null;
function getSheetsClient() {
  if (!_sheetsClient) {
    _sheetsClient = google.sheets({ version: "v4", auth: getAuth() });
  }
  return _sheetsClient;
}

// ── ユーザー別設定の取得（users/{userKey}/config）。
// Cloud Functionsのインスタンスは使い回されるので、簡易メモリキャッシュを持つ。
// 5分でキャッシュを捨てて、user-admin.htmlでの変更が数分以内に反映されるようにする。
const _configCache = new Map(); // userKey -> { cfg, ts }
const CONFIG_TTL_MS = 5 * 60 * 1000;

async function getUserConfig(userKey) {
  const cached = _configCache.get(userKey);
  if (cached && (Date.now() - cached.ts) < CONFIG_TTL_MS) {
    return cached.cfg;
  }
  const db = admin.database();
  const snap = await db.ref(`/users/${userKey}/config`).get();
  const cfg = snap.val();
  if (!cfg) return null;
  if (!cfg.calendarSeko || !cfg.calendarShitami || !cfg.spreadsheetId || !cfg.sheetName) {
    console.warn("config incomplete for user", userKey, cfg);
  }
  _configCache.set(userKey, { cfg, ts: Date.now() });
  return cfg;
}

function normalizeCsv(csvData) {
  if (!csvData) return [];
  if (Array.isArray(csvData)) return csvData;
  const arr = [];
  Object.keys(csvData).forEach(k => { arr[parseInt(k)] = csvData[k]; });
  return arr;
}

function shortenTitle(title) {
  if (!title) return "";
  return title
    .replace(/【SB手配】/g, "SB ")
    .replace(/【SK手配】/g, "SK ")
    .replace(/【SU手配】/g, "SU ")
    .replace(/【その他】/g, "他 ")
    .replace(/\s{2,}/g, " ").trim();
}

function parseDateStr(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (!m) return null;
  const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

// ★2026-07-23追加・2026-07-23-005で列番号修正★
// 下見時間について、これまではFirebase側のtask.time（モーダルでの手動入力）だけを見ており、
// CSV（Salesforce由来の下見時間列）に値が入っていても、誰かが手動で時間欄を
// 触るまではシートにもGoogleカレンダーにも反映されなかった。
//
// 会社の運用ルールは「SalesforceのCSVが正。Firebaseへの直接入力は、CSVにまだ
// 反映されていない間の日々の仮運用に過ぎず、CSVに値が入った時点でそちらを
// 決定事項として優先する」というもの。そのため、CSVに値があれば常にCSVを優先し、
// CSVが空の間だけFirebase側の入力値（つなぎ運用中の値）を使うようにする。
// taskToRow（管理表シート用）とsyncTask（カレンダー用）の両方から共通で呼ぶ。
//
// 列番号について：taskToRowがcsv[1]〜csv[12]を連番で使っていることから、
// このCSVは 0:ID 1:ステータス 2:施工日 3:区分 4:管理名 5:打合担当 6:携帯
// 7:下見依頼日 8:工務担当 9:施工業者 10:備考 11:住所 12:下見日 という並びで、
// 下見時間はその次の13番目（インデックス13）にある。
// （today.htmlのUI表示側がインデックス16を参照しているのは別の古い/誤った実装で、
// 　常に空文字を拾っていたと思われるが、そちらは既存表示なので今回は触れていない）
function effectiveShitamiTime(task, csv) {
  const csvTime = String(csv[13] || "").trim();
  if (csvTime) return csvTime;
  return String(task.time || "").trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 6, baseDelay = 1000, label = "" } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e.code || e.status || (e.response && e.response.status);
      const retryable = status === 429 || status === 403 || status === 503 || status === 500;
      if (!retryable || i === retries) throw e;
      const delay = Math.round(baseDelay * Math.pow(2, i) + Math.random() * 500);
      console.log(`retry ${label} attempt ${i + 1} after ${delay}ms (status ${status})`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

// Firebaseトランザクションで排他ロックを取る。
// 既に値がある(=作成済み or 処理中)場合はfalseを返し、呼び出し元は作成をスキップする。
async function claimSlot(db, path) {
  const ref = db.ref(path);
  const result = await ref.transaction(current => {
    if (current) return; // abort: already exists or pending
    return "PENDING";
  });
  return result.committed;
}

// 作成に失敗した場合、PENDINGのままだと永久にロックされるので解放する。
async function releaseSlot(db, path) {
  const ref = db.ref(path);
  await ref.transaction(current => {
    if (current === "PENDING") return null;
    return; // 他の値ならそのまま(既に本物のIDが入っている場合など)
  });
}

function sv(v) {
  return v != null ? String(v) : "";
}

function taskToRow(id, task) {
  const csv = normalizeCsv(task.csvData);
  const pFb  = parseDateStr(task.date) || "";
  return [
    sv(id),
    sv(csv[1]),
    sv(csv[3]),
    sv(csv[4]),
    sv(csv[5]),
    sv(csv[6]),
    sv(csv[7]),
    sv(csv[8]),
    sv(csv[9]),
    sv(csv[10]),
    sv(csv[11]),
    sv(csv[2]),
    sv(csv[12]),
    pFb,
    effectiveShitamiTime(task, csv),
    sv(task.order),
  ];
}

async function getSheetIdMap(sheets, spreadsheetId, sheetName) {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    });
    const rows = res.data.values || [];
    const map = {};
    rows.forEach((r, i) => {
      if (i === 0) return;
      if (r[0]) map[String(r[0]).trim()] = i + 1;
    });
    return map;
  }, { label: "getSheetIdMap" });
}

async function upsertSheet(sheets, id, task, idMap, spreadsheetId, sheetName) {
  const row = taskToRow(id, task);
  const rowNum = idMap[id];
  return withRetry(async () => {
    if (rowNum) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowNum}:P${rowNum}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:P`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    }
  }, { label: "upsertSheet" });
}

async function deleteSheetRow(sheets, id, idMap, spreadsheetId, sheetName) {
  const rowNum = idMap[id];
  if (!rowNum) return;
  return withRetry(async () => {
    const ssRes = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = ssRes.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) return;
    const sheetId = sheet.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNum - 1,
              endIndex: rowNum,
            }
          }
        }]
      }
    });
  }, { label: "deleteSheetRow" });
}

async function upsertEvent(cal, calendarId, eventId, dateStr, title, location, desc) {
  const event = {
    summary: title,
    location: location || "",
    description: desc || "",
    start: { date: dateStr },
    end:   { date: dateStr },
  };
  return withRetry(async () => {
    if (eventId) {
      try {
        const res = await cal.events.update({ calendarId, eventId, requestBody: event });
        return res.data.id;
      } catch(e) {
        // ★2026-07-23修正★ Firebase側にevSekoId/evShiIdが残っているのに、
        // カレンダー側のイベント自体は既に削除済み（clearAllEvents実行後など）の場合、
        // Google Calendar APIは404ではなく410(Gone, "Resource has been deleted")を返す。
        // これまで404しかチェックしていなかったため410が「本物のエラー」として
        // 投げ直され、該当案件が毎回同じエラーで同期失敗し続けていた。
        const status = e.code || e.status || (e.response && e.response.status);
        if (status !== 404 && status !== 410) throw e;
      }
    }
    const res = await cal.events.insert({ calendarId, requestBody: event });
    return res.data.id;
  }, { label: "upsertEvent" });
}

async function deleteEvent(cal, calendarId, eventId) {
  if (!eventId) return;
  return withRetry(async () => {
    try {
      await cal.events.delete({ calendarId, eventId });
    } catch(e) {
      const status = e.code || e.status || (e.response && e.response.status);
      if (status !== 404 && status !== 410) throw e;
    }
  }, { label: "deleteEvent" });
}

// userKey: どのユーザーの案件か。cfg: {calendarSeko, calendarShitami, spreadsheetId, sheetName}
async function syncTask(userKey, id, task, idMap, cfg) {
  const db     = admin.database();

  // トリガー発火時点のスナップショット(task)は、この関数が実際にCalendar APIを呼ぶ
  // 頃には古くなっている場合がある（別の書き込みがほぼ同時に走り、そちらの処理の方が
  // 先に完了しているケース）。それを掴んだままカレンダーを更新すると、Firebase上の
  // 最新の順番/時間と、カレンダー表示がズレる（今回の不具合の原因）。
  // 実行直前にDBから読み直し、必ず最新の値でカレンダーに書き込むようにする。
  const freshSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).get();
  const freshTask = freshSnap.val();
  if (!freshTask) { console.log("skip: record no longer exists", userKey, id); return; }
  task = freshTask;

  const csv    = normalizeCsv(task.csvData);
  const status = String(csv[1] || "").trim();
  const cal    = getCalendarClient();
  const sheets = getSheetsClient();

  const base = `/users/${userKey}/app_tasks/${id}`;
  const evSekoId = task.evSekoId || "";
  const evShiId  = task.evShiId  || "";

  if (status === "完了") {
    await deleteEvent(cal, cfg.calendarSeko,    evSekoId);
    await deleteEvent(cal, cfg.calendarShitami, evShiId);
    await db.ref(`${base}/evSekoId`).remove();
    await db.ref(`${base}/evShiId`).remove();
    if (idMap) await deleteSheetRow(sheets, id, idMap, cfg.spreadsheetId, cfg.sheetName);
    // 行削除に伴い、シート作成ロックも解放しておく（万一ステータスが戻った際に再作成できるように）
    await db.ref(`${base}/sheetClaimed`).remove();
    return;
  }

  // ★修正箇所★
  // これまでは getSheetIdMap の結果（idMap）だけを見て「新規行なら append」していたが、
  // ほぼ同時に複数のトリガーが実行された場合、両方とも「まだシートに無い」と判断して
  // append を2回実行してしまい、同じIDの行が重複作成される（片方は古い/空のスナップショットの
  // まま止まる）バグがあった。これがスクリーンショットの「IDだけあって他が空欄」の行の原因。
  // カレンダーのイベント作成と同じく、Firebaseのトランザクション(claimSlot)で
  // 新規行作成の権利を1回だけに絞る。
  if (idMap) {
    const rowNum = idMap[id];
    if (rowNum) {
      // 既存行の更新はロック不要（他の実行と衝突しても最後に書いた内容で上書きされるだけ）
      await upsertSheet(sheets, id, task, idMap, cfg.spreadsheetId, cfg.sheetName);
    } else {
      const claimed = await claimSlot(db, `${base}/sheetClaimed`);
      if (claimed) {
        try {
          await upsertSheet(sheets, id, task, idMap, cfg.spreadsheetId, cfg.sheetName);
        } catch (e) {
          await releaseSlot(db, `${base}/sheetClaimed`);
          throw e;
        }
      } else {
        console.log("skip: sheet row already claimed/created by another execution", id);
      }
    }
  }

  const kubun    = String(csv[3]  || "").trim();
  const title    = String(csv[4]  || "").trim();
  const addrFull = String(csv[11] || "").replace(/[\r\n]+/g, "").trim();
  const talk     = String(csv[5]  || "").trim();
  const tel      = String(csv[6]  || "").trim();
  const komu     = String(csv[8]  || "").trim();
  const vendor   = String(csv[9]  || "").trim();
  const note     = String(csv[10] || "").trim();

  // 住所照合ツール（geocode）の結果があれば、ナビ精度向上のためlocationは緯度経度を優先する。
  const geo = task.geocode || null;
  const geoGoodForNav = geo && (geo.confidence === "exact" || geo.confidence === "high") && geo.lat != null && geo.lng != null;
  const eventLocation = geoGoodForNav ? ("https://www.google.com/maps?q=" + geo.lat + "," + geo.lng) : addrFull;
  const geoNeedsReview = geo && (geo.confidence === "low" || geo.confidence === "fail");
  const geoCandidatesText = (geo && geo.candidates && geo.candidates.length > 0)
    ? "📍丁目省略のため地番候補あり（要確認）:\n" + geo.candidates.map(c =>
        "・" + c.key + " https://maps.google.com/?q=" + c.lat + "," + c.lng
      ).join("\n")
    : "";

  const sekoStr = parseDateStr(csv[2]);
  const pCsv    = parseDateStr(csv[12]);
  const shitamiFields = ["date", "shitamiDate", "shitamiYoteiDate", "miDate", "previewDate", "shitami_date", "yoteiDate"];
  let pFb = null, pFbSource = null;
  for (const f of shitamiFields) {
    const v = parseDateStr(task[f]);
    if (v) { pFb = v; pFbSource = f; break; }
  }
  if (pFbSource) console.log("shitami date source field:", pFbSource, "id:", id, "user:", userKey);
  // ★2026-07-23修正★
  // これまでは pFb（Firebase側の手動入力日）を優先し、CSVの下見日(csv[12])は
  // Firebaseに何も入っていない時だけのフォールバックだった。
  // だが会社の運用ルールは「Salesforce(CSV)が正。Firebaseへの直接入力は、
  // CSVにまだ反映されていない間の仮運用にすぎず、CSVに値が入った時点でそちらを
  // 決定事項として優先する」というもの。日付・時間ともにCSV優先へ揃える。
  const pStr    = pCsv || pFb;
  const order   = String(task.order || "").trim();
  const time    = effectiveShitamiTime(task, csv);

  const kubunPfx  = kubun ? kubun + "｜" : "";
  const shortT    = shortenTitle(title || id);
  const sekoTitle = "施｜" + kubunPfx + shortT;

  // Googleカレンダーは同日の終日イベントをタイトル文字列でアルファベット順（数字が先頭）に並べる。
  // 順番の数字がタイトルの先頭に来ていないと、区分（リ／新）の文字の方が先に比較されて
  // 順番通りに並ばない。そのためゼロ埋めした順番を必ず一番前に置く。
  const orderNum  = parseInt(order, 10);
  const orderPfx  = (!isNaN(orderNum) && orderNum >= 1) ? String(orderNum).padStart(2, "0") + ". " : "";
  const timePfx   = time ? time + " " : "";
  const shiTitle  = orderPfx + "下｜" + kubunPfx + timePfx + shortT;

  const desc = [
    geoNeedsReview ? "⚠️住所要確認（住所照合ツールで座標を特定できませんでした）" : "",
    geoCandidatesText,
    addrFull,
    talk    ? "【担当】" + talk   : "",
    tel     ? "【携帯】" + tel    : "",
    sekoStr ? "施工日:" + sekoStr : "",
    pStr    ? "下見日:" + pStr   : "",
    komu    ? "【工務担当】" + komu : "",
    vendor  ? "【業者】" + vendor : "",
    note    ? "【備考】" + note   : "",
    task.memo ? "【メモ】" + task.memo : "",
  ].filter(x => x).join("\n");

  const updates = {};

  if (sekoStr) {
    // 施工イベントは終日のまま（時間指定なし）
    if (evSekoId) {
      const newId = await upsertEvent(cal, cfg.calendarSeko, evSekoId, sekoStr, sekoTitle, eventLocation, desc);
      if (newId !== evSekoId) updates.evSekoId = newId;
    } else {
      const claimed = await claimSlot(db, `${base}/evSekoId`);
      if (claimed) {
        try {
          const newId = await upsertEvent(cal, cfg.calendarSeko, null, sekoStr, sekoTitle, eventLocation, desc);
          await db.ref(`${base}/evSekoId`).set(newId);
        } catch (e) {
          await releaseSlot(db, `${base}/evSekoId`);
          throw e;
        }
      } else {
        console.log("skip: evSekoId already claimed/created by another execution", id);
      }
    }
  } else {
    await deleteEvent(cal, cfg.calendarSeko, evSekoId);
    if (evSekoId) updates.evSekoId = null;
  }

  if (pStr) {
    // 下見イベントは終日のまま（拾い忘れ防止のため時間指定にはしない）。
    // 表示順は shiTitle 先頭のゼロ埋め順番でGoogleカレンダーのアルファベット順ソートに乗せている。
    if (evShiId) {
      const newId = await upsertEvent(cal, cfg.calendarShitami, evShiId, pStr, shiTitle, eventLocation, desc);
      if (newId !== evShiId) updates.evShiId = newId;
    } else {
      const claimed = await claimSlot(db, `${base}/evShiId`);
      if (claimed) {
        try {
          const newId = await upsertEvent(cal, cfg.calendarShitami, null, pStr, shiTitle, eventLocation, desc);
          await db.ref(`${base}/evShiId`).set(newId);
        } catch (e) {
          await releaseSlot(db, `${base}/evShiId`);
          throw e;
        }
      } else {
        console.log("skip: evShiId already claimed/created by another execution", id);
      }
    }
  } else {
    await deleteEvent(cal, cfg.calendarShitami, evShiId);
    if (evShiId) updates.evShiId = null;
  }

  if (Object.keys(updates).length > 0) {
    await db.ref(base).update(updates);
  }
}

// evShiId・evSekoId以外の変更があるか判定（再トリガー防止用）
function hasMeaningfulChange(before, after) {
  if (!before) return true;
  const strip = (obj) => {
    const { evShiId, evSekoId, ...rest } = obj || {};
    return JSON.stringify(rest);
  };
  return strip(before) !== strip(after);
}

// ★2026-07-22追加★
// レコード削除（admin.htmlのCSV再取込で「CSVから消えた案件」として自動削除された場合や、
// 「完了」一括削除ボタンで消された場合）時に、対応するGoogleカレンダーのイベントと
// 管理表シートの行を一切削除していなかったバグを修正。
// これまでは削除されたレコードのevSekoId/evShiIdがそのままGoogleカレンダーに残り続け、
// 同じ案件が（IDの表記ゆれ等で）別キーとして後日再作成されたときに、
// 古い孤児イベント＋新しいイベントの「重複」として見える不具合の原因になっていた。
async function cleanupDeletedTask(userKey, id, before) {
  if (!before) return;
  const cfg = await getUserConfig(userKey);
  if (!cfg) {
    console.error("no config for user, skipping cleanup on delete:", userKey, id);
    return;
  }
  try {
    const cal = getCalendarClient();
    await deleteEvent(cal, cfg.calendarSeko,    before.evSekoId || "");
    await deleteEvent(cal, cfg.calendarShitami, before.evShiId  || "");
    if (cfg.spreadsheetId && cfg.sheetName) {
      const sheets = getSheetsClient();
      const idMap  = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);
      await deleteSheetRow(sheets, id, idMap, cfg.spreadsheetId, cfg.sheetName);
    }
    console.log("cleaned up deleted record:", userKey, id);
  } catch(e) {
    console.error("cleanupDeletedTask error", userKey, id, e);
  }
}

// トリガーパスが /users/{userKey}/app_tasks/{id} になった点が今回の変更点。
exports.onTaskChanged = onValueWritten(
  {
    ref: "/users/{userKey}/app_tasks/{id}",
    region: "us-central1",
    // ★2026-07-31追加★
    // 大量の案件がほぼ同時に更新される場面（CSV一括復旧作業など）で、
    // 1台のインスタンスが多数のリクエストを同時に抱えてメモリ不足(256MiB超過)を起こし、
    // プロセスごと強制終了される事象を確認（順番のズレがcatchされずに消えていた原因）。
    // メモリを増やし、1インスタンスあたりの同時処理数を絞ることで、
    // 同時多発時は「インスタンスを増やして捌く」方向に倒す。
    memory: "512MiB",
    concurrency: 4,
  },
  async (event) => {
    const userKey = event.params.userKey;
    const id      = event.params.id;
    const after   = event.data.after.val();
    const before  = event.data.before.val();

    if (!after) {
      // レコード削除時：カレンダー・シートの後始末をしてから抜ける（★修正箇所★）
      await cleanupDeletedTask(userKey, id, before);
      return null;
    }

    if (!hasMeaningfulChange(before, after)) {
      console.log("skip re-trigger:", userKey, id);
      return null;
    }

    const cfg = await getUserConfig(userKey);
    if (!cfg) {
      console.error("no config for user, skipping sync:", userKey, id);
      return null;
    }

    try {
      const sheets = getSheetsClient();
      const idMap  = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);
      await syncTask(userKey, id, after, idMap, cfg);
      // ★追加：過去に失敗マーカーが残っていれば消す（今回成功したので）
      await admin.database().ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
    } catch(e) {
      console.error("syncTask error", userKey, id, e);
      // ★追加：レート制限等でリトライを使い切って失敗した場合、
      // ここに印を残しておく。healSyncFailures が定期的にこの印だけを
      // 狙い撃ちして再同期を試みる（全件再同期はしない＝通信量を抑える）。
      await admin.database().ref(`/users/${userKey}/sync_failures/${id}`).set({
        error: String((e && e.message) || e),
        failedAt: Date.now()
      }).catch(() => {});
    }
    return null;
  }
);

// 呼び出し例: https://.../syncAll?userKey=kageyama
exports.syncAll = onRequest(
  { region: "us-central1", timeoutSeconds: 540, cors: true },
  async (req, res) => {
    const userKey = req.query.userKey;
    if (!userKey) {
      res.status(400).json({ error: "userKey is required (e.g. ?userKey=kageyama)" });
      return;
    }
    try {
      const cfg = await getUserConfig(userKey);
      if (!cfg) {
        res.status(400).json({ error: "no config found for userKey: " + userKey });
        return;
      }

      const db     = admin.database();
      const sheets = getSheetsClient();
      const snap   = await db.ref(`/users/${userKey}/app_tasks`).get();
      const tasks  = snap.val() || {};
      const ids    = Object.keys(tasks);

      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: cfg.spreadsheetId,
        range: `${cfg.sheetName}!A1:P1`,
      });
      const existingHeader = (headerRes.data.values || [[]])[0];
      if (!existingHeader || existingHeader[0] !== "ID") {
        await sheets.spreadsheets.values.update({
          spreadsheetId: cfg.spreadsheetId,
          range: `${cfg.sheetName}!A1:P1`,
          valueInputOption: "RAW",
          requestBody: { values: [HEADER] },
        });
      }

      const idMap = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);

      let ok = 0, err = 0;
      const errors = [];
      for (const id of ids) {
        try {
          await syncTask(userKey, id, tasks[id], idMap, cfg);
          ok++
          await sleep(1000);
        } catch(e) {
          console.error(id, e.message);
          errors.push({ id: id, message: String(e.message || e) });
          err++;
        }
      }

      // 施工日順にソート（2行目以降、L列=施工日）
      try {
        const ssRes = await sheets.spreadsheets.get({ spreadsheetId: cfg.spreadsheetId });
        const sheet = ssRes.data.sheets.find(s => s.properties.title === cfg.sheetName);
        if (sheet) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: cfg.spreadsheetId,
            requestBody: {
              requests: [{
                sortRange: {
                  range: {
                    sheetId: sheet.properties.sheetId,
                    startRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 16,
                  },
                  sortSpecs: [{
                    dimensionIndex: 11, // L列=施工日
                    sortOrder: "ASCENDING",
                  }]
                }
              }]
            }
          });
        }
      } catch(e) {
        console.error("sort error", e.message);
      }

      res.json({ ok, err, total: ids.length, userKey, errors });
    } catch(e) {
      res.status(500).json({ error: e.toString() });
    }
  }
);

// 個人（プライベート/緊急下書き）カレンダーを読み、users/{userKey}/personal_calendar に反映する。
// GAS版(calendar_sync.gs)の後継。サービスアカウントに対象カレンダーが共有されている必要がある。
// 呼び出し例: https://.../syncPersonalCalendar?userKey=kageyama
//
// ★修正(2026-07-22)★
// 「無題」の終日予定がタイトル未入力のまま画面に出続けるバグの原因：
// events.list はデフォルトで「自分が招待されたが辞退(declined)した予定」も
// 返してくる。Googleカレンダーの通常画面では辞退済みの予定は表示されないため、
// 本人には見えない予定がこの同期処理経由でだけ Firebase に紛れ込んでいた。
// 各予定の attendees の中から自分自身(self:true)のエントリを探し、
// responseStatus が "declined" なら同期対象から除外する。
exports.syncPersonalCalendar = onRequest(
  { region: "us-central1", timeoutSeconds: 120, cors: true },
  async (req, res) => {
    const userKey = req.query.userKey;
    if (!userKey) {
      res.status(400).json({ status: "error", message: "userKey is required (e.g. ?userKey=kageyama)" });
      return;
    }
    try {
      const cfg = await getUserConfig(userKey);
      if (!cfg || !cfg.calendarPersonal) {
        res.status(400).json({ status: "error", message: "no calendarPersonal configured for userKey: " + userKey });
        return;
      }

      const cal = getCalendarClient();
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日先まで

      const result = await withRetry(() => cal.events.list({
        calendarId: cfg.calendarPersonal,
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      }), { label: "syncPersonalCalendar" });

      const allEvents = result.data.items || [];

      // デバッグ用：無題として弾かれる/残る候補を診断できるよう、タイトル無しイベントは
      // 生JSONをログに残しておく（Firebase Consoleの Functions > ログ で確認可能）
      allEvents.forEach(ev => {
        if (!ev.summary) {
          console.log("no-summary event raw:", JSON.stringify(ev));
        }
      });

      // 辞退済み(declined)の招待予定を除外
      // ＋ eventType が "default"（通常の予定）以外のもの（Working Location／Out of
      // Office／Focus Time など、Googleカレンダーが自動生成する特殊イベント）も除外する。
      // これらは summary（タイトル）フィールド自体を持たないため "(無題)" として
      // 紛れ込み、かつ通常の日表示では別枠扱いで目立たない/見えないことがある。
      const events = allEvents.filter(ev => {
        if (ev.eventType && ev.eventType !== "default") return false;
        if (!ev.attendees) return true; // 招待じゃない普通の予定はそのまま残す
        const me = ev.attendees.find(a => a.self);
        return !me || me.responseStatus !== "declined";
      });

      const grouped = {};
      events.forEach(ev => {
        const allDay = !!(ev.start && ev.start.date);
        const dateStr = (ev.start && (ev.start.date || (ev.start.dateTime || "").slice(0, 10))) || "";
        if (!dateStr) return;
        if (!grouped[dateStr]) grouped[dateStr] = {};
        grouped[dateStr][ev.id] = {
          title: ev.summary || "(無題)",
          start: (ev.start && (ev.start.dateTime || ev.start.date)) || "",
          end:   (ev.end   && (ev.end.dateTime   || ev.end.date))   || "",
          allDay: allDay,
        };
      });

      const db = admin.database();
      // 30日先までの内容で丸ごと置き換える（削除された予定も反映されるように）
      await db.ref(`/users/${userKey}/personal_calendar`).set(grouped);

      res.json({ status: "ok", count: events.length, excludedDeclined: allEvents.length - events.length, userKey });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.toString() });
    }
  }
);

// 呼び出し例: https://.../clearAllEvents?userKey=kageyama
exports.clearAllEvents = onRequest(
  { region: "us-central1", timeoutSeconds: 540, cors: true },
  async (req, res) => {
    const userKey = req.query.userKey;
    if (!userKey) {
      res.status(400).json({ error: "userKey is required (e.g. ?userKey=kageyama)" });
      return;
    }
    try {
      const cfg = await getUserConfig(userKey);
      if (!cfg) {
        res.status(400).json({ error: "no config found for userKey: " + userKey });
        return;
      }

      const cal = getCalendarClient();
      const cals = [cfg.calendarSeko, cfg.calendarShitami];
      let deleted = 0;
      for (const calId of cals) {
        let pageToken = null;
        do {
          const r = await cal.events.list({
            calendarId: calId,
            maxResults: 250,
            pageToken: pageToken,
          });
          const items = r.data.items || [];
          for (const ev of items) {
            await cal.events.delete({ calendarId: calId, eventId: ev.id });
            deleted++;
            await sleep(100);
          }
          pageToken = r.data.nextPageToken;
        } while (pageToken);
      }
      res.json({ deleted, userKey });
    } catch(e) {
      res.status(500).json({ error: e.toString() });
    }
  }
);
/* ============================================================
   issueViewerToken：上役PIN→閲覧用トークン発行
   ============================================================ */
exports.issueViewerToken = onRequest({ cors: true }, async (req, res) => {
  try {
    const pin = (req.query.pin || (req.body && req.body.pin) || "").toString().trim();

    if (!pin) {
      res.status(400).json({ status: "error", message: "PINが未指定です" });
      return;
    }

    const db = admin.database();
    const pinSnap = await db.ref("config/viewer_pins/" + pin).once("value");

    if (!pinSnap.exists()) {
      await new Promise((r) => setTimeout(r, 800));
      res.status(401).json({ status: "error", message: "PINが正しくありません" });
      return;
    }

    const pinData = pinSnap.val() || {};
    const viewerUid = "viewer_" + pin;

    const customToken = await admin.auth().createCustomToken(viewerUid, {
      role: "viewer",
      viewerName: pinData.name || "上役",
    });

    res.status(200).json({
      status: "ok",
      token: customToken,
      name: pinData.name || "上役",
    });
  } catch (err) {
    console.error("issueViewerToken エラー:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});
/* ============================================================
   issueStaffToken：スタッフPIN→スタッフ用トークン発行
   -----------------------------------------------------------
   ★修正: config/authorized_pins/{pin} に "admin": true が
     設定されている場合、カスタムトークンに admin: true クレームを
     付与する。これにより Realtime Database ルール側で
     「auth.token.admin === true」を許可条件に加えるだけで、
     そのPINの持ち主だけ users/ 配下の全ユーザーに対して
     読み書きできるようになる（user-admin.html での新規ユーザー
     登録に必要）。admin未設定のPINは今まで通りstaffのまま。
   ============================================================ */

exports.issueStaffToken = onRequest({ cors: true }, async (req, res) => {
  try {
    const pin = (req.query.pin || (req.body && req.body.pin) || "").toString().trim();

    if (!pin) {
      res.status(400).json({ status: "error", message: "PINが未指定です" });
      return;
    }

    const db = admin.database();
    const pinSnap = await db.ref("config/authorized_pins/" + pin).once("value");
    const pinData = pinSnap.val();

    if (!pinData || !pinData.userKey) {
      await new Promise((r) => setTimeout(r, 800));
      res.status(401).json({ status: "error", message: "PINが正しくありません" });
      return;
    }

    const staffUid = "staff_" + pinData.userKey;

    const customToken = await admin.auth().createCustomToken(staffUid, {
      role: "staff",
      userKey: pinData.userKey,
      admin: !!pinData.admin,
    });

    res.status(200).json({
      status: "ok",
      token: customToken,
      userKey: pinData.userKey,
      name: pinData.name || pinData.userKey,
    });
  } catch (err) {
    console.error("issueStaffToken エラー:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});
/* ============================================================
   issueKariToken：仮予約フォーム専用PIN→専用トークン発行
   -----------------------------------------------------------
   config/kari_pins/{pin} を見て、存在すれば kari: true のクレーム
   だけを持つカスタムトークンを発行する。admin/staffとは完全に
   別権限で、Realtime Databaseルール上も kari_yoyaku_slots ノード
   以外には一切アクセスできない（他の関数・既存データには影響なし）。
   ============================================================ */

exports.issueKariToken = onRequest({ cors: true }, async (req, res) => {
  try {
    const pin = (req.query.pin || (req.body && req.body.pin) || "").toString().trim();

    if (!pin) {
      res.status(400).json({ status: "error", message: "PINが未指定です" });
      return;
    }

    const db = admin.database();
    const pinSnap = await db.ref("config/kari_pins/" + pin).once("value");
    const pinData = pinSnap.val();

    if (!pinData) {
      await new Promise((r) => setTimeout(r, 800));
      res.status(401).json({ status: "error", message: "PINが正しくありません" });
      return;
    }

    const kariUid = "kari_" + pin;

    const customToken = await admin.auth().createCustomToken(kariUid, {
      role: "kari",
      kari: true,
      name: pinData.name || "仮予約担当",
    });

    res.status(200).json({
      status: "ok",
      token: customToken,
      name: pinData.name || "仮予約担当",
    });
  } catch (err) {
    console.error("issueKariToken エラー:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

/* ============================================================
   onKariStatusChanged：仮予約(kari_yoyaku_slots)の確定/確定解除を検知し、
   Googleカレンダー(下見カレンダー)へのイベント作成・削除と、
   管理表シートへの行追加・削除を行う。

   ★設計方針★
   - 既存のonTaskChanged・syncTask・app_tasks関連コードには一切触れない。
     完全に独立した新規トリガー。
   - シートの列は本来「実案件」用の意味(施主名・住所等)を持つが、
     ユーザーの要望により「施工日/下見日列に日付を入れて、日付順で
     並んだ時に他の予定と一緒に目に入るようにする」ことを優先し、
     列の本来の意味には従わない。IDを "KARI-" 接頭辞にすることで
     実案件の行と明確に区別できるようにしてある。
   - kari_gcal_event_id という新しいフィールドを仮予約データに書き足すが、
     これによる再トリガーで無限ループしないよう、evShiId等と同様に
     この項目だけを除外して「意味のある変更か」を判定している。
   ============================================================ */
function kariHasMeaningfulChange(before, after) {
  if (!before) return true;
  const strip = (obj) => {
    const { kari_gcal_event_id, ...rest } = obj || {};
    return JSON.stringify(rest);
  };
  return strip(before) !== strip(after);
}

exports.onKariStatusChanged = onValueWritten(
  { ref: "/users/{userKey}/kari_yoyaku_slots/{date}/{id}", region: "us-central1" },
  async (event) => {
    const userKey = event.params.userKey;
    const date    = event.params.date;
    const id      = event.params.id;
    const after   = event.data.after.val();
    const before  = event.data.before.val();

    if (!kariHasMeaningfulChange(before, after)) {
      console.log("skip re-trigger (kari):", userKey, date, id);
      return null;
    }

    const wasConfirmed = !!(before && before.status === "確定");
    const isConfirmed  = !!(after && after.status === "確定");

    if (!isConfirmed && !wasConfirmed) return null; // 仮のまま同士の変更は無視
    if (isConfirmed && wasConfirmed) return null;   // 確定済み同士の変更（作成済みのはず）は無視

    const db  = admin.database();
    const cfg = await getUserConfig(userKey);
    if (!cfg || !cfg.calendarShitami) {
      console.error("no calendarShitami config, skip kari sync:", userKey);
      return null;
    }

    // ---- 仮 → 確定：カレンダー・シートに新規作成 ----
    if (isConfirmed && !wasConfirmed) {
      const cal = getCalendarClient();
      const title = "🟠確定 " + (after.start || "") + " " + (after.case_name || "(無題)") + "（" + (after.tantou || "") + "）";
      const desc = [
        after.area  ? "住所（簡易）：" + after.area  : "",
        after.email ? "メール：" + after.email       : "",
        after.tel   ? "電話："   + after.tel         : "",
        after.memo  ? "メモ："   + after.memo        : "",
        "※仮予約ページからの自動登録"
      ].filter(x => x).join("\n");

      let eventId = null;
      try {
        const res = await withRetry(() => cal.events.insert({
          calendarId: cfg.calendarShitami,
          requestBody: { summary: title, description: desc, start: { date }, end: { date } }
        }), { label: "kariEventInsert" });
        eventId = res.data.id;
      } catch (e) {
        console.error("kari gcal insert error", userKey, date, id, e.message);
      }

      if (cfg.spreadsheetId && cfg.sheetName) {
        try {
          const sheets = getSheetsClient();
          const row = [
            "KARI-" + id,                 // A ID
            "仮予約確定",                  // B ステータス
            "",                            // C 区分
            "🟠" + (after.case_name || ""), // D 管理名
            after.tantou || "",            // E 打合担当
            after.tel || "",               // F 携帯
            "",                            // G 下見依頼日
            "",                            // H 工務担当
            "",                            // I 施工業者
            [after.email ? "メール:" + after.email : "", after.memo || ""].filter(x => x).join(" / "), // J 備考
            after.area || "",              // K 住所
            date,                          // L 施工日 ← 日付順ソートに乗せるためここにkari日付を入れる
            date,                          // M 下見日CSV
            "",                            // N 下見予定日FB
            after.start || "",             // O 下見時間
            ""                             // P 順番
          ];
          await withRetry(() => sheets.spreadsheets.values.append({
            spreadsheetId: cfg.spreadsheetId,
            range: `${cfg.sheetName}!A:P`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [row] }
          }), { label: "kariSheetAppend" });
        } catch (e) {
          console.error("kari sheet append error", userKey, date, id, e.message);
        }
      }

      if (eventId) {
        await db.ref(`/users/${userKey}/kari_yoyaku_slots/${date}/${id}/kari_gcal_event_id`).set(eventId);
      }
      return null;
    }

    // ---- 確定 → 仮に戻された／削除された：カレンダー・シートから削除 ----
    if (wasConfirmed && !isConfirmed) {
      const cal = getCalendarClient();
      const eventId = before.kari_gcal_event_id;
      if (eventId) {
        try {
          await cal.events.delete({ calendarId: cfg.calendarShitami, eventId });
        } catch (e) {
          const status = e.code || e.status || (e.response && e.response.status);
          if (status !== 404 && status !== 410) console.error("kari gcal delete error", userKey, date, id, e.message);
        }
      }
      if (cfg.spreadsheetId && cfg.sheetName) {
        try {
          const sheets = getSheetsClient();
          const idMap  = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);
          await deleteSheetRow(sheets, "KARI-" + id, idMap, cfg.spreadsheetId, cfg.sheetName);
        } catch (e) {
          console.error("kari sheet delete error", userKey, date, id, e.message);
        }
      }
      return null;
    }

    return null;
  }
);

/* ============================================================
   healSyncFailures：失敗した同期だけを狙い撃ちして自動修復する。

   ★設計方針（通信量を抑えるため）★
   - syncAll のような全件再同期は絶対にしない。
   - 見に行くのは /users/{userKey}/sync_failures という小さいノードだけ
     （平常時は空。中身があるのは実際に失敗した案件だけ）。
   - userKeyの列挙は /users 全体を読むと重いので、既知のスタッフを
     ここに直接書く。新しいスタッフを追加したら、ここにも1行足すこと。
   ============================================================ */
const KNOWN_USER_KEYS = ["kageyama", "tozawa"];

exports.healSyncFailures = onSchedule(
  { schedule: "every 20 minutes", region: "us-central1", timeoutSeconds: 300 },
  async () => {
    const db = admin.database();

    for (const userKey of KNOWN_USER_KEYS) {
      const failSnap = await db.ref(`/users/${userKey}/sync_failures`).once("value");
      const failures = failSnap.val();
      if (!failures) continue; // 平常時はここで終わり、追加コストなし

      const ids = Object.keys(failures);
      console.log(`healSyncFailures: ${userKey} に ${ids.length} 件の失敗マーカーあり`, ids);

      const cfg = await getUserConfig(userKey);
      if (!cfg) {
        console.error("healSyncFailures: no config for user", userKey);
        continue;
      }

      let sheets, idMap;
      try {
        sheets = getSheetsClient();
        idMap  = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);
      } catch (e) {
        console.error("healSyncFailures: getSheetIdMap failed", userKey, e.message);
        continue; // シート側が今取れないなら今回は諦めて次回に回す
      }

      for (const id of ids) {
        try {
          const taskSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).once("value");
          const task = taskSnap.val();
          if (!task) {
            // 案件自体が既に削除されている＝もう直す必要がない
            await db.ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
            continue;
          }
          await syncTask(userKey, id, task, idMap, cfg);
          await db.ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
          console.log("healSyncFailures: 復旧成功", userKey, id);
        } catch (e) {
          console.error("healSyncFailures: まだ失敗", userKey, id, e.message);
          // マーカーはそのまま残し、次回(20分後)に再挑戦する
        }
        await sleep(500); // 立て続けに叩いてまたレート制限に引っかからないよう間隔を空ける
      }
    }

    return null;
  }
);
