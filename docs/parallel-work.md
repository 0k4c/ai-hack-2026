# 残作業の分担（2026-09-21更新）

**主目的はユーザーフレンドリーなAIシフト管理サービスです。** [Issue #11](https://github.com/0k4c/ai-hack-2026/issues/11) に従い、希望の取り込み・シフト案作成・画面での修正と確定を中心にします。代打手配は確定後の欠勤対応です。

全体の窓口は [Issue #23](https://github.com/0k4c/ai-hack-2026/issues/23)。今回の文書反映はユーザーの明示依頼によりMurakami＋Codexが担当し、企画・要件・ロードマップ・本書・README・記事を同一PRで更新します。以下の既存担当を新しい中心機能の担当決定とは扱いません。新機能の分担は概要レビューと実装Issueの具体化後に決めます。

## 既存機能・提出準備の担当

| 担当 | 範囲 | 次の作業・完了条件 |
| --- | --- | --- |
| @Murakami-1124 ＋ Codex（処理） | [#32 承認保存](https://github.com/0k4c/ai-hack-2026/issues/32)、共有コード | PR #33で実装はマージ済み。#34の保存先・検証の一本化は画面担当と境界を合意し、主担当1人を決めて進める |
| @tomoyan2312 ＋ Codex（画面） | [#18](https://github.com/0k4c/ai-hack-2026/issues/18) / [PR #29](https://github.com/0k4c/ai-hack-2026/pull/29)、app/ | PR #29で実装はマージ済み。#34の修正担当と共有処理の接続を調整し、CLIとの双方向の承認・再読込・エラー表示を確認する |
| @0k4c（品質・設定） | [#17](https://github.com/0k4c/ai-hack-2026/issues/17) / [PR #31](https://github.com/0k4c/ai-hack-2026/pull/31) | docs/model-comparison.mdの8回答を人が評価し、ConsoleでAllowed Models / Strategy / Fallbackを設定。設定名を共有（キーは共有しない） |
| @Murakami-1124 ＋ Codex（比較の続き） | #17（PR #31はマージ済み） | 設定名の引き継ぎ後、ORCAROUTER_MODELで切り替えて6回計測。初回18回と比較し、Fallback未観測は未観測と記録する |
| @0k4c ＋ Claude Code（提出） | [#16](https://github.com/0k4c/ai-hack-2026/issues/16)、記事・README・進捗資料 | #21/#31の数値、画面画像、制約を反映。READMEの起動手順はPR #37で統合済み。新機能の実装後は手順を追記。最終確認・記事公開・提出は人が行う |

人の最終確認は、画面をtomoyan2312が発表環境で確認し、別メンバーが起動手順を再現します。0k4cはモデル品質と提出内容、Murakamiは処理・保存のテスト結果を確認します。レビュー・マージ・Issueを閉じる判断は人が行います。

## 現在地と依存

- 欠勤対応のPR #21、画面のPR #29、モデル比較のPR #31、承認保存のPR #33はmainへマージ済み。Issueの完了判定とは区別します。
- [#34](https://github.com/0k4c/ai-hack-2026/issues/34) では、CLIの `approvals/` と画面の `_approvals/` が別で、同じ手配を二重承認できる問題が残っています。共有ファイルを同時編集しないよう担当を合意します。
- PR #31の初回18回はauto 6/6形式検証成功、free 6/6 HTTP 429、Gemini 2/6成功。形式の検証であり、人の品質評価・Console設定・設定後の再計測は残っています。
- `npm run web` / `npm run compare` と起動手順はmainにあります。PR #37の検証では実AI手配が不正な解釈で停止した記録もあり、成功例と混同しません。
- 新しい中心機能 S1〜S3 は、[要件定義](requirements.md) の詳細未確定事項と入出力を決めてから実装Issueに分けます。既存の代打手配のJSON契約だけでは、シフト表全体を表現する契約は足りません。

## 編集するファイル

| ファイル | 所有者 |
| --- | --- |
| src/approve-arrangement.mjs、src/cli-approve.mjs、test/approval.test.mjs | Murakami（#32） |
| src/run-arrangement.mjs、共通HTTP・制約・シード・希望文処理、package.json、package-lock.json、.env.example、.gitignore | Murakami。ほかの担当はimportのみ |
| app/配下（HTTP入口・表示・画面テスト） | tomoyan2312（#18） |
| src/compare-models.mjs、test/compare-models.test.mjs、docs/model-comparison.md | 当面Murakami（#17の比較の続きは新規PR）。0k4cは所見・設定名をIssueへ渡す |
| README.md、public/ai-hack-2026-agent.md | 原則0k4c／記事担当。今回の主目的の反映はMurakami＋Codex。実装担当はPR本文に手順・数値を残す |
| docs/配下の企画・進捗文書 | 原則Claude Code。今回の分担更新はユーザーの明示依頼に基づきCodexが実施 |

## 既存の承認保存と画面を接続する目標

**以下はPR #33側の接続契約です。現在の画面は別実装であり、共通化済みではありません。#34で保存先・ハッシュ・判定を統一する際に、双方の検証条件を確認して更新します。**

入出力と完了条件の正本は [#32](https://github.com/0k4c/ai-hack-2026/issues/32) です。元の手配JSON契約v1は変更せず、承認を別ファイルに保存します。

- inspectArrangement({ recordsDir, processId })で表示時のハッシュと保存済み承認を取得します。
- ボタンを人が押したときだけapproveArrangement({ recordsDir, processId, expectedRecordHash })を呼びます。recordsDirはサーバー側で固定し、リクエスト本文から受け取りません。
- 保存結果のstatus: approvedとmode: local_demoを確認して「承認済み（ローカルデモ）」と表示します。元のstatus: filledだけを見て承認済みとしません。
- 承認はrecordsDir/approvals/<processId>.json。元記録のSHA-256に結び付け、二重承認は保存済みの同じ結果を返します。元記録が変更されたら再確認が必要です。
- 架空サンプル・ブラウザで開いただけのJSONは保存対象にしません。サーバー側に保存された検証可能な記録だけが対象です。
- 画面担当は既存のlocalhost / Host / Origin制限を維持し、書き込みをPOSTに限定します。AIの返事やGETアクセスを承認操作にしません。
- 外部への打診はdryrunのままです。本番の勤務表更新、店長本人の認証、異なる欠員をまたぐ割当の競合管理はこのローカルデモに含みません。

## 中心機能の分担を決める手順

1. [企画概要](proposal.md) をユーザーが確認し、対象期間・勤務枠・必要人数・提出範囲を具体化する。
2. 0k4c＋Claude Codeを窓口に、S1〜S3の目的・入出力・完了条件・依存関係を実装Issueへ分解する。人が担当とファイル境界を確認する。
3. 処理・画面の共有データを合意し、別ブランチ・別worktreeで実装する。新しい作業は別PRにする。

写真読み込みと、可能なら画像出力も要望として維持します。シフト表全体の作成はサービスの中心機能です。以前の「代打手配を優先し、シフト作成は後回し」という扱いは取り消します。未実装の機能を既存担当へ自動で追加せず、実装Issueで作業範囲を共有します。

## 保存と引き継ぎ

別PCは各自のclone、同じPCの別セッションは別worktreeを使います。他人の未コミット変更を触りません。PRの差分と引き継ぎを読んでから再開してください。

各PR本文には「できたこと」「途中のこと」「次にやること」「詰まっていること」を残します。全体を完了とするには、実装だけでなく、動作確認、必要なマージ、記事・READMEへの反映、残作業の確認が必要です。
