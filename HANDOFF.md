# 案件管理システム 引き継ぎメモ（2026-04-03 統合版）

## 使い方

新しいClaudeセッションで以下のように言ってください:

```
https://raw.githubusercontent.com/kageyama1202/my-sheet/main/HANDOFF.md を読んで。
XXXを修正したい。
```

修正対象ファイルも同様に:

```
action.htmlを読んで
→ https://raw.githubusercontent.com/kageyama1202/my-sheet/main/action.html
```

コード全文を貼り付ける必要はありません。

---

## プロジェクト概要

建設案件の管理システム。GitHub Pages + Firebase Realtime Database で構成。
GASは使わない方針。UIは全てスタンドアロンHTML。

- リポジトリ: <https://github.com/kageyama1202/my-sheet> (public)
- 公開URL: <https://kageyama1202.github.io/my-sheet/>

---

## ファイル構成

### コアページ（9ファイル）

- **index.html** — トップページ。Firebase→LocalStorage保存。通し番号(seqNo)自動付与。
- **today.html** — フィルタ付き案件リスト。期間指定、ステータス/区分/会社/地域チェック。共通モーダル使用。下見予定日列あり。
- **calendar.html** — 月表示カレンダー。施工/下見/下見予定の3種チェック切替。
- **map.html** — Leaflet.js地図。Nominatimジオコーディング+Firebaseキャッシュ。ステータス色分け。
- **action.html** — アクションダッシュボード。2タブ構成（アクション/備忘録）。5ステータスサブタブ。ランク制ステータス。共通モーダル使用。ソート切替（デフォルト/施工日順）。
- **comm.html** — 通信タイムライン。2カラム（左:タイムライン、右:案件候補）。手動案件紐付け。非表示管理。未分類メッセージ赤ボーダー訴求。❓未分類フィルターボタン。
- **admin.html** — 管理者用CSVアップロード。SFのcsvData[0]（手配ID）をキーとして保存。旧キー→新キー自動マイグレーション。CSVから消えた案件は自動削除。ログ表示付き。
- **mailer-test.html** — ✉️ メーラー。一括送信パネル型（SMS/メールアプリのワンクリック起動＋履歴保存）。`?key=案件キー` パラメータで案件自動選択対応。モーダルの「✉️ メール送信」ボタンから遷移する。

### 共通ファイル（3ファイル）

