# 共同開発の進め方

2人で同時に進める場合は、[担当ファイル・開始手順・AIへの依頼文](docs/team-playbook.md#2人で並行作業するとき2026-09-20)を確認してください。

**作業ごとに必ずPRを作成します。同じ作業の修正は既存PRを更新し、別作業は別PRにします。**

## 1. 作業範囲を決める

Issueに目的、担当者、完了条件、変更予定のファイルを書く。3人の担当領域は技術スタックを決めてから分担する。共通設定・依存関係の変更は担当者を1人決める。

## 2. 作業ブランチを作る

作業ツリーに未保存・未コミットの変更がないことを確認してから実行する。

```sh
git switch main
git pull --ff-only
git switch -c feat/your-name-task
```

Codexでは `codex/your-name-task` を使える。同じPCで複数のAIを動かす場合は、別worktreeを使う。

```sh
git worktree add ../ai-hack-task -b codex/your-name-task main
```

## 3. 小さい単位で共有する

```sh
git status
git diff
git add path/to/changed-file
git diff --cached
git commit -m "feat: 変更内容"
git push -u origin HEAD
gh pr create --draft
```

`path/to/changed-file` は実際の対象ファイルに置き換える。PRテンプレートに確認方法と結果を書く。作業が終わったらDraftを解除し、他の1人にレビューを依頼する。

## 4. 統合する

レビュー後にSquash mergeする。マージ後は `git switch main` と `git pull --ff-only` で更新する。競合は変更した担当者が内容を確認して解消する。

「別メンバーのレビュー」はチーム運用ルール。GitHub側のブランチ保護による強制設定は現時点では未設定。
