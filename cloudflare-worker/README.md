# 施設情報共通編集API

GitHub Pages版のナビから呼び出すCloudflare Worker + D1 APIです。基本の道路データは変更せず、SA・PAの設備・店舗の上書きだけを保存します。

## 権限

- 一般利用者：ログイン不要。端末・接続元単位で1時間に5回まで保存可能。
- Google登録編集者：Google IDトークンをWorkerで検証し、`EDITOR_EMAILS`に含まれる場合はアプリ側の回数制限なし。
- どちらも地点名、座標、距離、道路接続は変更できません。
- 詳細な変更履歴は保存せず、同期用の最終更新日時だけ保存します。
- 古い匿名回数制限データは日次処理で自動削除します。

## API

- `GET /v1/overrides`：全設備上書きを取得
- `GET /v1/overrides?roadId=e4-north`：方向別に取得
- `POST /v1/overrides`：設備・店舗を保存
- `GET /v1/editor/status`：Google登録編集者か確認

## ローカルテスト

```powershell
node --test test/validation.test.mjs
node --check src/index.js
```

実際の公開手順は[`pages/README.md`](../pages/README.md)を参照してください。