- **shared-modal.css** — 共通モーダルスタイル。モーダル内は白背景+濃い文字色(color:#333)。メーラーリンクボタン(.modal-mailer-btn)スタイル含む。
- **shared-modal.js** — 共通モーダルロジック。4段階マッチ（手動/KW/名前/TEL）。通信履歴+メモ+カンバン+保存コールバック。保存ボタン横に「✉️ メール送信」ボタン→mailer-test.html?key=XXXへ遷移。
- **firebase-db.js** — Firebase設定共通化（一部ページで使用）。

### その他（開発中・旧版）

- index2.html, index3.html, indexold.html — index.htmlの旧版
- all.html, app.html, detail.html, export.html, menu.html — サブページ各種
- reform.html, shinchiku.html, sekou_kakunin.html, sogo.html, table.html — 区分別ビュー等
- mailer.html, modal-mailer.html — メーラー旧版（mailer-test.htmlに統合済）
- test-modal.css, test-modal.js — テスト用モーダル（本番では使わない。**shared-modal.cssを上書きしないこと**）

---

## 設計方針（2026-04-03確定）

### モーダルとメーラーは分離

- **モーダル（shared-modal.js）**: 案件詳細の確認・編集に特化。既に6セクション（CSV/カンバン/チェック/スケジュール/メモ/通信履歴）あり、これ以上の機能追加はスクロール地獄。
- **メーラー（mailer-test.html）**: メール/SMS送信に特化。画面いっぱい使えて文面編集しやすい。
- **連携方法**: モーダル下部の「✉️ メール送信」ボタン → `mailer-test.html?key=案件キー` に遷移。メーラー側でURLパラメータを読んで該当案件を自動オープン。
- **統合は不要**。統合しようとして1日無駄にした実績あり（2026-04-02）。

---

## データフロー

1. index.html: Firebase全データ取得 → LocalStorageに保存（通し番号も付与）
2. サブページ: LocalStorageから読み込み（通信なし、高速）
3. 入力時: Firebase即保存 + LocalStorage即更新
4. comm.html: Firebaseから直接読み込み（LocalStorage不使用）
5. 次回起動: トップから入り直せば最新データに更新

---

## Firebase構造

```
app_meta/
  headers: [配列] — CSVヘッダー（13列、index 0〜12）

app_tasks/
  [手配ID（csvData[0]ベースのsafeKey）]/
    csvData: [配列] — CSVデータ（index 0〜12）
    date: "2026-03-28" — 下見予定日（ブラウザ入力）
    time: "10:00" — 下見予定時間
    order: "1" — 下見順
    localStatus: "連絡済" — ローカルステータス（カンバン入力）
    emailSent: true/false — 施工日確認メール済フラグ
    finalReport: true/false — 最終報告完了フラグ
    memo: "テキスト" — 自由メモ（モーダルから入力）
    seqNo: 1 — 通し番号（自動付与）
    lat: 43.06 / lng: 141.35 — ジオコーディングキャッシュ
    mailStatus: { reform: true, takara: true, sms: true } — メーラー送信履歴

app_communications/
  [自動キー]/
    dt, src, dir, contact, subject, body, assignedCase

app_contacts/
  [配列] — 連絡先（名前/メアド/電話/会社/ソース）

app_contractor_notes/
  [配列] — 業者メモ（施工条件等）

app_notes/
  [自動キー]/ — 備忘録メモ（text, ts）

app_parked_mails/
  [自動キー]/ — 仮置きメール（status, sendMethod, mailType, toPhone, toEmail, subject, body, assignedCase, createdAt）
```

---

## CSVデータのカラムマッピング（実データで確認済み）

```
index 0: 手配: ID ★Firebaseキーの元
index 1: 手配ステータス（依頼/下見実施中/下見日程確定/下見完了/完了）
index 2: 施工日(数式用)
index 3: 工事区分名（略称）（新/ﾘ）
index 4: 手配: 管理名（案件名として表示に使用）★重要
index 5: 打合担当者（会社名+担当者。スペース区切り1語目=会社名）
index 6: 担当者携帯許容記号除外（電話リンク対象）★SMS紐付けキー
index 7: 下見依頼日
index 8: 工務担当者(名称) ★タカラ側担当者名→電話番号逆引きに使用
index 9: 施工業者
index 10: 施工指示および備考
index 11: 住所(改行なし)（地図リンク対象）
index 12: 下見日
```

---

## ステータス体系（ランク制）

### SF側（csvData[1]） → ローカル変換

```
依頼(0) → 依頼(0)
下見実施中 → 連絡済(1)
下見日程確定 → 下見日確定(2)
下見完了 → 報告書提出済(4)
完了(5) → 完了(5)
```

### ローカル側（localStatus、カンバン）

```
依頼(0) → 連絡済(1) → 下見日確定(2) → 下見実施済(3) → 報告書提出済(4) → 完了(5)
```

### ステータス決定ルール

SF側とローカル側のランクを比較し、**進んでる方（ランク高い方）を採用**。

---

## アクションダッシュボード（action.html）

### 2タブ構成

- 🔔 アクション: 5ステータスサブタブ（下記）
- 📋 備忘録: Firebase app_notesにテキスト保存

### 5ステータスサブタブ

1. 📞 連絡: ﾘ AND rank=0。カード表示（電話番号タップ発信、依頼経過日数、備考1行）。デフォルト経過日数降順。
2. 📅 日程確定: rank=1 OR (新 AND rank=0)。新築はここから開始。
3. 🏃 下見: rank=2
4. 📝 報告書: rank=3
5. ✉️ 確認メール: rank=4 AND emailSent=false

### ソート切替

- デフォルト: 連絡タブは経過日数降順、他は施工日近い順
- 施工日順: 全タブ施工日近い順

### 全タブ共通表示

- 施工日、残り日数、下見日（csvData[12]）、下見予定日（obj.date）

---

## 通信タイムライン（comm.html）の仕組み

### 2カラムレイアウト

- 左: メッセージタイムライン（3ヶ月分）
- 右: 選択したメッセージの案件候補

### 未分類メッセージの訴求

- 案件候補0件 & assignedCaseなし → 赤い左ボーダー + 暗い赤背景 + ❓未分類ラベル
- ❓未分類フィルターボタンで未分類のみ表示可能
- ヘッダーに未分類件数表示

### メッセージ→案件候補の検索ロジック（3段階）

1. **電話番号マッチ**: メッセージの電話番号 → phoneToCasesList[phone]
2. **名前マッチ（フォールバック）**: 連絡先名 → extractSei()で姓を抽出 → nameToCases[sei]
3. **工務担当者クロスリンク**: csvData[8]の工務担当者名 → nameToPhones[name]で電話番号逆引き

### 手動案件紐付け

- 右パネルのチェックボックスで案件選択
- Firebase app_communications/[key]/assignedCase に保存
- ラジオ的動作（1メッセージ=1案件）

---

## メーラー（mailer-test.html）の仕様

### 一括表示パネル

案件を選ぶと「リフォーム問合」「施工日確定(タカラ)」「施工日確定(先方・業者)」の3ブロックが縦に表示。

### 主な機能

- **工事区分による表示切替**: csvData[3]に「ﾘ」が含まれない場合、リフォーム問合ブロックは非表示。
- **連絡先検索**: app_contacts（連絡帳）を「フルネーム」→「会社名」→「担当者名」の順で走査し、メールアドレスと電話番号を自動セット。
- **ワンクリック起動**: SMS/メールアプリを直接起動。起動前にテキストエリアで文面の加筆修正可能。
- **履歴保存とバッジ**: アプリ起動後「履歴保存」でバッジが「🟢済」に。未保存メッセージは赤アラート表示。
- **完了案件非表示**: ステータスが「完了」の案件はリストに表示しない。
- **URLパラメータ対応**: `?key=案件キー` で該当案件のモーダルを自動オープン。

---

## 共通モーダル（shared-modal.js）

### 機能

- CSVデータ表示（白背景+濃い文字色で表示）
- カンバンバー（ランク制ステータス）
- チェック（emailSent/finalReport）
- 下見スケジュール（日付/時間/順）
- メモ欄（Firebase保存）
- 通信履歴表示（4段階マッチ対応）
- 保存コールバック（onSaveCallback）
- **✉️ メール送信ボタン** → mailer-test.html?key=XXX に遷移

### 通信履歴の4段階マッチ

1. ✔ 手動（青）: assignedCase === caseKey
2. ★ KW（オレンジ）: 電話番号一致 + キーワードスコア > 0
3. 📎 名前（紫）: body/subjectに案件名の人名等が含まれる
4. TEL（装飾なし）: 電話番号一致のみ

### 呼び出し方

```
openCaseModal(key, obj, globalHeaders, globalTasks, fullData, database, onSaveCallback);
```

---

## admin.html のキー管理（2026-04-01変更）

- csvData[0]（SF手配ID）をsafeKey化してFirebaseキーとして使用
- 施工日等が変わっても同一案件として認識・上書き更新
- 旧キー形式からの自動マイグレーション
- assignedCase参照も旧→新キーに自動書き換え
- CSVから消えた案件は自動削除

---

## Macターミナルのスクリプト群（~/mail-collect/）

### 日常の更新コマンド

```
cd ~/mail-collect && python3 read_imessage.py && python3 read_gmail.py && python3 upload_firebase.py
```

※ Messages.appを閉じてから実行すること（WALフラッシュが必要）

### 連絡先の更新コマンド

```
cd ~/mail-collect && python3 read_contacts.py && python3 ~/Desktop/CSV倉庫/upload_all_contacts.py
```

---

## Firebase設定（全ページ共通）

```
apiKey: "AIzaSyDznSykpSebsejNdQtpOgfORuzZSoW3_fs"
databaseURL: "https://project-6745138395263517914-default-rtdb.firebaseio.com"
projectId: "project-6745138395263517914"
```

---

## 注意事項・開発ルール

- **完全ファイル置換**: 部分修正より全置換が確実。出力は必ず【全張り替え版】か【部分修正版】かを明示。
- **var使用推奨**: const/letの初期化順序バグが何度も発生。varが安全。
- **配列インデックス**: csv[ 2 ] のようにスペースを入れること（システム誤認防止）。
- **GitHubキャッシュ**: Ctrl+Shift+Rで強制リロード必須。
- **リポジトリはpublic**: APIキー・電話番号・名前等の個人情報をコードに含めない。
- **カラム定義・業務フローは聞くな**: このメモを参照しろ。
- **技術選択肢があるなら勝手に選んで実装しろ**: Kに聞くな。
- **GitHub更新方法**: Webブラウザでファイルを開き→鉛筆アイコン→全選択→貼り付け→コミット。
- ⚠️ **shared-modal.css を test-modal.css の内容で上書きしないこと**（2026-04-03に実際に発生。モーダルが全く表示されなくなる致命的バグ）。

---

## 既知の問題・未完了タスク

### 高優先度

1. comm.htmlの自動振り分け（電話番号マッチ+案件1件だけの場合は自動assignedCase）

### 中優先度

2. マップのジオコーディング完走確認（124件中75件程度取得済み）
3. 施工条件メモの構造化（app_contractor_notesの表示UI）
4. 連絡先のFirebase取り込み改善（Mac連絡先の名前クリーニング精度）
5. shared.js共通化の続き（モーダル以外のユーティリティ関数）

### 低優先度

6. AI下見スケジュール提案ページ
7. 担当者マスターシート
8. キーワードタブのクロスデバイス共有（現在localStorage）
9. Google Drive API連携（ファイル自動アップロード）

---

## ビジネスフロー（参考）

### リフォーム(ﾘ)

連絡→下見日時決定→下見実施→報告書→施工日確認メール

### 新築共通

施工日21日前に下見→報告書→施工日確認メール

### 新築SK（キッチン）

21日前に1回目下見 + 10日前に最終下見（計2回）→報告書→施工日確認メール

### 全件共通

施工日14〜21日前に施工日確認メール送信
