// VERSION: 2026-09-15-007
// CREATED: 2026-09-15 20:35
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

// ★2026-08-01追加★
// Googleカレンダーの終日イベントは end.date を「排他的」（その日を含まない）に
// 扱う仕様。1日だけのイベントを作る場合、正しくは end.date = 開始日の翌日 にする
// 必要がある。これまで upsertEvent は start.date と end.date に同じ文字列を渡して
// いたため、Web版/Android版では単純に1日として丸めて表示されていたが、iPadの
// 標準カレンダーアプリ（CalDAV経由）はこれを額面通り解釈し、「開始日〜終了日−1日」
// という逆転した日付範囲（例: 8/1〜7/31）を表示してしまっていた。
// YYYY-MM-DD文字列をローカル日付として解釈し、1日進めた同形式の文字列を返す。
// タイムゾーンのズレによるオフバイワンを避けるため、Dateはローカルのnew Date(y,m,d)
// で構築する（new Date("YYYY-MM-DD")のUTC解釈は使わない）。
function addOneDay(dateStr) {
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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

async function claimSlot(db, path) {
  const ref = db.ref(path);
  const result = await ref.transaction(current => {
    if (current) return;
    return "PENDING";
  });
  return result.committed;
}

async function releaseSlot(db, path) {
  const ref = db.ref(path);
  await ref.transaction(current => {
    if (current === "PENDING") return null;
    return;
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
    end:   { date: addOneDay(dateStr) },
  };
  return withRetry(async () => {
    if (eventId) {
      try {
        const res = await cal.events.update({ calendarId, eventId, requestBody: event });
        return res.data.id;
      } catch(e) {
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

function syncSignature(task) {
  if (!task) return "";
  const { evSekoId, evShiId, sheetClaimed, seqNo, geocode, ...rest } = task || {};
  return JSON.stringify(rest);
}

async function syncTask(userKey, id, task, idMap, cfg) {
  const db = admin.database();
  let attempt = 0;
  let currentTask = task;
  while (true) {
    attempt++;
    const changedTask = await syncTaskOnce(userKey, id, currentTask, idMap, cfg);
    if (!changedTask) return;
    const afterSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).get();
    const afterTask = afterSnap.val();
    if (!afterTask) return;
    if (syncSignature(afterTask) === syncSignature(changedTask)) return;
    if (attempt >= 4) {
      console.warn("syncTask: 4回リトライしても内容が安定しなかった", userKey, id);
      return;
    }
    console.log("syncTask: 実行中に新しい書き込みを検知、最新内容で再同期します", userKey, id, "attempt", attempt + 1);
    currentTask = afterTask;
  }
}

async function syncTaskOnce(userKey, id, task, idMap, cfg) {
  const db     = admin.database();

  const freshSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).get();
  const freshTask = freshSnap.val();
  if (!freshTask) { console.log("skip: record no longer exists", userKey, id); return null; }
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
    await db.ref(`${base}/sheetClaimed`).remove();
    return null;
  }

  if (idMap) {
    const rowNum = idMap[id];
    if (rowNum) {
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
  const pStr    = pCsv || pFb;
  const order   = String(task.order || "").trim();
  const time    = effectiveShitamiTime(task, csv);

  const kubunPfx  = kubun ? kubun + "｜" : "";
  const shortT    = shortenTitle(title || id);
  const sekoTitle = "施｜" + kubunPfx + shortT;

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

  return task;
}

function hasMeaningfulChange(before, after) {
  if (!before) return true;
  const strip = (obj) => {
    const { evShiId, evSekoId, sheetClaimed, ...rest } = obj || {};
    return JSON.stringify(rest);
  };
  return strip(before) !== strip(after);
}

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

const KNOWN_USER_KEYS = ["kageyama", "tozawa"];

const SYNC_DEBOUNCE_MS = 5 * 60 * 1000;

exports.onTaskChanged = onValueWritten(
  {
    ref: "/users/{userKey}/app_tasks/{id}",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (event) => {
    const userKey = event.params.userKey;
    const id      = event.params.id;
    const after   = event.data.after.val();
    const before  = event.data.before.val();

    if (!after) {
      await cleanupDeletedTask(userKey, id, before);
      await admin.database().ref(`/users/${userKey}/pending_syncs/${id}`).remove().catch(() => {});
      return null;
    }

    if (!hasMeaningfulChange(before, after)) {
      console.log("skip re-trigger:", userKey, id);
      return null;
    }

    const db = admin.database();
    const pendingRef = db.ref(`/users/${userKey}/pending_syncs/${id}`);
    const existing = (await pendingRef.once("value")).val();
    await pendingRef.set({
      dueAt: Date.now() + SYNC_DEBOUNCE_MS,
      firstFlaggedAt: (existing && existing.firstFlaggedAt) || Date.now(),
    });
    return null;
  }
);

exports.processPendingSyncs = onSchedule(
  { schedule: "every 2 minutes", region: "us-central1", timeoutSeconds: 300 },
  async () => {
    const db  = admin.database();
    const now = Date.now();

    for (const userKey of KNOWN_USER_KEYS) {
      const pendingSnap = await db.ref(`/users/${userKey}/pending_syncs`).once("value");
      const pending = pendingSnap.val();
      if (!pending) continue;

      const dueIds = Object.keys(pending).filter(id => pending[id] && pending[id].dueAt <= now);
      if (dueIds.length === 0) continue;

      const cfg = await getUserConfig(userKey);
      if (!cfg) {
        console.error("processPendingSyncs: no config for user", userKey);
        continue;
      }

      let sheets, idMap;
      try {
        sheets = getSheetsClient();
        idMap  = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);
      } catch (e) {
        console.error("processPendingSyncs: getSheetIdMap failed", userKey, e.message);
        continue;
      }

      for (const id of dueIds) {
        try {
          const taskSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).once("value");
          const task = taskSnap.val();
          if (task) {
            await syncTask(userKey, id, task, idMap, cfg);
          }
          await db.ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
          const stillSnap = await db.ref(`/users/${userKey}/pending_syncs/${id}`).once("value");
          const still = stillSnap.val();
          if (!still || still.dueAt <= now) {
            await db.ref(`/users/${userKey}/pending_syncs/${id}`).remove().catch(() => {});
          }
        } catch (e) {
          console.error("processPendingSyncs error", userKey, id, e.message);
          await db.ref(`/users/${userKey}/sync_failures/${id}`).set({
            error: String((e && e.message) || e),
            failedAt: Date.now()
          }).catch(() => {});
        }
        await sleep(300);
      }
    }
    return null;
  }
);

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
                    dimensionIndex: 11,
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
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const result = await withRetry(() => cal.events.list({
        calendarId: cfg.calendarPersonal,
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      }), { label: "syncPersonalCalendar" });

      const allEvents = result.data.items || [];

      allEvents.forEach(ev => {
        if (!ev.summary) {
          console.log("no-summary event raw:", JSON.stringify(ev));
        }
      });

      const events = allEvents.filter(ev => {
        if (ev.eventType && ev.eventType !== "default") return false;
        if (!ev.attendees) return true;
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
      await db.ref(`/users/${userKey}/personal_calendar`).set(grouped);

      res.json({ status: "ok", count: events.length, excludedDeclined: allEvents.length - events.length, userKey });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.toString() });
    }
  }
);

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

function kariHasMeaningfulChange(before, after) {
  if (!before) return true;
  const strip = (obj) => {
    const { kari_gcal_event_id, ...rest } = obj || {};
    return JSON.stringify(rest);
  };
  return strip(before) !== strip(after);
}

function isKariConfirmedStatus(status) {
  return status === "許可" || status === "確定";
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

    const wasConfirmed = !!(before && isKariConfirmedStatus(before.status));
    const isConfirmed  = !!(after && isKariConfirmedStatus(after.status));

    if (!isConfirmed && !wasConfirmed) return null;
    if (isConfirmed && wasConfirmed) return null;

    const db  = admin.database();
    const cfg = await getUserConfig(userKey);
    if (!cfg || !cfg.calendarShitami) {
      console.error("no calendarShitami config, skip kari sync:", userKey);
      return null;
    }

    if (isConfirmed && !wasConfirmed) {
      const cal = getCalendarClient();
      const title = "🟢対応可能 " + (after.start || "") + " " + (after.case_name || "(無題)") + "（" + (after.tantou || "") + "）";
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
          requestBody: { summary: title, description: desc, start: { date }, end: { date: addOneDay(date) } }
        }), { label: "kariEventInsert" });
        eventId = res.data.id;
      } catch (e) {
        console.error("kari gcal insert error", userKey, date, id, e.message);
      }

      if (cfg.spreadsheetId && cfg.sheetName) {
        try {
          const sheets = getSheetsClient();
          const row = [
            "KARI-" + id,
            "仮予約対応可",
            "",
            "🟢" + (after.case_name || ""),
            after.tantou || "",
            after.tel || "",
            "",
            "",
            "",
            [after.email ? "メール:" + after.email : "", after.memo || ""].filter(x => x).join(" / "),
            after.area || "",
            date,
            date,
            "",
            after.start || "",
            ""
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

exports.healSyncFailures = onSchedule(
  { schedule: "every 20 minutes", region: "us-central1", timeoutSeconds: 300 },
  async () => {
    const db = admin.database();

    for (const userKey of KNOWN_USER_KEYS) {
      const failSnap = await db.ref(`/users/${userKey}/sync_failures`).once("value");
      const failures = failSnap.val();
      if (!failures) continue;

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
        continue;
      }

      for (const id of ids) {
        try {
          const taskSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).once("value");
          const task = taskSnap.val();
          if (!task) {
            await db.ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
            continue;
          }
          await syncTask(userKey, id, task, idMap, cfg);
          await db.ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
          console.log("healSyncFailures: 復旧成功", userKey, id);
        } catch (e) {
          console.error("healSyncFailures: まだ失敗", userKey, id, e.message);
        }
        await sleep(500);
      }
    }

    return null;
  }
);

exports.syncOne = onRequest(
  { region: "us-central1", timeoutSeconds: 60, cors: true },
  async (req, res) => {
    const userKey = req.query.userKey;
    const id      = req.query.id;
    if (!userKey || !id) {
      res.status(400).json({ status: "error", message: "userKeyとidの両方が必要です" });
      return;
    }
    try {
      const cfg = await getUserConfig(userKey);
      if (!cfg) {
        res.status(400).json({ status: "error", message: "no config found for userKey: " + userKey });
        return;
      }
      const db = admin.database();
      const taskSnap = await db.ref(`/users/${userKey}/app_tasks/${id}`).get();
      const task = taskSnap.val();
      if (!task) {
        res.status(404).json({ status: "error", message: "案件が見つかりません: " + id });
        return;
      }
      const sheets = getSheetsClient();
      const idMap  = await getSheetIdMap(sheets, cfg.spreadsheetId, cfg.sheetName);
      await syncTask(userKey, id, task, idMap, cfg);
      await db.ref(`/users/${userKey}/sync_failures/${id}`).remove().catch(() => {});
      res.json({ status: "ok", userKey, id });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.toString() });
    }
  }
);
/* ============================================================
   ★2026-09-13追加★ 追記用スニペット
   既存の index.js（Cloud Functions v2）の末尾に、このファイルの中身を
   そのまま追記してください。既存のexports（onTaskChanged, syncAll等）
   には一切触れていない、完全に独立した新規エンドポイントです。

   【parseSBReportAI】
   タカラSB下見報告書のコピペテキストをClaude API(Anthropic)に渡し、
   現場チェック(浴室)の入力欄用JSONに変換して返す。
   既存のreport-parser.js（正規表現版）と全く同じ形のJSON
   { fields: {...}, memoLines: [...], bathMemoAppend: "..." | null }
   を返すよう設計しているので、shared-modal.js側のプレビュー/反映
   ロジックは正規表現版・AI版のどちらでも変更なしで動く。

   ------------------------------------------------------------
   【事前準備：APIキーの登録（1回だけ）】
   ターミナルでこのプロジェクトのディレクトリに入り、以下を実行:

     firebase functions:secrets:set ANTHROPIC_API_KEY

   Anthropic Console（https://console.anthropic.com/）で発行した
   APIキーを貼り付けてください。コード中に直接キーを書かないこと。

   【Node.jsバージョンについて】
   fetch()をそのまま使っているため、package.jsonのenginesが
   Node 18以上になっている必要があります（Firebase Functions v2の
   最近のデフォルトは18か20のはずなので、通常は追加対応不要）。
   もし動かない場合は package.json の "engines": { "node": "20" }
   になっているか確認してください。
   ============================================================ */

