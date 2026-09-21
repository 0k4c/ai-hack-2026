# AI HACK 2026

2026年9月19日開始のハッカソンに向けた、3人チームの共同開発リポジトリです。

- リポジトリ: https://github.com/0k4c/ai-hack-2026 （現在Private。**提出時はpublic、またはGoogleDriveでソース提出**。判断は [公式条件のまとめ](docs/event-brief.md) を参照）
- 管理者: @0k4c
- メンバー: @Murakami-1124、@tomoyan2312（2026-09-18に招待を承諾）
- テーマ: 業務を自律化するAIエージェント（2026-09-19確定）
- 現在の実装: Node.js CLIで代打候補の選定・希望文の解釈・最大3巡の代打手配を行い、ローカル画面で判断と記録を確認。承認はこのPCのJSONに保存するデモ

## 作るサービスと現在地

**メインは、ユーザーフレンドリーなAIシフト管理サービスです。** 管理者が従業員・対象期間・必要人数・勤務条件を設定し、勤務希望を取り込み、AIの支援でシフト案を作り、画面で確認・修正・確定する流れを中心にします。確定後の欠勤には代打手配で対応します。

現在は欠勤対応の部品と記録・承認画面が先行した試作段階です。勤務予定の手動追加・承認済み代打の取り込み・勤怠提出と承認・基本給の給与明細をローカル管理画面に追加しました。**希望からの期間全体の自動作成、条件設定、オンラインの本人確認・共有保存は未実装**です。紙のシフト表の写真読み込みと、可能なら画像出力という要望も維持します。対応形式・提出までの実装範囲は未確定です。

