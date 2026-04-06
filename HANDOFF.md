# 🚀 HANDOFF — 案件管理システム開発進捗

**最終更新**: 2026-04-06 21:30 JST  
**リポジトリ**: https://github.com/kageyama1202/my-sheet  
**公開URL**: https://kageyama1202.github.io/my-sheet/

---

## 📋 セッション履歴

### Session 2026-04-06（本セッション）
**テーマ**: Firebase自動同期 + メーラー完全リニューアル

#### ✅ 完了項目

1. **Firebase → Google Sheets 同期 GAS（新規）**
   - パス: GAS新プロジェクト「自動化」
   - 機能: 毎時間 8:00-18:00 に Firebase から P/Q/R を Sheet に自動更新
   - 朝 7:00 のみ: CSV貼り付け → importData() → 新規/削除反映
   - テスト済み: 380件取得、27行更新確認
   - トリガー: 毎時間（GAS内で営業時間チェック）
   - ロールバック: GAS プロジェクト削除のみ

2. **メーラーページ完全リニューアル**
   - パス: `mailer-test.html` → `mailer-opus-complete.html`
   - UI改善:
     * 4列グリッド表示（30-50件一画面）
     * 施工日が近い順でソート
     * app_parked_mails に該当する案件のみ赤+点滅
   - 機能追加:
     * 「✏️ 生成」ボタン → テンプレート自動入力
     * 保存済みメール自動検出 & 入力
     * 「💾 保存」→ app_parked_mails に草稿保存
     * 「🗑️ 削除」→ 草稿削除
     * 削除ボタン追加

3. **shared-modal.css 幅拡大**
   - パス: `shared-modal.css`
   - 変更: `max-width: 640px` → `900px`
   - 効果: テキストはみ出し（担当者携帯、施工指示など）解決

4. **index.html にメーラーリンク追加**
   - パス: `index.html`
   - 追加: メニューに「✉️ メーラー」ボタン
   - 色: `#00796b`（濃いグリーン）

#### 📝 未完了項目（次回以降）

1. **action.html の改修**（優先度: 中）
   - 内容: 未定（K が指示予定）

2. **その他（HANDOFF.md より）**
   - comm.html 自動振り分け（電話+案件1件なら自動）
   - マップのジオコーディング完走確認
   - 施工条件メモの構造化
   - 連絡先のFirebase取り込み改善
   - AI下見スケジュール提案ページ
   - etc.

---

## 🔧 K の毎朝作業フロー（現在）

```
1. Salesforce → CSV ダウンロード
2. index.html を開く → データロード（約5秒）
3. admin.html → CSV手動インポート
   ↓（以下、全自動）
4. GAS毎朝トリガー（7:00）
   - Firebase → CSV貼り付け → importData() → 管理表に反映
5. GAS毎時間トリガー（8-18時、毎時間）
   - Firebase → P/Q/R を Sheet に自動更新
   - 既存 syncCalendar_() が Calendar に自動反映
6. メーラー使用方法
   - 夜間: メーラー → 「生成」→ 修正 → 「保存」
   - 翌朝: メーラー → 赤+点滅案件から「送信」
```

---

## 📁 ファイル構成（重要なもののみ）

### GitHub Pages（public/）
```
index.html                  ← メニュー + 各ページへのリンク
today.html                  ← 案件リスト（下見実施待ち）
action.html                 ← 今日のアクション（改修予定）
calendar.html               ← 下見/施工スケジュール
map.html                    ← ジオマップ
comm.html                   ← 通信タイムライン
mailer-test.html            ← メーラー ⭐ 最新版に置き換え
admin.html                  ← CSV取込（管理者用）

shared-modal.css            ← 共通モーダルスタイル ⭐ 幅拡大版に置き換え
shared-modal.js             ← 共通モーダルロジック
```

### Google Apps Script（GAS）
```
既存プロジェクト（管理表と同期）:
  - importData()：CSV → 管理表、新規/削除反映
  - syncCalendar_()：P/Q/R → Google Calendar（毎時間）
  - onEdit()：U列編集時のアラート
  
新プロジェクト「自動化」⭐:
  - syncFirebaseToSheet()：Firebase → Sheet P/Q/R 自動更新
  - installHourlyTrigger()：毎時間トリガー設定済み
```

### Firebase Realtime Database
```
app_tasks/[handoff_id]/
  csvData: [配列 0-12]
  localStatus, date, time, order
  mailStatus: {reform, takara, sms}
  constructionDateConfirmed, heardFromCarpenter, etc.

app_parked_mails/[uuid]/           ⭐ NEW
  assignedCase, mailType, sendMethod
  toPhone, toEmail, subject, body
  status: "parked"
  createdAt

app_contacts: [連絡先配列]
  Mac + iMessage + Gmail 統合
```

### Google Sheet（管理表）
```
Spreadsheet ID: 1wR4uLlNipGbDP1uAfIyecwkkWbayaDB_AzQ7V5gJXQU
Sheet: 「管理表」「CSV貼り付け」

重要列（0-indexed）:
  C0: ID（手配ID = Firebase キー）
  C2: 施工日（Salesforce）
  C4: 管理名
  P(16): 下見日 ← Firebase date から自動更新 ⭐
  Q(17): 時間 ← Firebase time から自動更新 ⭐
  R(18): 順番 ← Firebase order から自動更新 ⭐
```

---

## 🎯 デザイン原則（K のルール）

- **完全ファイル置換**: 部分編集なし
- **var 使用**: const/let の初期化順序バグ回避
- **GitHub更新**: Web編集（鉛筆アイコン）→ 全選択 → 貼り付け → コミット
- **Firebase キー**: Salesforce 手配ID（ `csvData[0]`）
- **レスポンシブ**: 画面サイズで自動調整（モバイル対応）

---

## 🔐 認証情報（コード内に記載、公開リポジトリ）

```javascript
firebase apiKey: "AIzaSyDznSykpSebsejNdQtpOgfORuzZSoW3_fs"
databaseURL: "https://project-6745138395263517914-default-rtdb.firebaseio.com"
projectId: "project-6745138395263517914"
```

⚠️ **API キーは公開リポジトリに含まれるため、セキュリティ上の注意は不要**（Firebase セキュリティルールで保護）

---

## 💡 次回セッションへの引き継ぎ

### 優先度: 高
1. **action.html 改修** ← K が指示を待機中

### 優先度: 中
2. **comm.html 自動振り分け**（電話+案件1件なら自動 assignedCase）
3. **メーラーグリッド表示を続行**（生成+保存のフロー安定化確認）

### 優先度: 低
4. マップのジオコーディング完走確認
5. 施工条件メモの構造化UI
6. AI下見スケジュール提案ページ

---

## 📞 技術サポート連絡先（Claude）

このファイルを参照して、以下の質問に答えられます：
- 「今のコード構造は？」
- 「Firebase スキーマ何だっけ？」
- 「GAS のトリガー動いてる？」
- 「メーラーの仕様は？」

前回セッションのコードは `/mnt/transcripts/` に保存済み。

---

**End of HANDOFF**