const { defineSecret } = require("firebase-functions/params");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// report-parser.js（正規表現版）と全く同じ出力形式をAIにも守らせるためのプロンプト。
// フィールド名・値の書式（○/✕、カンマ区切り等）を厳密に指定し、
// 「JSON以外は出力しない」を明示することでパースの安定性を上げている。
// ★2026-09-13変更★ テキスト版・画像版どちらでも同じ指示を使えるよう、
// 末尾の「報告書テキスト」部分を外に切り出した（画像版はこの指示文だけを渡し、画像は別途添付する）。
// ★2026-09-15変更★ 吊元側の枠厚みを「吊り元の下地に枠◯◯見て」の文面から bathTsurimotoWaku に
// 抽出する指示を追加。下地厚みは報告書に書かれないことが多く、推測させない（省略させる）。
// ★2026-09-15追加★ タカラの下見報告書PDFには、報告書本体に加えて「施工図(製品図面)」の
// スクショが写真として貼り込まれていることが多い。その施工図部分からも製品側の値
// (製品間口/製品奥行き=浴槽基準、SB外寸、額縁開口、勝手AR/AL/BR/BL)を読み取る指示を追加。
// 勝手(向きA/B＋扉位置L/R)は図面の回転や記号で読み違えやすいので、確信が持てない場合でも
// 推定値を返しつつ、needsConfirm 配列に "勝手" を入れて「人間の確認が必要」と明示する。
const SB_REPORT_INSTRUCTIONS = `あなたはタカラスタンダードの「システムバス 下見報告書 兼 指示書」を読み取り、
指定のJSON形式に変換するアシスタントです。入力はテキストの場合と、報告書を撮影/スクリーンショットした
画像やPDFの場合があります。画像・PDFの場合は、手書き・印字を問わずできる限り正確に読み取ってください。

重要：この報告書PDFには、報告書本体（間口・奥行・設置位置などの表）に加えて、「施工図（製品図面）」の
スクリーンショットが写真として貼り込まれていることがよくあります。その施工図の写真からも、下記の
製品側の寸法（製品間口・製品奥行き・ＳＢ外寸・額縁開口寸法など）や勝手を読み取ってください。

次の形のJSONオブジェクトを1つだけ出力してください。
JSON以外の文字（説明文やコードフェンスなど）は一切出力しないでください。

{
  "fields": {
    "bathMaguchi": "報告書本体の間口寸法（建物側。数値のみの文字列。無ければキー自体を含めない）",
    "bathOkuyuki": "報告書本体の奥行寸法（建物側。数値のみ）",
    "bathTenjouTakasa": "高さ寸法／天井高さ（数値のみ）",
    "bathSetchiHouhou": "「ＳＢ設置位置」の記載内容をそのまま",
    "bathWakuzaiAtsumi": "枠材の厚み（数値のみ、mm）。「枠20見て」のように設置位置の文中に埋め込まれていることが多いので、文脈から判断して抽出すること",
    "bathTsurimotoWaku": "吊元側の枠厚み（数値のみ、mm）。「ＳＢ設置位置」欄の『吊り元の下地に枠◯◯見てドアアングル設置』のような文面から、枠の数値(◯◯)だけを抽出する。例：『吊り元の下地に枠13見て…』なら 13。該当する文面が無ければキーごと省略する",
    "bathSeihinMaguchi": "施工図（貼り込まれた製品図面の写真）から読み取れる製品間口（浴槽基準）。ＳＢ外寸やＳＢ内寸とは別に『製品』の間口が読み取れる場合のみ。数値のみ。読めなければ省略",
    "bathSeihinOkuyuki": "施工図から読み取れる製品奥行き（浴槽基準）。数値のみ。読めなければ省略",
    "bathKaikou": "施工図の『額縁開口寸法』（数値のみ、例：782）。読めなければ省略",
    "bathYukaKousei": "「ドアアングル納め位置（詳細：基準）」の記載内容をそのまま",
    "bathYukaAwase": "ドアアングル納め位置が「床合わせ」なら○、それ以外の方式なら✕",
    "bathSekkouBoard": "「浴室内ボード貼り」の対象面。右,左,正面,ドア横のうち該当するものをカンマ区切りで（「4面」なら全部）",
    "bathTsuriKanaguKubun": "吊金具の区分。62 または 20",
    "bathTsuriKanaguSize": "吊金具の型。S, SN, M, L のいずれか",
    "bathTsuriKanaguGenchi": "吊金具が現地入れ・現地納入されていれば○、そうでなければ✕"
  },
  "katte": "施工図から推定した勝手。AR / AL / BR / BL のいずれか。判断根拠：①浴槽が縦長(奥行き方向に伸びる)ならA、横長(間口方向に伸びる)ならB。②『額縁開口寸法』の寸法線がある壁が扉のある壁で、その壁を下にして見たとき扉が右寄りならR・左寄りならL。読み取れなければ null",
  "needsConfirm": ["勝手など、図面から推定したが人間の確認が必要な項目名の配列。勝手を推定した場合は必ず \\"勝手\\" を含める"],
  "memoLines": ["【報告書:特記事項】(本文の内容)"],
  "bathMemoAppend": "【報告書:伝達事項】(本文の内容)"
}

ルール:
- fieldsは、報告書本文や施工図写真から実際に読み取れた項目だけを含めてください（該当情報が無い項目はキーごと省略）。
- bathTsurimotoWaku は「吊り元の下地に枠◯◯見て」の枠の数値のみを入れてください。下地木材の厚みは
  報告書に書かれないことが多く、絶対に推測してはいけません（下地厚みのフィールドは一切出力しない）。
- 製品寸法(bathSeihinMaguchi/bathSeihinOkuyuki)・額縁開口(bathKaikou)は、施工図の写真が
  含まれている場合のみ。写真が無ければこれらは省略してください。
- katte は AR/AL/BR/BL のいずれか、または判断できなければ null。値を入れた場合は needsConfirm に "勝手" を含める。
- memoLinesは【特記事項】が本文になければ空配列 [] にしてください。
- bathMemoAppendは【施工エンジニアへの伝達事項】が本文になければ null にしてください。
- 数値は単位(mm等)を含めず、数字のみの文字列にしてください。`;

