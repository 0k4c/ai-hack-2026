# モデル比較（Issue #17）

## 現在の状態

2026-09-20、tomoyan2312が作成したPR #31を、ユーザーの依頼でMurakami-1124のCodexが引き継ぎました。mainのPR #21を取り込み、**3モデル×3回×2機能の18回を実APIで計測済み**です。結果は下表に記録しています。autoは6/6回で形式検証成功、freeは6/6回でHTTP 429、Gemini直接指定は2/6回で形式検証成功でした。失敗した試行も残しており、モデルの品質評価とは区別しています。

macOS / Node.js v24.12.0で統合後の `node --test` は73件成功・失敗0。計測後、比較表にHTTP状態とエラー分類を追加し、関連8件のテストに成功しています。Named Routerの環境変数切り替えとFallbackヘッダー保存は通信モックで確認済みですが、実際のConsole設定・切り替え後の計測・Fallback発動は未確認です。

## 比較方法

既存の `selectWithOrca` と `requestInterpretation` を変更せずimportします。比較対象は `orcarouter/auto`、`orcarouter/free`、`google/gemini-2.5-flash` の3つを各3回、2機能で合計18回です。モデルの利用可否やfreeの費用は応答で確認し、名前から成功や0 USDを推定しません。

- 候補選定：架空のe1が2026-09-21 18:00〜22:00に欠勤。既存のシードと制約判定が生成した候補を全モデルに同じ形で渡します。
- 希望文解釈：e2の「2026年9月21日は18時から22時まで入れます。」を、既存の希望文解釈プロンプトで処理します。**F2の返事解釈・行動選択を直接評価するものではありません。**
- 日付・入力・プロンプトを固定し、入力SHA-256を記録します。モデル順は各回で巡回させ、常に同じモデルが先になる偏りを減らします。
- 成功は既存コードによる形式検証の成功です。**結果の質は人が確認し、AIは採点しません。**
- 実モデル、入力・出力・総トークン、概算USD、所要時間、HTTP状態、Fallbackヘッダー、回答を1JSONへ保存し、同名のMarkdown表を出力します。
- 失敗した試行も残し、取得済みの課金情報を保持します。欠損はnull／不明。集計に欠損がある項目は平均も不明とし、JSONに取得件数を残します。
- 再試行はしません。認証エラー401/403では残りを止めます。既存クライアントのタイムアウトは選定30秒・解釈60秒です。
- 通信前にpendingの記録を保存します。中断後の自動再開はありません。pendingが残った場合はサービス側の利用履歴と照合してから再実行を判断してください。再実行は新しい課金を伴います。

## 実行手順

Node.js 22.22.1以上。追加パッケージは不要です。各自の.envにAPIキーを設定します。キーは共有しません。

```sh
# 通信せず入力と予定呼び出し数を確認
node src/compare-models.mjs --plan

# 3モデル×3回×2機能。作業フォルダ内の.envを使用
node --env-file-if-exists=.env src/compare-models.mjs

# このリポジトリ内のworktreeからルートの.envを使う場合
node --env-file=../../.env src/compare-models.mjs
```

保存先は既にGit管理外の `output/selections/model-comparisons/<UUID>.json` と同名の `.md` です。`--output DIR` で変更できますが、出力や秘密情報をコミットしないでください。`--models ID,ID` と `--repeats 1〜3` で範囲を絞れます。最大4モデル×3回×2機能です。

## Named Routerの切り替え

人が回答の品質を確認してから、ConsoleでAllowed Models / Strategy / Fallbackを設定します。設定した名前を.envの `ORCAROUTER_MODEL=orcarouter/<名前>` に入れ、同じ入力で測ります。

```sh
node --env-file-if-exists=.env src/compare-models.mjs --configured
```

設定済みの1モデル×3回×2機能の6回です。コード変更は不要です。切り替え前後の表で同じ入力SHA-256であることを確認し、機能別に費用と時間を比較してください。`fallbackModel` が記録された場合だけ、当該呼び出しでFallbackヘッダーを観測したと報告できます。未観測を未設定と断定しません。

## 実測と人の所見

| 項目 | 状態 |
| --- | --- |
| 18回の実測・費用と時間の比較 | 18回実施済み。8回形式検証成功・10回失敗。詳細は下表 |
| 結果の質に対する人の所見 | 未実施 |
| Named RouterのAllowed Models / Strategy / Fallback設定 | 人の品質確認・Console設定待ち |
| Named Routerへの切り替え後の実測 | 未実施 |
| Fallbackの実発動 | 未確認 |
| 記事担当への数値の引き継ぎ | この文書とPR #31へ掲載。記事への転記は#16担当 |

概算費用は `usage.cost_usd` であり、確定請求額とは区別します。今回の比較用JSONには人が記入する `humanReview` を空欄で用意しています。回答の妥当性、説明の正確さ、日付時刻・引用の正確さを人が確認してください。

## 2026-09-20の実API計測

