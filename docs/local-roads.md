# 伊豆・箱根・横浜の追加道路データ

2026-11-08追加。既存の977地点、既存の道路形状、Cloudflare D1の施設修正・メモは変更しない。新規22方向別リンク・98地点を追加する。

## 収録範囲

|道路|区間|
|---|---|
|伊豆縦貫自動車道|沼津岡宮〜函南塚本、修善寺〜月ケ瀬、河津七滝〜河津逆川。それぞれ両方向|
|伊豆中央道・修善寺道路|函南塚本〜大仁中央〜修善寺。伊豆縦貫道の開通区間をつなぐ両方向リンク|
|箱根新道|山崎〜箱根峠、両方向|
|箱根ターンパイク|小田原口〜箱根大観山口、箱根芦ノ湖口〜湯河原峠口。それぞれ両方向|
|保土ヶ谷バイパス|南町田〜新保土ヶ谷、両方向|
|横浜新道|保土ヶ谷〜戸塚、新保土ヶ谷〜狩場。それぞれ両方向|

伊豆縦貫道の未開通部分、一般道を挟むターンパイクの本線・連絡線間には、自動継続リンクを作らない。GPSで実際に走行する道路に復帰して判定する。片方向のみの出入口は該当する走行方向にのみ収録する。ターンパイクの出入口と大観山休憩地点はナビ用のIC/PA分類であり、道路管理者の正式な施設区分を意味しない。

小田原厚木道路はこの時点で未収録。今回の追加対象にも含めていない。

## データ取得・更新

1. `scripts/Fetch-LocalRoads.ps1`でOpenStreetMapの道路relation、way、接続部の小範囲地図を取得する。公開APIには1秒以上の間隔を設け、取得結果は無視対象の`data-osm-local-*.json`にキャッシュする。
2. `python scripts/build_local_roads.py`で開通済み道路の方向別グラフから連続する経路を抽出する。工事中の道路は使わず、接続しない経路を直線で補完しない。始終点の距離・経路長を検査し、異常時は停止する。
3. 生成した`web/data/local-roads.json`を`regional-expressways.json`に追加する。既存IDの地点は変更しない。既存の地域データ再生成時にもこの追加データを読み込む。
4. `node scripts/build_junction_matching.cjs`でJCT補助形状を再生成する。
5. `node --test pages/test/*.test.cjs`で方向判定、未開通区間の分離、データ整合性などを検証する。

新規IC等の距離基準は原則としてOSMの本線分岐ノードを道路形状へ投影した位置。戸塚PA・大観山は休憩地点の投影位置であり、すべての施設で分岐位置や100m以内の精度を実測保証するものではない。実走行で差が見つかった場合は既存の到着位置補正を利用できる。

施設設備は確認できたものを登録する。戸塚PA下りはファミリーマート、上りはトイレのみ。未確認の店舗・設備を推測して追加しない。OSMデータは© OpenStreetMap contributors、ODbL 1.0。公開アプリの既存の出典表示を継続する。

## 確認資料

- [静岡県・伊豆縦貫自動車道](https://www.pref.shizuoka.jp/machizukuri/doro/1049303/1029252.html)
- [静岡県・2026年1月路線図](https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/029/252/izuzyukan2026.1.pdf)
- [静岡県道路公社・修善寺道路](https://www.siz-road.or.jp/road/syuzen/)
- [横浜国道事務所・保土ヶ谷バイパス](https://www.ktr.mlit.go.jp/yokohama/yokokoku00314.html)
- [箱根新道路線図](https://www.ktr.mlit.go.jp/ktr_content/content/000899827.pdf)
- [ターンパイク公式案内](https://mitte-x-img.istsw.jp/htpl/file/document/EventGuide_202407.pdf)
- [戸塚PA下り・施設案内](https://www.driveplaza.com/sapa/5005/5005036/2/shisetsu_service.html)
- [戸塚PA上り・施設案内](https://www.driveplaza.com/sapa/5005/5005036/1/shisetsu_service.html)