exports.parseSBReportAI = onRequest(
  { region: "us-central1", cors: true, timeoutSeconds: 60, secrets: [ANTHROPIC_API_KEY] },
  async (req, res) => {
    try {
      const text = ((req.body && req.body.text) || "").toString();
      // ★2026-09-13変更★ 報告書が複数ページ(=複数スクショ)にまたがるケース向けに、
      // 単一image/mediaTypeではなく images配列([{data, mediaType}, ...])を受け付けるようにする。
      // 後方互換のため、単一image/mediaTypeが来た場合もimages配列に変換して扱う。
      let images = Array.isArray(req.body && req.body.images) ? req.body.images : [];
      if ((!images || !images.length) && req.body && req.body.image) {
        images = [{ data: req.body.image, mediaType: req.body.mediaType || "image/png" }];
      }
      // ★2026-09-13追加★ PDFはClaude APIにそのまま渡せる(document content block)ため、
      // 画像化不要。ブラウザ側でPDFをbase64化して pdfs配列([{data}, ...])で渡す。
      const pdfs = Array.isArray(req.body && req.body.pdfs) ? req.body.pdfs : [];

      if (!text.trim() && !images.length && !pdfs.length) {
        res.status(400).json({ status: "error", message: "text・images・pdfsのいずれかが必要です" });
        return;
      }

      // ★2026-09-13追加★ 画像・PDFが来た場合は全ページ分のimage/documentブロック+指示文、
      // テキストの場合は指示文+報告書テキストをそのままユーザーメッセージにする。
      let content;
      if (images.length || pdfs.length) {
        content = images.map(function (img) {
          return { type: "image", source: { type: "base64", media_type: img.mediaType || "image/png", data: img.data } };
        });
        content = content.concat(pdfs.map(function (p) {
          return { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } };
        }));
        var pageCount = images.length + pdfs.length;
        content.push({
          type: "text",
          text: SB_REPORT_INSTRUCTIONS + "\n\n上記の添付(" + pageCount + "件。同じ報告書の複数ページ/画像とPDF混在の場合があります)を読み取って、指示通りのJSONを出力してください。",
        });
      } else {
        content = SB_REPORT_INSTRUCTIONS + "\n\n--- 報告書テキスト ---\n" + text;
      }

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY.value(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 4096,
          messages: [{ role: "user", content: content }],
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.error("parseSBReportAI: Anthropic API error", apiRes.status, errText);
        res.status(502).json({ status: "error", message: "AI呼び出しに失敗しました（ステータス " + apiRes.status + "）" });
        return;
      }

      const data = await apiRes.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const raw = textBlock ? textBlock.text : "";
      // まれに```jsonフェンス付きで返ってくることがあるので除去してからパース
      const cleaned = raw.replace(/```json|```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.error("parseSBReportAI: JSON parse error, raw was:", cleaned);
        // ★2026-09-13追加★ max_tokensで途中切れした場合はstop_reasonが"max_tokens"になるので、
        // その場合はメッセージで明示し、原因の切り分けをしやすくする。
        const truncated = data.stop_reason === "max_tokens";
        res.status(502).json({
          status: "error",
          message: truncated
            ? "AIの応答が文字数上限で途中で切れました（報告書が長すぎる可能性があります）"
            : "AIの応答をJSONとして解釈できませんでした",
        });
        return;
      }

      // 形が壊れていても後段(shared-modal.js)で例外にならないよう最低限のガード
      if (!parsed || typeof parsed !== "object") parsed = {};
      if (!parsed.fields || typeof parsed.fields !== "object") parsed.fields = {};
      if (!Array.isArray(parsed.memoLines)) parsed.memoLines = [];
      if (typeof parsed.bathMemoAppend !== "string") parsed.bathMemoAppend = parsed.bathMemoAppend || null;
      // ★2026-09-15追加★ 施工図由来の勝手(AR/AL/BR/BL)と、確認が必要な項目リストを通す。
      if (typeof parsed.katte !== "string") parsed.katte = parsed.katte || null;
      if (!Array.isArray(parsed.needsConfirm)) parsed.needsConfirm = [];

      res.json({ status: "ok", result: parsed });
    } catch (e) {
      console.error("parseSBReportAI error", e);
      res.status(500).json({ status: "error", message: e.toString() });
    }
  }
);
