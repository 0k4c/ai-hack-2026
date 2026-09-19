# AI HACK 2026

2026年9月19日開始のハッカソンに向けた、3人チームの共同開発リポジトリです。

- リポジトリ: https://github.com/0k4c/ai-hack-2026 （現在Private。**提出時はpublic、またはGoogleDriveでソース提出**。判断は [公式条件のまとめ](docs/event-brief.md) を参照）
- 管理者: @0k4c
- メンバー: @Murakami-1124、@tomoyan2312（2026-09-18に招待を承諾）
- テーマ: 業務を自律化するAIエージェント（2026-09-19確定）
- 技術スタック: 未決定。モデルはOrcaRouter（OpenAI SDK互換）を利用する前提

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

現時点では共同開発の土台のみで、アプリ本体・起動コマンド・テスト・CIはまだありません。技術スタック決定時に、ランタイムのバージョン、依存関係のロックファイル、インストール・起動・テスト手順をこのREADMEに追記します。

APIキーなどは各自のローカル環境または利用サービスのSecretsへ設定します。必要な変数名と用途だけを `.env.example` に追加してください。
