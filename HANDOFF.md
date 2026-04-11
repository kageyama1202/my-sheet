# HANDOFF - Takara Standard 案件管理システム

**最終更新**: 2026-04-09  
**セッション**: action.html AIスケジュール機能追加 + 日付範囲統一

---

## 📋 今回の変更サマリー

### ✅ 完了した機能

1. **日付範囲の統一（7日間: 0〜6日後）**
   - action.html 下見予定タブ
   - action.html AIスケジュールタブ
   - sogo.html AIスケジューラー

2. **sogo.html: 2段階チェック機能**
   - AI提案前: リフォーム確定も除外可能
   - AI提案後: 最終選択で行く/行かない決定

3. **action.html: AIスケジュールタブ追加**
   - `ai_shitami_date` が7日以内の案件を表示
   - 「📅 正式予定に昇格」ボタン実装

4. **action.html: 全体タブにAI予定日フィルター追加**
   - 期間フィルターに「AI予定日」チェックボックス

---

## 🏗️ システムアーキテクチャ

### データフロー
```
Salesforce CSV
  ↓ index.html でアップロード
Firebase Realtime Database（単一真実源）
  ↓ 自動同期（hourly 8:00-18:00 JST）
管理表スプレッドシート（列P/Q/R: 下見予定日/時間/順番）
```

### Firebase DB
- URL: `https://project-6745138395263517914-default-rtdb.firebaseio.com`
- SDK: Firebase 8.x
- キー: Salesforce ID（例: `a09dc00000pnfst`）

### 重要フィールド
```javascript
obj.date              // 下見予定日（人間が設定）
obj.ai_shitami_date   // AI予定日（AIが提案）
obj.time              // 下見時間
obj.order             // 下見順番
obj.shitami_completed // 下見実施済みフラグ
```

---

## 📁 主要ファイル

### action.html（7タブ構成）
```
[全体][リフォーム][本日][下見予定][AIスケジュール][報告書][備忘録]
```

**AIスケジュールタブ**（新規追加）:
```javascript
function renderAIScheduleTab() {
  // ai_shitami_date が今日〜6日後の案件を表示
  // 各行に「📅 正式予定に昇格」ボタン
}

function promoteToOfficial(key, aiDate) {
  // ai_shitami_date → obj.date にコピー
  // Firebase + localStorage 更新
  // 下見予定タブに反映
}
```

**全体タブのフィルター**:
```html
<label><input type="checkbox" id="chkSekou" checked> 施工日</label>
<label><input type="checkbox" id="chkShitami"> 下見日</label>
<label><input type="checkbox" id="chkYotei"> 下見予定日</label>
<label><input type="checkbox" id="chkAI"> AI予定日</label>  ← NEW
```

### sogo.html（AIスケジューラー）

**2段階チェックシステム**:

#### ステップ1: AI提案前
```javascript
var excludedKeys = {};  // 除外する案件

// リフォーム確定にもチェックボックス
fixedVisits.forEach(function(v) {
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.addEventListener('change', function() {
    if (this.checked) excludedKeys[v.key] = true;
    else delete excludedKeys[v.key];
  });
});
```

#### ステップ2: AI提案後
```javascript
var finalSelection = {};  // 最終選択

function showAIResult() {
  // リフォーム確定 + 新築の全行にチェックボックス
  // デフォルトは全部ON
  
  var rowId = 'final-' + day.date + '-' + key;
  finalSelection[rowId] = true;  // 初期値
  
  cb.addEventListener('change', function() {
    finalSelection[rowId] = this.checked;
  });
}

function applyToFirebase() {
  // finalSelection がtrueの案件のみ保存
  if (finalSelection[rowId] === false) {
    skipped++;
    return;  // 除外
  }
  updates['app_tasks/' + key + '/ai_shitami_date'] = day.date;
}
```

**SK案件の処理**（2回訪問を分離）:
```javascript
// SK → 1回目（21日前）と2回目（10日前）を別々に追加
allVisits.push({
  key: key + '_sk1',
  originalKey: key,  // Firebase保存時に使用
  visit_date: v1s,   // 21日前
  type: 'sk1'
});

allVisits.push({
  key: key + '_sk2',
  originalKey: key,
  visit_date: v2s,   // 10日前
  type: 'sk2'
});
```

---

## 🔄 ワークフロー

### 日常運用
```
1. Salesforce CSV → index.html アップロード → Firebase
2. sogo.html: AI が新築を7日間に配分
3. action.html [AIスケジュール]: AI提案を確認
4. 📅 昇格ボタン → [下見予定]タブに移動
5. [リフォーム]: 電話連絡、下見日調整
6. [本日]: 今日の実行チェックリスト
7. [報告書]: 施工日10日前の報告書作成
```

### AI提案フロー
```
sogo.html
  ↓ AI提案前チェック（中止案件を除外）
  ↓ Gemini API で最適化
  ↓ AI提案後チェック（行く/行かない選択）
Firebase に ai_shitami_date 保存
  ↓
action.html [AIスケジュール]
  ↓ 確認・検証
  ↓ 📅 昇格ボタン
action.html [下見予定]
  ↓ 正式運用
```

---

## 🎨 技術仕様

### コーディング規約
- **ES5構文**: `var`のみ（`const`/`let`禁止）
- **完全ファイル置換**: 部分編集不可
- **Firebase SDK**: 8.x
- **テーマ**: action.html = オレンジ `#ff6b00`

