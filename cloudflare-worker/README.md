# 施設情報共通編集API

GitHub Pages版のナビから呼び出すCloudflare Worker + D1 APIです。基本の道路データは変更せず、SA・PAの設備・店舗、全JCT・IC・SA・PAの表示名・表示状態、走行中に確定した到着位置補正を保存します。

## 権限

- 一般利用者：ログイン不要。端末・接続元単位で1時間に5回まで保存可能。
- Google登録編集者：Google IDトークンをWorkerで検証し、`EDITOR_EMAILS`に含まれる場合は回数制限なし。地点の表示名変更と非表示・再表示も可能。
- 到着位置補正はGoogle登録編集者のみ保存可能です。GPS精度30m以内、位置取得から10秒以内、現在登録位置との差3km以内に制限します。
- 元の地点データは変更せず、到着位置補正専用テーブルの最新値を距離計算へ適用します。画面上の「削除」は復元可能な非表示設定です。
- 詳細な変更履歴は保存せず、同期用の最終更新日時だけ保存します。
- 古い匿名回数制限データは日次処理で自動削除します。

## API

- `GET /v1/overrides`：全設備上書きを取得
- `GET /v1/overrides?roadId=e4-north`：方向別に取得
- `POST /v1/overrides`：設備・店舗を保存。登録編集者の場合は表示名・表示状態も保存
- `GET /v1/editor/status`：Google登録編集者か確認
- `POST /v1/location-corrections`：現在位置を地点の0km位置として保存（登録編集者のみ）

## ローカルテスト

```powershell
node --test test/validation.test.mjs
node --check src/index.js
```

実際の公開手順は[`pages/README.md`](../pages/README.md)を参照してください。
