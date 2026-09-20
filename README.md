# AI HACK 2026

2026年9月19日開始のハッカソンに向けた、3人チームの共同開発リポジトリです。

- リポジトリ: https://github.com/0k4c/ai-hack-2026 （現在Private。**提出時はpublic、またはGoogleDriveでソース提出**。判断は [公式条件のまとめ](docs/event-brief.md) を参照）
- 管理者: @0k4c
- メンバー: @Murakami-1124、@tomoyan2312（2026-09-18に招待を承諾）
- テーマ: 業務を自律化するAIエージェント（2026-09-19確定）
- 最初の実装: Node.js CLI＋OrcaRouter（OpenAI互換HTTP API）＋JSONファイル保存

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

1人分の希望文1件をAIに解釈させ、あいまい箇所と実行情報をJSONに記録するCLIがあります。今回の範囲は希望文の解釈までです。聞き返しの送信、返信の取得、ループ、シフト表作成、勤務確定、画面は未実装です。

### 技術スタックの提案と今回の採用範囲

| 用途 | 採用 | 理由 |
| --- | --- | --- |
| 実行環境・言語 | Node.js 24系、JavaScript ES Modules | 3人の導入済み環境を使い、コンパイル不要で実行できる |
| AI連携 | Node.js標準fetch → OrcaRouterのChat Completions API | 今回はAPI呼び出し1回だけなのでSDKやエージェントフレームワークの追加が不要 |
| 保存 | 1実行1JSONファイル | 元文・解釈・あいまい理由・利用情報をそのまま確認できる |
| 検証 | node:test、node:assert | 追加パッケージなしで入力・応答・通信失敗・保存を確認できる |

Node.js 22.22.1以上で実行できます（実行確認: v24.8.0 / npm 11.19.0）。今回のCLIとテストに `npm install` は不要です。画面やDBの導入は、その担当タスクが決まった段階で検討します。`public/` は引き続きQiita記事専用とし、実装は `src/`、架空データは `data/` に配置します。

参考: [Node.js fetch](https://nodejs.org/docs/latest-v24.x/api/globals.html#fetch)、[OrcaRouter HTTP API](https://docs.orcarouter.ai/native-formats/openai-compat)。

### 起動・入力

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

このPCの専用worktreeから、既に設定されたリポジトリ直下のキーを使う場合は `node --env-file=../../.env src/cli.mjs` で実行できます。キーのコピーは不要です。

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
