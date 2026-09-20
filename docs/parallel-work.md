# 残作業の分担（2026-09-20更新）

ユーザーの「残りの作業の分担を決めて、自分の範囲の実装を進めて」という依頼に基づく更新です。以前の3並列の着手指示をこの分担に置き換えます。全体の窓口は [Issue #23](https://github.com/0k4c/ai-hack-2026/issues/23)。同じ作業は既存PRを更新し、新しい作業は別PRにします。

## 担当と完了までの作業

| 担当 | 範囲 | 次の作業・完了条件 |
| --- | --- | --- |
| @Murakami-1124 ＋ Codex（処理） | [#32 承認保存](https://github.com/0k4c/ai-hack-2026/issues/32)、共有コード | 承認可否検証、元記録のハッシュ照合、二重承認防止、ローカル保存、CLI、自動テスト。画面担当へ関数の入出力を渡す |
| @tomoyan2312 ＋ Codex（画面） | [#18](https://github.com/0k4c/ai-hack-2026/issues/18) / [PR #29](https://github.com/0k4c/ai-hack-2026/pull/29)、app/ | 最新mainを取り込み、実手配JSONの表示を確認。#32の関数を使って承認ボタンを接続。二重クリック・再読込・古い表示からの承認・エラー表示をテスト |
| @0k4c（品質・設定） | [#17](https://github.com/0k4c/ai-hack-2026/issues/17) / [PR #31](https://github.com/0k4c/ai-hack-2026/pull/31) | docs/model-comparison.mdの8回答を人が評価し、ConsoleでAllowed Models / Strategy / Fallbackを設定。設定名を共有（キーは共有しない） |
| @Murakami-1124 ＋ Codex（比較の続き） | PR #31 | 設定名の引き継ぎ後、ORCAROUTER_MODELで切り替えて6回計測。初回18回と比較し、Fallback未観測は未観測と記録する |
| @0k4c ＋ Claude Code（提出） | [#16](https://github.com/0k4c/ai-hack-2026/issues/16)、記事・README・進捗資料 | #21/#31の数値、画面画像、制約を反映。起動手順をREADMEへ統合。最終確認・記事公開・提出は人が行う |

人の最終確認は、画面をtomoyan2312が発表環境で確認し、別メンバーが起動手順を再現します。0k4cはモデル品質と提出内容、Murakamiは処理・保存のテスト結果を確認します。レビュー・マージ・Issueを閉じる判断は人が行います。

## 現在地と依存

- #15の処理は [PR #21](https://github.com/0k4c/ai-hack-2026/pull/21) でmainへマージ済み。以前の「#21マージ待ち」は解消済みです。Issueの完了確認と文書の状態更新は残っています。
- PR #29は画面実装と通信モックの結合テスト済み。main取り込み後の確認・承認接続・最終確認を続けます。
- PR #31は初回18回の実測済み。autoは6/6形式検証成功、freeは6/6 HTTP 429、Geminiは2/6成功。品質の採点ではありません。人の品質評価・Console設定が次の依存です。
- #32はPR #21だけに依存します。画面の実装完了を待たずに進められます。
- package.jsonのweb / compareは、それぞれの実装がmainへ入ったあと処理担当が追加します。存在しないファイルを指す起動コマンドをmainへ入れません。

## 編集するファイル

| ファイル | 所有者 |
| --- | --- |
| src/approve-arrangement.mjs、src/cli-approve.mjs、test/approval.test.mjs | Murakami（#32） |
| src/run-arrangement.mjs、共通HTTP・制約・シード・希望文処理、package.json、package-lock.json、.env.example、.gitignore | Murakami。ほかの担当はimportのみ |
| app/配下（HTTP入口・表示・画面テスト） | tomoyan2312（#18） |
| src/compare-models.mjs、test/compare-models.test.mjs、docs/model-comparison.md | 当面Murakami（PR #31の続き）。0k4cは所見・設定名をIssueへ渡す |
| README.md、public/ai-hack-2026-agent.md | 0k4c／記事担当。実装担当はPR本文に手順・数値を残す |
| docs/配下の企画・進捗文書 | 原則Claude Code。今回の分担更新はユーザーの明示依頼に基づきCodexが実施 |

## 承認保存と画面の接続

入出力と完了条件の正本は [#32](https://github.com/0k4c/ai-hack-2026/issues/32) です。元の手配JSON契約v1は変更せず、承認を別ファイルに保存します。

- inspectArrangement({ recordsDir, processId })で表示時のハッシュと保存済み承認を取得します。
- ボタンを人が押したときだけapproveArrangement({ recordsDir, processId, expectedRecordHash })を呼びます。recordsDirはサーバー側で固定し、リクエスト本文から受け取りません。
- 保存結果のstatus: approvedとmode: local_demoを確認して「承認済み（ローカルデモ）」と表示します。元のstatus: filledだけを見て承認済みとしません。
- 承認はrecordsDir/approvals/<processId>.json。元記録のSHA-256に結び付け、二重承認は保存済みの同じ結果を返します。元記録が変更されたら再確認が必要です。
- 架空サンプル・ブラウザで開いただけのJSONは保存対象にしません。サーバー側に保存された検証可能な記録だけが対象です。
- 画面担当は既存のlocalhost / Host / Origin制限を維持し、書き込みをPOSTに限定します。AIの返事やGETアクセスを承認操作にしません。
- 外部への打診はdryrunのままです。本番の勤務表更新、店長本人の認証、異なる欠員をまたぐ割当の競合管理はこのローカルデモに含みません。

## 後回しの要望

[#11](https://github.com/0k4c/ai-hack-2026/issues/11) の写真読み込み・シフト表全体の作成・画像出力は未完了です。現在の代打手配を優先する方針を維持します。要件・採用範囲の整理は0k4c＋Claude Code、実装を開始するときの処理担当はMurakamiとし、具体的な入出力・完了条件を別Issueにしてから着手します。

## 保存と引き継ぎ

別PCは各自のclone、同じPCの別セッションは別worktreeを使います。他人の未コミット変更を触りません。PRの差分と引き継ぎを読んでから再開してください。

各PR本文には「できたこと」「途中のこと」「次にやること」「詰まっていること」を残します。全体を完了とするには、実装だけでなく、動作確認、必要なマージ、記事・READMEへの反映、残作業の確認が必要です。
