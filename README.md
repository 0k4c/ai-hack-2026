# AI HACK 2026

2026年9月19日開始のハッカソンに向けた、3人チームの共同開発リポジトリです。

- リポジトリ: https://github.com/0k4c/ai-hack-2026 （現在Private。**提出時はpublic、またはGoogleDriveでソース提出**。判断は [公式条件のまとめ](docs/event-brief.md) を参照）
- 管理者: @0k4c
- メンバー: @Murakami-1124、@tomoyan2312（2026-09-18に招待を承諾）
- テーマ: 業務を自律化するAIエージェント（2026-09-19確定）
- 最初の実装: Node.js CLI。代打候補の選定と希望文の解釈を、OrcaRouterのOpenAI互換HTTP APIで行い、結果をJSONに保存

## 今日の始め方（9/19）

1. [公式条件のまとめ](docs/event-brief.md) でテーマ・審査基準・提出期限（**9/22 15:00**）を読む。
2. [3人での進め方・仮の役割分担](docs/team-playbook.md) を共有する。
3. [制作案の候補](docs/idea-candidates.md) を読み、[キックオフシート](docs/kickoff-sheet.md) を60分で埋めて1案に決める。
4. 決めた内容を [企画書](docs/proposal.md) と [短い要件定義書](docs/requirements.md) に書き写す。
5. [ロードマップ](docs/roadmap.md) で、その日の到達点と提出の逆算を確認する。

3人ともハッカソン・共同開発初心者です。仮の役割は、あなた（0k4c）が全体の調整・統合、メンバー2が入力・使いやすさ、メンバー3が出力・確認・見せ方です。全員がAIを使い、小さな変更から進めます。

## 何を見るか

| 知りたいこと | 見る資料 |
| --- | --- |
| Claude CodeとCodexの担当・引き継ぎ | [AIの役割](docs/ai-roles.md) |
| 導入したスキル・使い分け | [スキル構成と使い方](docs/skills-setup.md) |
| 前回作品の記事と参考にする設計 | [前回作品の参照メモ](docs/previous-projects.md) |
| どんな案があるか・どう選ぶか | [制作案の候補](docs/idea-candidates.md) |
| なぜ作るか・誰に役立つか | [企画書](docs/proposal.md)（打ち合わせで記入） |
| 何を作り、何を作らないか | [短い要件定義書](docs/requirements.md)（打ち合わせで記入） |
| いつまでに何を終えるか | [ロードマップ](docs/roadmap.md)（提出は9/22 15:00） |
| 誰が何をしているか・次の作業 | [進捗管理の使い方](docs/progress.md)とGitHub Issues |
| 役割・AIへの依頼・共同作業 | [3人での進め方](docs/team-playbook.md) |

## 最初の準備

1. GitHubの招待を自分のアカウントで承諾する（3人とも承諾済み）。
2. GitとGitHub CLIを用意し、以下を実行する。

```sh
gh auth login
gh repo clone 0k4c/ai-hack-2026
cd ai-hack-2026
git config user.name "Your Name"
git config user.email "your-verified-or-noreply-email"
```

3. このフォルダをCodex、Claude Code、またはエディタで開く。
4. [AIの接続手順](docs/ai-access.md)と[共同開発ルール](CONTRIBUTING.md)を確認する。
5. [開始前チェックリスト](docs/preflight.md)を3人で確認する。

## 開発の進め方

Issueで担当範囲を決め、作業ごとにブランチを作り、Pull Request（PR）で共有します。別メンバーが確認したらSquash mergeし、最新のmainを取り込みます。

AIへの共通指示は [AGENTS.md](AGENTS.md) です。Claude Codeは [CLAUDE.md](CLAUDE.md) から同じ指示を読みます。これらは開発ルールであり、GitHubへのアクセス権を与えるファイルではありません。

## 実行環境

代打候補の選定、希望文の解釈、最大3巡の代打手配を行うCLIがあります。手配の送信はdryrun（記録のみ）で、勤務確定・画面・実送信は未実装です。

### 技術スタックの提案と今回の採用範囲

| 用途 | 採用 | 理由 |
| --- | --- | --- |
| 実行環境・言語 | Node.js 24系、JavaScript ES Modules | 3人の導入済み環境を使い、コンパイル不要で実行できる |
| AI連携 | Node.js標準fetch → OrcaRouterのChat Completions API | 今回はAPI呼び出し1回だけなのでSDKやエージェントフレームワークの追加が不要 |
| 保存 | 1実行1JSONファイル | 元文・解釈・あいまい理由・利用情報をそのまま確認できる |
| 検証 | node:test、node:assert | 追加パッケージなしで入力・応答・通信失敗・保存を確認できる |