### 日付処理
```javascript
// 7日間: 今日〜6日後
var endDate = addDays(todayStr, 6);  // action.html
var targetDates = [getDateStr(0), ..., getDateStr(6)];  // sogo.html

// 日付計算
function addDays(dateStr, days) {
  var d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + 
         String(d.getMonth() + 1).padStart(2, '0') + '-' + 
         String(d.getDate()).padStart(2, '0');
}
```

### 色分けルール
```javascript
// 残日数による背景色
days === 0 → 赤 #ffebee (今日)
days === 1 → 黄 #fff9c4 (明日)
days >= 2  → 緑 #e8f5e9 (2日後以降)
```

---

## 📊 データ構造

### globalTasks (Firebase app_tasks)
```javascript
{
  "a09dc00000pnfst": {
    csvData: [...],           // 44列のSalesforceデータ
    date: "2026-04-10",       // 下見予定日（人間設定）
    time: "10:00",            // 下見時間
    order: 1,                 // 下見順番
    ai_shitami_date: "2026-04-12",  // AI予定日
    shitami_completed: true   // 下見完了フラグ
  }
}
```

### CSV列インデックス（重要）
```
C0  = ID
C2  = 施工日
C3  = 区分（ﾘ/ﾊﾘ/新）
C4  = タイトル（SK/SB/SU含む）
C5  = 担当者
C6  = TEL
C11 = 住所
C12 = 下見日（Salesforce）
C15 = 下見日（P列、廃止予定）
C16 = 時間（Q列）
C17 = 順番（R列）
C20 = SF下見日（T列）
C38/C39 = 緯度/経度
```

---

## 🐛 既知の制限事項

### sogo.html
- AI提案は80件まで推奨（それ以上は精度低下）
- Gemini API: `gemini-2.5-flash`
- API Key: localStorage のみ（リポジトリは公開）

### action.html
- モーダル共有: `shared-modal.css` / `shared-modal.js`
- ブラウザストレージ非対応（React artifacts での制限）

### 通信データ同期
- iMessage: 27,183件（Mac chat.db）
- Gmail: 905件（OAuth2経由）
- Firebase: 3,846件（2026-04-09現在）
- 新規追加: 152件（最終実行）

**エラー対策**:
```bash
# SSL エラー時は再実行
cd ~/mail-collect && python3 upload_firebase.py
# 一時的なネットワークエラーの場合、2回目で成功
```

---

## 🔧 トラブルシューティング

### 件数が一致しない
- action.html と sogo.html の日付範囲を確認
- `endDate = addDays(todayStr, 6)` が正しいか
- SK案件が2回分カウントされているか確認

### AI提案が表示されない
1. Gemini API Key が localStorage に保存されているか
2. ブラウザコンソールでエラー確認
3. Firebase の ai_shitami_date フィールド確認

### 昇格ボタンが動作しない
```javascript
// Firebase権限確認
database.ref().update(updates)
  .then(...)
  .catch(err => console.error(err));
```

---

## 📝 今後の改善案

1. **バッチ処理**: 大量データのFirebase更新を分割
2. **エラーハンドリング**: リトライロジック追加
3. **キャッシュ戦略**: localStorageとFirebaseの整合性強化
4. **UI改善**: タブレット表示の最適化

---

## 🔗 関連リソース

### GitHub Repository
- `kageyama1202.github.io/my-sheet/`
- `action.html`, `sogo.html`, `shared-modal.css`, `shared-modal.js`

### Firebase Console
- https://console.firebase.google.com/
- Project: project-6745138395263517914

### スプレッドシート
- ID: `1wR4uLlNipGbDP1uAfIyecwkkWbayaDB_AzQ7V5gJXQU`
- Sheet: 管理表（44列）

### Google Apps Script
- プロジェクト名: 「自動化」
- 同期: 8:00-18:00 JST（hourly）
- CSV push: 7:00 AM daily

---

## ✅ 完了チェックリスト

- [x] 日付範囲7日間に統一
- [x] sogo.html 2段階チェック機能
- [x] action.html AIスケジュールタブ
- [x] action.html 昇格ボタン
- [x] action.html 全体タブにAI予定日フィルター
- [x] SK案件2回訪問の分離処理
- [x] iMessage/Gmail同期（3,846件）
- [x] GitHub Pages デプロイ確認

---

**次回セッション開始時**: このHANDOFF.mdを確認して、context windowに全体像を復元してください。
# HANDOFF.md — 2026-04-11

## 今日完成したもの

### gencho.html（新規）
現調・下見 受付画面。

- `app_communications` ノードをスキャンしてキーワード（現調/事前下見）+日付を自動抽出
- 抽出候補を左列に表示、承認→ `draft_visits/` に保存
- 手動入力フォーム（電話対応分）
- 承認済み一覧（右列）、削除ボタン付き
- 抽出キーワード: `['現調', '事前下見']`
- K列（施工指示/備考）は今回除外、将来追加可

### today.html（拡張）
- `draft_visits/` を Firebase から直接読み込み
- 案件行と**日付順で混在表示**（末尾追加ではない）
- draft行は緑背景📌、下見予定日列に日付表示（紫）
- 管理名列にキーワード+メモ、マウスオンでフルテキストツールチップ
- 右端に「✕ 削除」ボタン（Firebase から即削除）
- 施工日・下見日・下見予定日・AI下見予定ヘッダーをクリックでソート（▲▼）

## Firebase スキーマ追加