- 開始: 2026-09-20T10:12:23.366Z、終了: 2026-09-20T10:13:41.418Z（UTC）。
- 実行コード: 比較実装 bd7369a + main 73ab16b（今回の表表示の変更はAPIリクエストに影響しません）。
- 記録ID: `bee6c4ea-b44e-44fa-8979-31aa2c6c0760`。元JSONは `output/selections/model-comparisons/bee6c4ea-b44e-44fa-8979-31aa2c6c0760.json`（Git管理外）。
- 元JSONのSHA-256: `ec8a9055c2b03f248dd5c7afccac39640a90ded072e8f3a2c0fe60d0cc8c8c72`。同じIDの表は保存済みのJSONから再生成し、APIの再呼び出しはしていません。
- 応答から取得できた12回分の概算費用の小計は **0.012114 USD**。freeの6回分は費用未取得のため、18回の総費用は不明です。
- 実APIのCLI終了コードは **1**（`completed_with_errors`）。これは10回の失敗を隠さないための仕様であり、全件成功とは報告しません。
- Fallbackヘッダーは18回とも未観測。未設定かどうかは断定できません。

freeの短い応答時間はHTTP 429の拒否までの時間です。成功時の推論速度と比較できず、無料で利用できたという証拠にもなりません。Geminiの選定は3回ともHTTP 200の後に既存クライアントが `invalid_response` と判定し、希望文解釈は1回が `invalid_interpretation`、2回が形式検証成功でした。生のAPI本文は保存しておらず、この記録から失敗の詳しい原因を断定しません。

今回の入力は各機能1ケースのみです。一般的な品質・複雑なF2返事処理への適性は未評価で、Allowed Modelsはまだ決めていません。人が下記の回答を確認し、ConsoleでNamed Routerを設定後、同じ入力の `--configured` 計測へ進めてください。

### 全試行と集計

状態: completed_with_errors / 実行日時: 2026-09-20T10:12:23.366Z
入力SHA-256: 88193a68cf4982a649eb4a45cbf89faed555f30aa23c129812d860c650f3c635

succeededは形式検証の成功であり、品質の採点ではありません。所見は人が記入します。費用は応答時点の概算USDで、確定請求ではありません。欠損は不明とし、失敗した呼び出しも集計に含めます。

| 機能 | 要求モデル | 回 | 実モデル | 状態 | HTTP | エラー分類 | 時間ms | 総トークン | 概算USD | 人の所見 |
| --- | --- | ---: | --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| selection | orcarouter/auto | 1 | z-ai/glm-5.3-flash | succeeded | 200 | — | 6660 | 566 | 0.000098 | 未記入 |
| interpretation | orcarouter/auto | 1 | z-ai/glm-5.3-flash | succeeded | 200 | — | 4442 | 1024 | 0.000122 | 未記入 |
| selection | orcarouter/free | 1 | 不明 | failed | 429 | api_error | 185 | 不明 | 不明 | 未記入 |
| interpretation | orcarouter/free | 1 | 不明 | failed | 429 | api_error | 134 | 不明 | 不明 | 未記入 |
| selection | google/gemini-2.5-flash | 1 | gemini-2.5-flash | failed | 200 | invalid_response | 3066 | 732 | 0.001338 | 未記入 |
| interpretation | google/gemini-2.5-flash | 1 | gemini-2.5-flash | failed | 200 | invalid_interpretation | 5028 | 1644 | 0.00263 | 未記入 |
| selection | orcarouter/free | 2 | 不明 | failed | 429 | api_error | 131 | 不明 | 不明 | 未記入 |
| interpretation | orcarouter/free | 2 | 不明 | failed | 429 | api_error | 120 | 不明 | 不明 | 未記入 |
| selection | google/gemini-2.5-flash | 2 | gemini-2.5-flash | failed | 200 | invalid_response | 3180 | 732 | 0.001338 | 未記入 |
| interpretation | google/gemini-2.5-flash | 2 | gemini-2.5-flash | succeeded | 200 | — | 4213 | 1523 | 0.002326 | 未記入 |
| selection | orcarouter/auto | 2 | z-ai/glm-5.3-flash | succeeded | 200 | — | 3805 | 400 | 0.000044 | 未記入 |
| interpretation | orcarouter/auto | 2 | z-ai/glm-5.3-flash | succeeded | 200 | — | 5604 | 1116 | 0.000104 | 未記入 |
| selection | google/gemini-2.5-flash | 3 | gemini-2.5-flash | failed | 200 | invalid_response | 2638 | 732 | 0.001338 | 未記入 |
| interpretation | google/gemini-2.5-flash | 3 | gemini-2.5-flash | succeeded | 200 | — | 29699 | 1647 | 0.002636 | 未記入 |
| selection | orcarouter/auto | 3 | z-ai/glm-5.3-flash | succeeded | 200 | — | 4608 | 435 | 0.000054 | 未記入 |
| interpretation | orcarouter/auto | 3 | z-ai/glm-5.3-flash | succeeded | 200 | — | 4137 | 1046 | 0.000086 | 未記入 |
| selection | orcarouter/free | 3 | 不明 | failed | 429 | api_error | 128 | 不明 | 不明 | 未記入 |
| interpretation | orcarouter/free | 3 | 不明 | failed | 429 | api_error | 126 | 不明 | 不明 | 未記入 |