Node.js 22.22.1以上で実行できます（実行確認: v24.8.0 / npm 11.19.0）。今回のCLIとテストに `npm install` は不要です。画面やDBの導入は、その担当タスクが決まった段階で検討します。`public/` は引き続きQiita記事専用とし、実装は `src/`、架空データは `data/` に配置します。

参考: [Node.js fetch](https://nodejs.org/docs/latest-v24.x/api/globals.html#fetch)、[OrcaRouter HTTP API](https://docs.orcarouter.ai/native-formats/openai-compat)。

### 代打候補の選定

Node.js 22.22.1以上を使用します。選定CLIとテストはNode.js標準機能だけで動き、追加パッケージは不要です（確認環境: Node.js v24.8.0 / npm 11.19.0）。

1. 作業ブランチを取得し、そのフォルダで `.env.example` を `.env` にコピーする（PowerShell: `Copy-Item .env.example .env`）。
2. `.env` の `ORCAROUTER_API_KEY` に自分のAPIキーを設定する。
3. 任意で `ORCAROUTER_MODEL` に `orcarouter/<Named Router名>` またはモデルIDを設定する。空なら `orcarouter/auto`。Named Routerのモデル・FallbackはConsoleで設定する。
4. 次を実行する。

```sh
npm run select
npm test
```

`npm run select` は日本時間の翌日18〜22時、田中（e1）の欠勤を入力にします。日付と出力先を変える場合は `npm run select -- --date 2026-09-22 --output output/selections` のように指定します。日付は当日以降を指定してください。コマンドはプロジェクト直下で実行します。APIキーを引数やチャットに貼らないでください。

`data/employees.seed.json` は架空の6人です。勤務日は対象日からの相対日、伊藤だけ対象週（月〜日）の他6日に各5時間を展開し、毎週同じ境界条件を再現します。既存勤務がすべて入力されている前提で判定します。

| 従業員 | 18〜22時の代打候補 |
| --- | --- |
| e1 田中 | 欠勤者のため除外 |
| e2 佐藤 | 候補 |
| e3 鈴木 | 候補 |
| e4 高橋 | 追加後6連勤、上限5日で除外 |
| e5 伊藤 | 対象週30時間＋4時間、上限32時間で除外 |
| e6 渡辺 | 希望休のため除外 |

`src/constraints.mjs` が追加後の連勤数（前後の勤務日を結合）、週時間（月曜始まり）、希望休を機械判定します。上限ぴったりは許可し、欠勤者と時間帯の重複も除外します。同日勤務は連勤1日として数え、時間は合算します。日跨ぎ勤務は拒否します。これはデモの勤務条件で、労務法令への準拠を保証するものではありません。

`src/orcarouter.mjs` は候補IDと勤務時間・連勤数だけを送信し、AIが返したIDが候補内か、理由が空でないかを再検証します。モデルを広く利用できるようJSONをプロンプトで要求し、壊れたJSONや出力打ち切りは失敗として保存します。1回の実行につきAPI呼び出しは最大1回、タイムアウト30秒、出力上限512トークンです。自動再試行は行いません。

記録は `output/selections/<処理ID>.json` に1実行1ファイルで保存します（Git管理対象外）。`selection` に選んだIDと理由、`filtering` に全員の除外理由・計算結果、`requestedModel` に要求モデル、`actualModel` に実モデル、`tokens` に入出力と合計、`estimatedCostUsd` に概算USD、`requestId` に照合用IDを残します。氏名はCLI表示時だけ復元し、APIや記録に含めません。

実モデルは `X-Orca-Fallback-Model` → `X-Orca-Resolved-Model` → 応答本文のモデルの順で取得します。router名しかない場合は `null`。費用は `X-OrcaRouter-Include-Cost: true` で要求した `usage.cost_usd` を使用します。これは応答時点の概算で、実請求の確定値ではありません。モデル・トークン・費用が欠けた場合は `null` とし、無料や0トークンとは解釈しません。参考: [公式レスポンスヘッダー](https://docs.orcarouter.ai/routing/response-headers)、[リクエスト費用](https://docs.orcarouter.ai/operations/per-request-cost)。

候補ゼロならAPIを呼ばず `no_candidates` を記録します。APIエラー・タイムアウト・候補外の回答は `failed` とし、選定せず終了コード1を返します。不正なAI回答でも取得済みのモデル・トークン・費用を保持します。入力エラーはAPIを呼ばず終了します。APIキーや生のAPIエラー本文は記録しません。

テストは通信を模擬して、曜日7通りの絞り込み、境界値、候補外回答、429、タイムアウト、氏名の非送信、JSON保存を確認します。実APIへの接続確認はキーを設定して `npm run select` を実行し、保存されたモデル・トークン・費用を確認してください。lint・buildコマンドは未導入です。

2026-09-20の実接続確認では、9/21の欠員に対してe2が選ばれ、実モデル `z-ai/glm-5.3-flash`、入力254＋出力301＝555トークン、概算0.000094 USD、所要4,456 msがJSONに保存されました。選定理由は追加後の週労働時間がe2は4時間、e3は8時間で、連勤数はともに2日という比較でした。モデル・回答・費用は実行ごとに変わります。

### 希望文の解釈：起動・入力

この実装の作業ブランチを取得し、プロジェクト直下で `.env.example` を `.env` にコピーします（既存の `.env` がある場合は上書きせず利用）。`ORCAROUTER_API_KEY` を自分のキーに設定してください。`ORCAROUTER_MODEL` は任意で、空なら `orcarouter/auto`、Named Routerなら `orcarouter/<名前>` です。

```sh
# 架空のe1の希望文を1件読み、実APIへ1回リクエストする
npm run interpret

# 自分で希望文を指定する（氏名ではなくID）
npm run interpret -- --employee e1 --text "来週の火曜以外、夕方なら入れます。"

# 本人が文を書いた基準日がわかる場合だけ指定する
npm run interpret -- --employee e1 --text "来週の火曜は18:00から22:00まで入れます。" --reference-date 2026-09-20

# JSONファイルを入力する
npm run interpret -- --input data/preference.example.json

# APIキーやネット接続なしで自動テスト
npm test
```

入力JSONは次の3項目です。`employeeId` は架空の `e1`〜`e6`、`text` は空白だけではない1〜4000文字、`referenceDate` は実在する日付または `null`（省略可）。基準日は実行日ではなく、その希望文を書いた日を指定します。過去の基準日も受理し、過去の文の解釈を再現できます。

```json
{
  "employeeId": "e1",
  "text": "田中です。来週の火曜以外、夕方なら入れます。",
  "referenceDate": null
}
```

`--input` と `--text`/`--employee`/`--reference-date` は併用できません。`--output output/interpretations` で保存先を指定できます。既定の保存先はGit管理対象外です。別の保存先を使う場合も元文を誤ってコミットしないでください。

このPCの専用worktreeから、既に設定されたリポジトリ直下のキーを使う場合は `node --env-file=../../.env src/cli-interpret.mjs` で実行できます。キーのコピーは不要です。

### 解釈と記録

`src/preferences.mjs` のプロンプトをOrcaRouterへ渡し、AIが `interpretation.summary`（要約）、`interpretation.preferences`（勤務可否・日付・終日か・時刻）、`ambiguities`（入力中の該当箇所・項目・あいまい理由）を返します。日付・時刻が特定できない場合は `null` にし、理由を必須にします。基準日のない「来週」は実行日で補いません。基準日がある場合は次の月曜〜日曜、日本時間として解釈します。「夕方」を勝手に18時などに置き換えないよう指示します。

コードは日付・時刻の形式、入力中に引用が存在すること、未確定値に対応する理由、余分なキーを検証します。`requiresClarification` はあいまい理由の有無からコードで計算します。**解釈成功はシフト確定を意味しません。** 意味の取り違えやあいまい箇所の見落としをすべて検出できる保証はなく、AIの解釈は確認対象です。

`output/interpretations/<処理ID>.json` に次を保存します。

| フィールド | 内容 |
| --- | --- |
| employeeId / originalText / context | 対象ID、元の文（そのまま）、基準日・タイムゾーン |
| interpretation / ambiguities | 解釈とあいまい箇所・理由。失敗時はnull |
| requiresClarification | 未確定箇所があればtrue、明確ならfalse、失敗時null |
| status / error | interpreted、failed、pendingと失敗理由 |
| requestedModel / actualModel | 要求モデルと実際に応答したモデル |
| tokens | 入力・出力・合計トークン |
| estimatedCostUsd / costSource | 応答時点の概算USDと取得元 |
| requestId / durationMs | OrcaRouter照合用IDと処理時間 |

実モデルは `X-Orca-Fallback-Model` → `X-Orca-Resolved-Model` → 応答本文の順で取得します。router名しか分からない場合は `null`。費用は `X-OrcaRouter-Include-Cost: true` で取得する `usage.cost_usd` です。取得できないモデル・トークン・費用は `null` とし、0円とは扱いません。概算と確定請求額は異なり得ます。参照: [レスポンスヘッダー](https://docs.orcarouter.ai/routing/response-headers)、[費用の取得](https://docs.orcarouter.ai/operations/per-request-cost)。

### 失敗時と制約

- 通信前に `pending` のJSONを作り、結果が出たら一時ファイル経由で置き換えます。中断でpendingが残った場合、自動再実行はせずOrcaRouter側の利用状況を確認してください。
- API呼び出しは最大1回、タイムアウト60秒、出力上限4,096トークン。自動再試行・聞き返し・送信操作はありません。同じ文を再実行すると別の記録・別のAPI呼び出しになります。
- 429・通信失敗・不正JSON・出力打ち切り・形式不正は `failed` を保存し、終了コード1。失敗でも取得済みのモデル・トークン・費用は保持します。入力エラーはAPIも記録も作らず終了します。
- モデルからはJSONをプロンプトで要求し、受信後に検証します。モデルごとのJSON応答品質には差があります。Named RouterのFallback設定、確定請求額との照合は未実装・未確認です。
- `data/employees.json` は架空の6人です。登録済みの氏名は本文中でもIDへ置換して送ります。未登録の名前や他の個人情報を自動検出する仕組みはありません。デモは架空の文だけを使用してください。要件どおり元の文はローカルJSONに残ります。
- 日跨ぎ勤務は時刻未確定として扱わせます。シフト表の作成・連勤や労働時間の検査は今回の範囲外です。

テストは通信を模擬して実行します。入力、未確定理由の整合性、氏名置換、命令の混入、実モデル・費用、429・タイムアウト、JSON保存、CLIを確認します。lint・buildは未導入です。

2026-09-20に実APIで確認しました。サンプルの「来週の火曜以外、夕方なら」に対し、基準日不明と開始・終了時刻未指定の2点を指摘し、日付・時刻を `null` のまま保存しました。最終版は `z-ai/glm-5.3-flash`、入力762＋出力1,407＝2,169トークン、概算0.000408 USD、13,262 msでした。開発中の出力上限到達1回と調整確認を含む3回の概算合計は0.001402 USDです。実行記録はローカルに保存し、リポジトリには含めていません。回答・モデル・費用は実行ごとに変わります。

### 代打手配：打診・返事の解釈・最大3巡

Issue #15のCLIです。追加パッケージは不要です。Node.js v24.12.0 / npm 11.6.2で確認しています。
既存の `.env` に `ORCAROUTER_API_KEY` を設定します（キーをチャットやコマンド引数へ貼らないでください）。

```sh
# 日本時間の翌日18〜22時のe1の欠員を、架空の返事で手配する
npm run arrange

# 日付・欠勤者・時間・返事スクリプトを指定する
npm run arrange -- --date 2026-09-22 --absent e1 --start 18:00 --end 22:00 --replies data/replies.example.json

# このリポジトリ内の専用worktreeから、直下の.envを利用する場合
node --env-file=../../.env src/cli-arrange.mjs

# キー・ネット接続なしで全テストを実行する
npm test
```

`data/replies.example.json` はe2の辞退、e3の受諾の架空データです。既存の候補絞り込みとAI選定を利用し、e2が最初に選ばれた場合は「辞退→e3へ再打診→受諾」を確認できます。最初の相手・行動はAI判断のため固定ではありません。選ばれたIDの未消費の返事を上から1件読み、同じIDの複数の返事は再打診時に順番に使います。返事が足りない場合は待機・自動生成せず店長へ回します。JSONはUTF-8（BOMありも可）、登録済みのIDと1〜4000文字の返事を持つ最大100件の配列です。

条件付きの返事と再打診を試す場合は、例えば次のスクリプトを別ファイルで指定します。

```json
[
  { "employeeId": "e2", "text": "18時からなら大丈夫ですが、20時に一度抜けます。" },
  { "employeeId": "e2", "text": "18時から20時までなら入れます。" },
  { "employeeId": "e3", "text": "その日は無理です。" }
]
```

AIは返事を `accepted`（受諾）/ `declined`（辞退）/ `conditional`（条件付き・不明）に解釈し、`next_candidate`（次の未打診候補）/ `retry`（時間を変えて再打診）/ `escalate`（店長へ）を選びます。提示時間全体を受諾した場合は `hold`（仮押さえ・承認待ち）で止まります。**`filled` は欠員全体の受諾が得られたという意味で、勤務確定ではありません。** `approvalStatus: "pending"` と仮押さえだけを保存し、従業員のシフトデータは更新しません。承認操作は今回の実装に含みません。

コードが許可する再打診は、同じ相手・同じ日付で、元の欠員時間内の異なる連続した時間帯だけです。時間を変えた後も連勤・週時間・希望休・勤務重複を検査します。一部時間の受諾だけでは欠員全体を `filled` にせず、`escalated / partial_coverage` として店長へ回します。翌日への変更、複数人の部分勤務の結合、あいまいな時間の推測は行いません。AIが文意を正しく解釈できる保証はなく、条件付きの時間が返事の意図と合うかは人が確認してください。

`src/notify.mjs` の `sendRequest` / `receiveReply` は処理ごとのdryrunアダプターです。送信結果は常に `channel: "dryrun"` / `delivered: false`。外部サービスや従業員への実送信はありません。

#### 手配の記録と停止

`output/arrangements/<処理ID>.json` に1欠員1ファイルを保存します。処理IDは欠勤者・日付・開始・終了を正規化した内容のSHA-256です。**同じ保存先で同じ欠員を実行しても、同時実行を含めAPI・打診を繰り返しません。** 既存の記録を表示します。エラー・中断でも自動再試行せず、`pending` が残る場合は記録とOrcaRouterの利用状況を確認します。保存先変更やファイル削除で重複防止の効力がなくなるため、通常は既定の保存先を固定して使用してください。別PC間の排他、同じ欠員の時間を変更した場合の重複検知はありません。

| フィールド | 内容 |
| --- | --- |
| `vacancy` / `filtering` | 欠員と、全員の勤務条件の判定 |
| `selection` / `selectionRequest` | 最初の選定理由、実モデル・トークン・概算費用・照合ID・時間 |
| `rounds[]` | 各巡の相手ID、選定理由、提示時間、送信文とdryrun結果、返事原文、解釈、AIの行動と理由、利用情報 |
| `status` / `stopReason` | `filled` / `escalated` / `failed` と停止理由（処理中・中断は `pending`） |
| `approvalStatus` / `provisionalAssignment` | 店長承認待ちか、仮押さえした相手・日時 |
| `totalTokens` / `totalEstimatedCostUsd` | 最初の選定＋全巡の解釈の合計。1回でも欠損した項目は `null` |
| `totalDurationMs` / `limits` | 全処理の経過時間と、コードによる上限 |
| `error` | 安全なエラー分類・HTTPステータス・説明。生のAPI本文やキーは保存しない |

AIが継続を要求しても打診は最大3巡、API呼び出しは最初の選定1回＋各巡1回の最大4回です。1通信は最大60秒、処理全体は180秒を上限とし、残り時間で通信タイムアウトを短縮します。候補ゼロ、返事なし、3巡到達、時間上限、AIの引き継ぎ判断で停止します。金額のハード上限は未実装です。429は `api_error` と `httpStatus: 429`、タイムアウトは `timeout`、壊れたJSONは `invalid_response` / `invalid_interpretation`、許可外の行動は `invalid_decision` として `failed` に記録します。自動リトライはありません。`failed` / `pending` と入力エラーは終了コード1、受諾・店長への引き継ぎは0です。

既存の `requestInterpretation` / `responseTelemetry` / `redactNames` を再利用します。登録済みの氏名は返事・再送するAI理由も含めてIDに置換し、元の返事はローカル記録にのみ残します。架空データだけで利用してください。保存先はGit管理対象外です。従業員名簿の二重管理は既存CLIへの影響を避けて維持し、両ファイルのIDと名前の一致をテストで検査します。

自動テストでは上記の流れ・上限・同時実行・通信障害を模擬して確認します。自然文の実際の解釈品質、実モデル・費用・時間は実APIで別途確認が必要です。lint・buildは未導入です。

### 提出記事（Qiita）

記事は `public/` のmarkdownとして書き、mainへマージすると GitHub Actions が自動でQiitaへ投稿します。

- ランタイム: Node.js 22.22.1以上（動作確認: v24.8.0 / npm 11.19.0）
- 依存関係: `package.json` / `package-lock.json`（`@qiita/qiita-cli`）
- 記事ファイル: `public/ai-hack-2026-agent.md`
- ワークフロー: `.github/workflows/publish.yml`（mainへのpush、または手動実行）

```sh
npm install
npx qiita login          # 各自のQiitaトークンでログイン（初回のみ）
npm run article:preview  # http://localhost:8888 でプレビュー
```

**投稿にはリポジトリのSecretsへ `QIITA_TOKEN` の登録が必要です。** トークンの権限は `read_qiita` と `write_qiita`。

記事のfront matterが `ignorePublish: true` の間は投稿されません。公開の準備ができたら `false` に変えてmainへマージします。

APIキーなどは各自のローカル環境または利用サービスのSecretsへ設定します。必要な変数名と用途だけを `.env.example` に追加してください。
