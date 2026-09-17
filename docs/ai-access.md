# PrivateリポジトリとAIの接続

このリポジトリはPrivateのまま使用する。「すべてのAIを許可する」というGitHub共通設定はなく、ローカル利用とサービス連携で接続方法が異なる。

## ローカルのCodex・Claude Code

各メンバーがGitHubの招待を承諾し、自分の認証でcloneする。そのフォルダをCodexアプリ／CLIやClaude Codeで開くと、ローカルのコードを扱える。pushやPR作成には、実行する環境で本人のGitHub認証と書き込み権限が必要。

各AIへ「AGENTS.mdに従って、このリポジトリの構成を説明して」と依頼し、読み取りを確認する。Claude CodeはCLAUDE.mdからAGENTS.mdを読み込む。これらのファイルはGitHubの認可設定ではない。

## Codexクラウド

1. 自分のChatGPTアカウントで [Codex](https://chatgpt.com/codex) にログインする。
2. GitHubを接続し、`0k4c/ai-hack-2026` を利用対象にする。
3. このリポジトリのクラウド環境を作成・選択する。依存関係と起動手順は技術スタック決定後に設定する。
4. READMEの要約など、読み取りタスクで接続を確認する。

2026-09-17時点で、管理者0k4cのOpenAI GitHub連携は全リポジトリを対象にする既存設定だった。各メンバーのChatGPTとGitHubの接続・環境選択はそれぞれ必要。

## Claude Codeクラウド

1. 自分のClaudeアカウントで [Claude Code](https://claude.ai/code) を開く。
2. GitHub連携を設定する。Claude GitHub Appの導入が必要な場合は、所有者0k4cが対象を `ai-hack-2026` に限定して許可する。
3. 対象リポジトリとクラウド環境を選び、READMEの読み取りを確認する。

Claude側のGitHub App導入・リポジトリ許可は、この初期セットアップでは未確認。ローカルのClaude Codeは、GitHub Appを導入しなくてもcloneしたコードで作業できる。

## 3人それぞれの接続確認

- 招待を承諾し、cloneできる。
- 作業ブランチをpushし、Draft PRを作成できる。
- 利用するAIがREADMEとAGENTS.mdを読める。
- クラウド利用者は、クラウドからブランチを作成・pushできる。

認証トークンやAPIキーをリポジトリ・Issue・PRに貼らない。個人のログイン情報は共有しない。

## 公式資料

- [Codexクラウドの接続と環境作成](https://learn.chatgpt.com/docs/cloud)
- [CodexのAGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Claude CodeクラウドのGitHub接続](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Claude CodeのCLAUDE.mdとAGENTS.md読み込み](https://code.claude.com/docs/en/memory)
