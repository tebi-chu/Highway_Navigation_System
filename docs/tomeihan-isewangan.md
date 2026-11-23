# 東名阪道の追加・伊勢湾岸道の出口方向確認

2026-11-23更新。東名阪自動車道を名古屋西JCT〜伊勢関境界まで上下線別の本線形状で追加した。伊勢道とは直進継続リンクで接続する。四日市JCTは伊勢湾岸道との道路判定に利用し、将来の進路を先読みして決めない。

## 伊勢湾岸道の出口

NEXCO中日本の[料金所ナビまっぷ・伊勢湾岸道](https://www.c-nexco.co.jp/navi/tollgate_map/pdf/06_isewangan.pdf)の両ページを照合した。

|IC|上り・豊田方面の出口|下り・四日市方面の出口|
|---|---|---|
|豊田東|あり|あり|
|豊田南|あり|あり|
|刈谷スマート|あり|あり|
|豊明|あり|あり|
|名古屋南|あり|なし|
|大府|あり|あり|
|東海|あり|あり|
|名港潮見|あり|あり|
|名港中央|あり|あり|
|飛島|あり|あり|
|湾岸弥富|なし|あり|
|弥富木曽岬|あり|なし|
|湾岸長島|あり|あり|
|湾岸桑名|あり|あり|
|みえ川越|あり|あり|
|みえ朝日|あり|なし|

`exitAvailable:false`のICは走行ナビの抽出時、継続先道路を含めて除外する。編集画面の原本には残し「出口なし」と表示する。編集による表示名変更や非表示解除は出口制限を解除しない。SA/PAとJCTには適用しない。入口しかない地点をナビの次の出口として見せないための設定であり、リアルタイム通行止め情報ではない。

刈谷PAは既存の設備情報を保ち、両方向のスマートICを同じカードにまとめる。名古屋南ICは上りのJCT共用分岐に追加する。一方向のみのICだけでなく、取得済みOSMの有向ランプ始点を使って各ICの出口分岐位置も点検・更新した。既存地点のIDを維持し、施設情報・店名・メモ・D1データを書き換えない。

## 東名阪道

- 大山田PA、御在所SA、亀山PAを両方向とも収録。亀山PAスマートICはPAと同じカードになる。
- 近くにある通常の亀山ICは別施設として残す。`separateFromArea`でスマートICとの取り違えを防ぐ。
- 亀山ICは名古屋方面からの出口がある下り線に収録。伊勢関の上り本線上の入口合流点は、東名阪の出口として表示しない。
- 標準速度は到達時刻計算用の仮定値であり、各区間の制限速度を案内するものではない。
- 道路形状・IC/PA本線分岐ノードは© OpenStreetMap contributors、ODbL 1.0。現地での全線実測は未実施。

確認資料：

- [NEXCO中日本・東名阪道路概要と路線図](https://www.c-nexco.co.jp/corporate/operation/stock_effect/pdf/250310_stock_higashimeihan.pdf)
- [NEXCO中日本・スマートIC一覧](https://sapa.c-nexco.co.jp/guide/smartic)
- [刈谷市・刈谷スマートIC](https://www.city.kariya.lg.jp/kurashi/road_park/kotsu/1010557/index.html)
- [御在所上り施設案内](https://sapa.c-nexco.co.jp/sapa/guide?sapainfoid=60)、[下り施設案内](https://sapa.c-nexco.co.jp/sapa/guide?sapainfoid=61)
- [亀山上り施設案内](https://sapa.c-nexco.co.jp/sapa/guide?sapainfoid=58)、[下り施設案内](https://sapa.c-nexco.co.jp/sapa/guide?sapainfoid=59)

## 再生成

1. `scripts/Fetch-Tomeihan.ps1`で上下線のOSM relationを取得する。
2. 既存の`data-osm-regional-e23-ise.json`・`data-osm-regional-e1a-isewangan.json`も必要。既存の地域道路取得スクリプトで用意する。
3. `python scripts/build_tomeihan.py`で`web/data/tomeihan.json`と地域データへ反映する。
4. `node scripts/build_junction_matching.cjs`で接続部の補助形状を更新する。
5. `node --test pages/test/*.test.cjs`を実行する。

地域データ全体の再生成時も、コミット済みの`tomeihan.json`と出口方向ルールを適用する。既存の伊豆・箱根等の追加データも継続して読み込む。