### 機能別集計

平均・最小・最大は全試行で値を取得できた場合だけ表示します。JSONには項目ごとの取得件数も保存します。

| 機能 | 要求モデル | 形式検証成功/試行 | 平均ms | 最小–最大ms | 平均トークン | 平均概算USD |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| selection | orcarouter/auto | 3/3 | 5024.333333333333 | 3805–6660 | 467 | 0.00006533333333 |
| interpretation | orcarouter/auto | 3/3 | 4727.666666666667 | 4137–5604 | 1062 | 0.000104 |
| selection | orcarouter/free | 0/3 | 148 | 128–185 | 不明 | 不明 |
| interpretation | orcarouter/free | 0/3 | 126.66666666666667 | 120–134 | 不明 | 不明 |
| selection | google/gemini-2.5-flash | 0/3 | 2961.3333333333335 | 2638–3180 | 732 | 0.001338 |
| interpretation | google/gemini-2.5-flash | 2/3 | 12980 | 4213–29699 | 1604.6666666666667 | 0.002530666667 |

回答の全文、要求入力、HTTP状態、Fallbackヘッダー、人の所見用の空欄は同名のJSONを参照してください。

### 品質確認用の回答（所見は人が記入）

以下は形式検証を通過した8回答の全文です。AIによる正誤・品質の判定は付けていません。失敗した10試行には検証済み回答がありません。

#### selection / orcarouter/auto / 1回目

人の所見: 未記入

```json
{
  "employeeId": "e2",
  "reason": "e2は追加後の週労働時間が4時間でe3の8時間より少なく、上限32時間に対する余裕が大きいため、労働時間の分散の観点で適任です。連勤数は両者とも追加後2日で上限5日の範囲内で差がないため、週労働時間の少ないe2を選定しました。"
}
```

#### interpretation / orcarouter/auto / 1回目

人の所見: 未記入

```json
{
  "interpretation": {
    "summary": "2026年9月21日に18時から22時まで勤務可能という希望です。",
    "preferences": [
      {
        "sourceText": "2026年9月21日は18時から22時まで入れます。",
        "kind": "available",
        "dates": [
          "2026-09-21"
        ],
        "allDay": false,
        "startTime": "18:00",
        "endTime": "22:00"
      }
    ]
  },
  "ambiguities": []
}
```

#### interpretation / google/gemini-2.5-flash / 2回目

人の所見: 未記入

```json
{
  "interpretation": {
    "summary": "2026年9月21日は18時から22時まで勤務可能です。",
    "preferences": [
      {
        "sourceText": "2026年9月21日は18時から22時まで入れます。",
        "kind": "available",
        "dates": [
          "2026-09-21"
        ],
        "allDay": false,
        "startTime": "18:00",
        "endTime": "22:00"
      }
    ]
  },
  "ambiguities": []
}
```

#### selection / orcarouter/auto / 2回目

人の所見: 未記入

```json
{
  "employeeId": "e2",
  "reason": "追加後の週労働時間が4時間でe3の8時間より短く、連勤数も同じ2日のため制約に最も余裕があります。"
}
```

#### interpretation / orcarouter/auto / 2回目

人の所見: 未記入

```json
{
  "interpretation": {
    "summary": "2026年9月21日に18時から22時まで勤務可能との希望です。",
    "preferences": [
      {
        "sourceText": "2026年9月21日は18時から22時まで入れます。",
        "kind": "available",
        "dates": [
          "2026-09-21"
        ],
        "allDay": false,
        "startTime": "18:00",
        "endTime": "22:00"
      }
    ]
  },
  "ambiguities": []
}
```

#### interpretation / google/gemini-2.5-flash / 3回目

人の所見: 未記入

```json
{
  "interpretation": {
    "summary": "2026年9月21日は18時から22時まで勤務可能です。",
    "preferences": [
      {
        "sourceText": "2026年9月21日は18時から22時まで入れます。",
        "kind": "available",
        "dates": [
          "2026-09-21"
        ],
        "allDay": false,
        "startTime": "18:00",
        "endTime": "22:00"
      }
    ]
  },
  "ambiguities": []
}
```

#### selection / orcarouter/auto / 3回目

人の所見: 未記入

```json
{
  "employeeId": "e2",
  "reason": "勤務後の週労働時間はe2が4時間、e3が8時間でどちらも上限内ですが、e2の方が週労働時間が短く、連勤数も同じ2日で基準内です。"
}
```

#### interpretation / orcarouter/auto / 3回目

人の所見: 未記入

```json
{
  "interpretation": {
    "summary": "2026年9月21日に18時から22時まで勤務可能という希望。",
    "preferences": [
      {
        "sourceText": "2026年9月21日は18時から22時まで入れます。",
        "kind": "available",
        "dates": [
          "2026-09-21"
        ],
        "allDay": false,
        "startTime": "18:00",
        "endTime": "22:00"
      }
    ]
  },
  "ambiguities": []
}
```
