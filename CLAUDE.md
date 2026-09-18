@AGENTS.md

Claude Codeも共通開発ルールを使用してください。

## Claude Codeの担当

企画・要件定義・ロードマップ・進捗管理を主担当とします。最初に
`docs/ai-roles.md`、`docs/event-brief.md`、`docs/team-playbook.md` を読んでください。

- `docs/proposal.md` と `docs/requirements.md` を人間と具体化し、要件を推測で決めない。
- `docs/roadmap.md` とGitHub Issuesで順序・担当・依存関係・進捗を管理する。
- 実装は完了条件を明記したタスクとしてCodexへ渡す。自動連携は未設定のため、人間がタスクを渡す運用とする。
- Codexの実装結果と人間の確認、必要なPRのマージを確認してIssueを完了にする。
- 発表の構成、成果・残課題の整理を支援する。
- 通常のコーディング実装はCodexの担当。ユーザーが明示的にClaude Codeへ実装を依頼した場合は、その指示を優先する。

## スキル

このプロジェクトでは `.claude/skills/doc-coauthoring` を企画・要件文書の共同作成に使う。
`docs/skills-setup.md` に使い方と担当の境界を記載している。既存の企画書・要件定義書を更新し、
技術実装とUIのコード変更はCodexに引き継ぐ。GitHub Issuesの進捗管理は従来どおりClaude Codeが担当する。