[企画概要](docs/proposal.md) → [要件定義](docs/requirements.md) → [ロードマップ](docs/roadmap.md) の順に確認してください。主目的は [Issue #11](https://github.com/0k4c/ai-hack-2026/issues/11)、担当とファイルの境界は [共同作業の分担](docs/parallel-work.md) と [Issue #23](https://github.com/0k4c/ai-hack-2026/issues/23) で共有します。以下の実行手順は、現在実装されている欠勤対応・希望解釈・比較機能のものです。

## 何を見るか

| 知りたいこと | 見る資料 |
| --- | --- |
| Claude CodeとCodexの担当・引き継ぎ | [AIの役割](docs/ai-roles.md) |
| 導入したスキル・使い分け | [スキル構成と使い方](docs/skills-setup.md) |
| 前回作品の記事と参考にする設計 | [前回作品の参照メモ](docs/previous-projects.md) |
| どんな案があるか・どう選ぶか | [制作案の候補](docs/idea-candidates.md) |
| なぜ作るか・誰に役立つか | [企画概要](docs/proposal.md)（主目的・利用の流れ・現在地） |
| 何を作り、何を作らないか | [要件定義](docs/requirements.md)（中心機能と詳細未確定事項） |
| いつまでに何を終えるか | [ロードマップ](docs/roadmap.md)（提出は9/22 15:00） |
| 提出直前に何を確認するか | [提出直前チェックリスト](docs/submission-checklist.md) |
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

代打候補の選定、希望文の解釈、返事に応じた最大3巡の代打手配、記録を表示する画面、ローカルデモの承認、モデル比較を実装しています。打診は `dryrun`（未送信）で、返事は架空のJSONから読み込みます。勤務表・勤怠・給与明細はローカルの管理画面で扱えます。外部への送信や本番の給与振込は行いません。

### 技術スタックの提案と今回の採用範囲

| 用途 | 採用 | 理由 |
| --- | --- | --- |
| 実行環境・言語 | Node.js 24系、JavaScript ES Modules | 3人の導入済み環境を使い、コンパイル不要で実行できる |
| AI連携 | Node.js標準fetch → OrcaRouterのChat Completions API | 候補選定と文の解釈を呼び出し、再打診と停止条件はコードで制御する |
| 保存 | 処理ごとのJSONと別ファイルの承認記録 | 元文・判断・利用情報を確認でき、承認時も元の手配記録を保持する |
| 画面 | 素のHTML / CSS / JavaScript、Node.jsのローカルHTTPサーバー | 保存した手配記録の表示とローカルデモの承認を行う |
| 検証 | node:test、node:assert | 追加パッケージなしで入力・応答・通信失敗・保存を確認できる |

Node.js 22.22.1以上で実行できます（実行確認: v24.8.0 / npm 11.19.0）。アプリのCLI・表示サーバー・テストに `npm install` は不要です。Qiita記事のプレビューだけ依存パッケージのインストールが必要です。`public/` はQiita記事専用、処理は `src/`、画面は `app/`、架空データは `data/` に配置します。

参考: [Node.js fetch](https://nodejs.org/docs/latest-v24.x/api/globals.html#fetch)、[OrcaRouter HTTP API](https://docs.orcarouter.ai/native-formats/openai-compat)。

### 新しくcloneして起動する

GitHubへのアクセス権とNode.js **22.22.1以上**を用意し、次を実行します。以降のコマンドはすべてcloneしたリポジトリの直下で実行してください。

```sh
git clone https://github.com/0k4c/ai-hack-2026.git
cd ai-hack-2026
node --version
npm --version
```

PowerShellでは `Copy-Item .env.example .env`、macOS / Linuxでは `cp .env.example .env` で設定ファイルを作ります。既存の `.env` は上書きせず使ってください。実APIを使うときは、自分のエディタで `.env` の `ORCAROUTER_API_KEY` を設定します。`ORCAROUTER_MODEL` は空なら `orcarouter/auto`、設定済みNamed Routerを使うなら `orcarouter/<名前>` です。キーは引数・チャット・Gitに含めません。

まずキー・外部通信なしで確認できます。

```sh
npm test
node src/compare-models.mjs --plan
node app/serve.mjs
```

最後のコマンドを起動したまま `http://127.0.0.1:4173` を開き、「架空サンプルを見る」を選びます。終了はターミナルで `Ctrl+C`。実手配の確認は、次の `npm run arrange` で作った記録を画面の一覧から選びます。

### 代打手配：選定から最大3巡まで

`.env` にキーを設定してから実行します。**実APIを呼び出すため利用料が発生します。** 1件あたり初回選定1回＋返事解釈最大3回です。

```sh
npm run arrange

# 日付・返事・保存先を指定する場合。日付は当日以降に置き換える
npm run arrange -- --date 2026-09-21 --replies data/replies.example.json --output output/arrangements
```

既定は日本時間の翌日18:00〜22:00、e1の欠勤です。`data/replies.example.json` はe2の辞退とe3の受諾を含む架空の返事です。選ばれる順序や判断はモデルによって変わります。`--absent`、`--start`、`--end` も指定でき、詳細は `npm run arrange -- --help` で確認できます。

`output/arrangements/<64桁の処理ID>.json` に、候補の除外理由・各巡の返事と判断・モデル・トークン・概算費用を保存します。同じ欠員（日付・時間・欠勤者）を同じ保存先で再実行すると、保存済みの記録を返し、API呼び出しと再打診を行いません。比較目的などで再計測するときは、記録を残して別の `--output` を使います（新たに課金されます）。

| 表示・記録 | 意味 |
| --- | --- |
| `status: "filled"` / `approvalStatus: "pending"` | 全時間を受諾した人が見つかり、**店長の承認待ち**。勤務確定ではない |
| `status: "escalated"` | 3巡上限・返事なし・部分受諾などで止まり、店長の判断が必要 |
| `status: "failed"` / `"pending"` | API等の失敗／処理途中。終了コード1。記録を確認する |
| `channel: "dryrun"` / `delivered: false` | 打診文を記録しただけで、**未送信** |
| モデル・トークン・費用の `null` | **不明**。0トークン・0円ではない |

最大3巡、API1回最大60秒、全体最大180秒で停止します。途中の `pending` が残っても自動再開しません。元記録とサービスの利用状況を確認してください。希望文と同様に氏名をIDへ置換してAPIへ送りますが、元の返事はローカルJSONに残るため、架空データを使います。

### 承認：このPCだけに保存するデモ

**暫定の制約（[Issue #34](https://github.com/0k4c/ai-hack-2026/issues/34)）：CLIと画面は承認記録を共有しません。** 同じ手配を両方から承認すると二重に保存できます。解消までは、1件の手配に使う承認経路をCLIか画面のどちらかに固定してください。片方の承認結果はもう片方に表示されません。

CLIでは、手配コマンドが表示したファイル名の64桁部分を処理IDとして使います。以下の `<ID>` と `<HASH>` は実際の値に置き換えます。

```sh
# 内容とrecordHashを表示。保存はしない（APIキー不要）
npm run approve -- --process <ID>

# 表示内容を確認後、表示されたrecordHashで明示的に承認する
npm run approve -- --process <ID> --expected-hash <HASH> --confirm
```

手配時に保存先を変えた場合は、どちらのコマンドにも `--records <手配の保存先>` を加えます。全時間を受諾した承認待ちの手配が対象で、表示後に記録が変わると承認を拒否します。同じCLI経路での再承認は保存済みの結果を返します。

| 経路 | 現在の承認保存先 | 制約 |
| --- | --- | --- |
| CLI | `<手配の保存先>/approvals/<ID>.json` | 過去日の拒否・別の承認済み勤務を含めた再判定は未対応 |
| 画面 | `<手配の保存先>/_approvals/<ID>.json` | 過去日を拒否。同じ保存先の画面側承認を加えて勤務条件を再判定 |

元の手配JSONは書き換えず、承認だけを別JSONに保存します。**承認済みでも、このPC上のデモの記録です。** 本番の勤務表・給与・勤怠システムは更新しません。CLIと画面のハッシュ・承認JSONの形式も異なるため、承認ファイルを移動して共用しないでください。画面の `_approvals/.lock` が中断で残った場合は処理中として停止するので、他の承認処理と保存状態を確認してください。

### 判断が見える画面

```sh
node app/serve.mjs

# 別ポート・別の手配記録フォルダを使う場合
node app/serve.mjs --port 4174 --records output/arrangements
```

既定URLは `http://127.0.0.1:4173`、既定の記録フォルダは `output/arrangements` です。画面上部の一覧から記録を選ぶと、除外理由、打診と返事、AIが選んだ行動、巡数、実モデル、トークン、概算費用が表示されます。記録を追加したら「一覧を更新」を押してください。画面から欠員入力・手配実行はできません。

「架空サンプルを見る」と「JSONファイルを開く」は表示用で、承認を保存できません。画面から承認する場合は、サーバーの記録一覧から対象を開き、内容を確認して承認ボタンを押します。保存後は同じ画面から開き直して承認済み表示を確認できます。CLIから承認した記録との共用は、前節の #34 の制約があります。

サーバーは `127.0.0.1` のみに接続を受け付けます。Host・Originの検証を通らない要求は403となり、承認の書き込みには同一Originとセッショントークンが必要です。ログインや店長本人の認証は未実装です。

### モデル比較

```sh
# 通信なしで入力・モデル・予定回数を確認
node src/compare-models.mjs --plan

# 実API：3モデル × 各3回 × 2機能 = 18回（利用料が発生）
node --env-file-if-exists=.env src/compare-models.mjs

# 人が品質を確認してConsoleでNamed Routerを設定した後
# .envのORCAROUTER_MODEL=orcarouter/<名前>を使う。6回（利用料が発生）
node --env-file-if-exists=.env src/compare-models.mjs --configured
```

比較対象は `auto` / `free` / `google/gemini-2.5-flash`、入力は2026-09-21の架空データに固定しています。現在日付の手配には置き換えません。`--models ID,ID`、`--repeats 1〜3` で範囲を絞れます。JSONと表は `output/selections/model-comparisons/<UUID>.json` / `.md` に保存されます。

失敗を含むと終了コード1で `completed_with_errors` になります。2026-09-20の既存18回の実測では、autoは6/6形式検証成功、freeは6/6 HTTP 429、Gemini直接指定は2/6形式検証成功でした。形式検証は品質の採点ではなく、**所見は人が記入します。** freeの成功時の費用と速度は未測定で、0円とは扱いません。実測条件・全試行・人が確認する回答は [モデル比較の記録](docs/model-comparison.md) を参照してください。Named Router設定・切り替え後の実測・Fallback発動の確認は #17 の残作業です。

### テストと自動実行の範囲

```sh
npm test
# 同じテストを直接実行
node --test
```

通信を模擬し、候補選定・希望文解釈・3巡の手配・承認・画面のHTTP処理・モデル比較を確認します。キーや実APIは不要です。Windowsではシンボリックリンク拒否の1件が権限依存のためスキップされます。CLIと画面をまたぐ二重承認の不具合 #34 は、現状のテストでは検出できません。

lint・buildコマンドは未導入です。GitHub Actionsは `.github/workflows/publish.yml` のQiita投稿のみで、**テストの自動実行はありません**。マージ前に手元でテストを実行してください。

2026-09-20、新規clone・Windows / Node.js v24.8.0 / npm 11.19.0で以下を確認しました。コマンドと詳しい結果は [PR #37](https://github.com/0k4c/ai-hack-2026/pull/37) に記録しています。

| 確認 | 結果 |
| --- | --- |
| `npm test`（依存パッケージ未インストール） | 112件成功・失敗0件・Windowsのsymlink検証1件スキップ |
| 比較の `--plan` | キーなしで固定入力と18回の計画を表示。実APIの比較は再実行していない |
| `npm run arrange`（実API） | 選定後、返事の応答がJSONでなく `failed` / `invalid_interpretation` で停止。2呼び出し・1,741トークン・概算0.000272 USD・22,079 ms。再実行では記録を変更しなかった |
| CLI・画面の承認 | 通信モックで生成した別々の受諾記録を使い、確認・保存・再読込を検証。実APIによる受諾成功の確認とは区別する |
| ブラウザとHTTP | 架空サンプルの承認不可、未送信・費用不明の表示、画面承認の永続化、Host / Origin不正時の403を確認 |

この実API検証では承認待ちまで到達していません。失敗した応答の生本文は保存しておらず、JSONにならなかった原因は未特定です。起動手順の確認と、毎回のAI応答の成功は別に扱ってください。

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


### 勤務表・勤怠・給与明細（ローカル管理者デモ）

```sh
node app/serve.mjs --port 4173 --records output/arrangements
```

`http://127.0.0.1:4173/workforce`、または記録画面の「勤務表・勤怠・給与」から開きます。追加インストール・APIキーは不要です。

1. 「勤務予定を追加する」で氏名・日付・開始・終了を保存。承認済みの欠勤対応も日時で選んで勤務表へ取り込めます。取り込みは元の承認記録・ハッシュを再検証し、重複は拒否します。
2. 「メンバーの時給」で時給を設定。設定済みでも承認済み勤怠の時給は変わりません。
3. 勤務後、「勤怠」で実際の出退勤と休憩を提出。予定から実績を自動生成しません。未終了の勤務、重複、逆転した時間、過大な休憩は拒否します。日本時間・同日内の勤務が対象です。
4. 時間と表示された時給を確認して承認。明細を作る前なら承認を取り消し、勤怠を取り下げて再入力できます。取り下げ前の内容は修正履歴に残します。
5. 対象者・月で給与を集計し、入力漏れと未承認分がないことを確認して明細を作成。時給×承認済みの実働分数÷60を月単位で合計し、1円未満を最後に切り上げます。明細と対象勤怠の時給・時間は固定し、同一メンバー・月の再作成や追加・変更を拒否します。対象月の勤務がすべて終わってから作成してください。
6. 作成済み明細は画面表示とブラウザの印刷・PDF保存ができます。**基本給の集計**であり、残業・深夜・休日の割増、手当、税金・社会保険の控除・給与振込は含みません。

保存先は `<records>/workforce/<organization>/state.json`。一時ファイルからの置換、保存ロック、リビジョン照合により古い画面・同時保存を拒否します。異常終了で `.lock` が残った場合は、自動削除せず、起動中の保存処理がないことと保存内容を確認して復旧してください。作成済み明細の訂正・取消は未実装です。

団体を分けてローカル検証する場合は、別の記録ディレクトリとポートで起動してください（例：`--organization shop-b --records output/arrangements/shop-b --port 4174`）。団体名は起動時に固定し、クライアントから他団体を指定して操作するAPIはありません。既存の団体情報なしの架空代打記録は `demo` 団体だけに取り込めます。**本人確認・ログイン・従業員別の権限制御・共有DBは未実装**で、この起動方法は本番の複数団体向けサービス公開方法ではありません。localhostに限定した架空6人の管理者デモです。

確認：`node --test`。勤務予定から給与までの保存、未承認除外、端数、時給の固定、同時保存、団体ごとの分離、HTTPのOrigin・操作トークンを検証します。フォームのラベル・フォーカス・色だけに頼らない状態を採用し、デジタル庁デザインシステムとMaterial Design 3を参考にしています。アクセシビリティ準拠全体を検証したものではありません。
