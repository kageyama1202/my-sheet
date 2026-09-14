/* report-parser.js — タカラスタンダード「システムバス下見報告書兼指示書」のコピペテキストから
   現場チェック(浴室)の入力欄へのマッピング候補を抽出するパーサー【新規分離】
   shared-modal.js内「📄 報告書から自動入力」の「解析する」ボタンから、
   ensureReportParserLibModal()によってボタンクリック時にのみ動的読込される。
   コピー時に改行が失われる前提(PCで選択コピーすると1行に連結される)で、
   既知のラベル語句を区切りにした非貪欲マッチで抽出する。改行が残っていても動作する。
   あくまで「候補」を返すだけで、実際にフォームへ反映・保存するかはshared-modal.js側の
   確認ボタンを押してから。誤読み取りでいきなり上書きしないための安全策。
*/
// VERSION: 2026-09-13-003

function parseSBReportText(text) {
  if (!text) return { fields: {}, memoLines: [] };
  var t = String(text).replace(/\r/g, '');
  var fields = {};
  var memoLines = [];

  function grab(re) {
    var m = t.match(re);
    return m ? m[1].trim() : null;
  }

  var maguchi = grab(/間口寸法\s*(\d+)\s*mm/);
  if (maguchi) fields.bathMaguchi = maguchi;

  var okuyuki = grab(/奥行寸法\s*(\d+)\s*mm/);
  if (okuyuki) fields.bathOkuyuki = okuyuki;

  var tenjou = grab(/高さ寸法\s*(\d+)\s*mm/);
  if (tenjou) fields.bathTenjouTakasa = tenjou;

  var setchi = grab(/ＳＢ設置位置\s*(.+?)(?=ドア開口|脱衣場|$)/);
  if (setchi) fields.bathSetchiHouhou = setchi;

  // ★2026-09-13追加★ 設置位置の文中に「枠20見て」のように枠材の厚み(mm)が
  // 埋め込まれているケースが多いため、そこから枠材の厚みも別途抜き出す。
  var wakuMatch = (setchi || t).match(/枠\s*(\d+)/);
  if (wakuMatch) fields.bathWakuzaiAtsumi = wakuMatch[1];

  var yukaKousei = grab(/ドアアングル納め位置（詳細[：:]基準）\s*(.+?)(?=土間状況|$)/);
  if (yukaKousei) fields.bathYukaKousei = yukaKousei;

  // 「ドアアングル納め位置」単独行(詳細行の手前まで)＝床合わせ有無の判定に使う
  var yukaAwaseRaw = grab(/ドアアングル納め位置\s+(.+?)(?=ドアアングル納め位置（詳細|$)/);
  if (yukaAwaseRaw) {
    fields.bathYukaAwase = yukaAwaseRaw.indexOf('床合わせ') !== -1 ? '○' : '✕';
  }

  // 浴室内ボード貼り：「4面」なら右/左/正面/ドア横を全選択、個別記載(例：右・正面)ならその面だけ
  var sekkouRaw = grab(/浴室内ボード貼り\s*(.+?)(?=高さ寸法|$)/);
  if (sekkouRaw) {
    // ★2026-09-13変更★ 石膏ボードの面名を、部屋基準(右/左/正面/ドア横)から浴槽自体を基準にした
    // 業界標準の呼び方(カウンター面/カウンター対面/浴槽側面/洗場側面)に統一。
    var wallOpts = ['カウンター面', 'カウンター対面', '浴槽側面', '洗場側面'];
    var picked = [];
    if (/4\s*面/.test(sekkouRaw)) {
      picked = wallOpts.slice();
    } else {
      wallOpts.forEach(function (o) { if (sekkouRaw.indexOf(o) !== -1) picked.push(o); });
    }
    if (picked.length) fields.bathSekkouBoard = picked.join(',');
  }

  // 吊金具：「62S現地納入しました」のような自由文から 区分(62/20)・型(S/SN/M/L)・現地入れ有無 を分解
  var tsuriRaw = grab(/吊金具\s*合?\s*(.+?)(?=ジェットバス|ガス浴暖|$)/);
  if (tsuriRaw) {
    var kubunMatch = tsuriRaw.match(/(62|20)/);
    if (kubunMatch) fields.bathTsuriKanaguKubun = kubunMatch[1];
    var sizeMatch = tsuriRaw.match(/(?:62|20)\s*(SN|S|M|L)/);
    if (sizeMatch) fields.bathTsuriKanaguSize = sizeMatch[1];
    if (/現地(納入|入れ)/.test(tsuriRaw)) fields.bathTsuriKanaguGenchi = '○';
  }

  // 特記事項・伝達事項はフィールドに対応するものがないため、メモ・連絡事項への追記候補として返す
  // 特記事項・伝達事項はフィールドに対応するものがないため、メモへの追記候補として返す。
  // ★2026-09-13変更★ 伝達事項は現場の職人さんが見る「4分割図面」の左下メモ(bathMemoRenraku)に、
  // 特記事項は社内向けの一般メモ(モーダルのメモ・連絡事項欄)に、と行き先を分ける。
  var tokkiJikou = grab(/【特記事項】\s*(.+?)(?=【施工エンジニアへの伝達事項】|$)/);
  if (tokkiJikou) memoLines.push('【報告書:特記事項】' + tokkiJikou);

  var dentatsu = grab(/【施工エンジニアへの伝達事項】\s*(.+?)(?=商品変更|$)/);
  var bathMemoAppend = dentatsu ? ('【報告書:伝達事項】' + dentatsu) : null;

  return { fields: fields, memoLines: memoLines, bathMemoAppend: bathMemoAppend };
}
