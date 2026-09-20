# AI HACK 2026

2026年9月19日開始のハッカソンに向けた、3人チームの共同開発リポジトリです。

- リポジトリ: https://github.com/0k4c/ai-hack-2026 （現在Private。**提出時はpublic、またはGoogleDriveでソース提出**。判断は [公式条件のまとめ](docs/event-brief.md) を参照）
- 管理者: @0k4c
- メンバー: @Murakami-1124、@tomoyan2312（2026-09-18に招待を承諾）
- テーマ: 業務を自律化するAIエージェント（2026-09-19確定）
- 最初の実装: Node.js CLI。モデル選定はOrcaRouterのOpenAI互換HTTP APIを利用

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

代打候補を1人選び、理由と実行情報をJSONに残すCLIがあります。打診送信・勤務確定・画面・再打診ループは未実装です。

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
