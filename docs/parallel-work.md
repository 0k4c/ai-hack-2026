# 3人で並行作業するとき（2026-09-20）

Codexを3つ並行で動かすための、9/20〜9/21限定の作業分担です。チーム全体の3人の役割は [3人での進め方](team-playbook.md) の表を維持します。
最新の担当と状態は各Issueを正とします。全体の一覧は [Issue #23](https://github.com/0k4c/ai-hack-2026/issues/23) にあります。

この文書は、[PR #22](https://github.com/0k4c/ai-hack-2026/pull/22)（@Murakami-1124 作の2人用の分担）と Issue #23（3人用の分担）を統合したものです。

## 分担

| 役割 | 人 | 担当Issue | ブランチ |
| --- | --- | --- | --- |
| **処理担当** | @Murakami-1124 | [#15 返事の解釈と3巡の手配](https://github.com/0k4c/ai-hack-2026/issues/15) | `codex/murakami-reply-agent`（[PR #21](https://github.com/0k4c/ai-hack-2026/pull/21) の続き） |
| **画面担当** | @tomoyan2312 | [#18 判断が見える1枚の画面](https://github.com/0k4c/ai-hack-2026/issues/18) | `codex/tomoyan2312-arrangement-view` |
| **比較担当** | @0k4c | [#17 モデル比較とNamed Router](https://github.com/0k4c/ai-hack-2026/issues/17) | `codex/0k4c-model-comparison` |

[#16 Qiita記事](https://github.com/0k4c/ai-hack-2026/issues/16) にはCodexを割り当てません。**記事は提出必須で、画面は任意**です。優先度が逆転しないよう、記事はClaude Codeが下書きし（[PR #25](https://github.com/0k4c/ai-hack-2026/pull/25) でmainへ反映済み）、3人が数値と所見を足します。

## 画面を待たせない理由

Issue #18 には当初「#15完了後に着手する」と書いていましたが、**この条件は外しました。** 3人が並行するのに1人が待機するのを避けるためです。

代わりに、出力JSONの形を **[Issue #23](https://github.com/0k4c/ai-hack-2026/issues/23) の「出力JSON契約 v1」** として書き出しました。画面担当はこれを見て先に作ります。

ただし **正本はマージされた #15 の実装**であって、PR #21 の途中版ではありません。次の2点を守ります。

- **処理担当**：契約のフィールドを**削除・改名する場合は、マージ前に #23 へコメントする。** 追加は連絡不要（画面は知らないキーを無視する）
- **画面担当**：#15 がmainへ入ったら、**実データで1回通して確認**してからマージする

## 担当ファイル

同時編集を避けるための境界です。**`package.json` と `README.md` が唯一の衝突源**なので、所有者を1人に固定します。

| ファイル | 所有者 | 他の担当の扱い |
| --- | --- | --- |
| `src/run-arrangement.mjs` `src/notify.mjs` `src/cli-arrange.mjs` `test/arrangement.test.mjs` `data/replies.example.json` | 処理担当 | 触らない |
| `src/orcarouter.mjs` `src/preferences.mjs` `src/constraints.mjs` `src/seed.mjs` `data/employees*.json` `.env.example` `.gitignore` | **処理担当へ集約** | **公開関数を import して使う。変更しない** |
| `package.json` `package-lock.json` | **処理担当のみ** | 触らない。起動は `node <パス>` で直接書き、npmスクリプトは統合時にまとめて追加する |
| `README.md` | **@0k4c（人間）のみ** | 触らない。**起動手順と制約はPR本文に書く。** 9/22 10:00に一括反映する |
| `app/` 配下 | 画面担当 | 触らない。表示サーバーが必要なら `app/server.mjs` に置く |
| `src/compare-models.mjs` `docs/model-comparison.md` | 比較担当 | 触らない |
| `public/ai-hack-2026-agent.md` | #16 の担当のみ | 触らない。**比較結果は記事担当へ渡す。** 直接書き換えない |
| `docs/` 配下（この文書を含む） | Claude Code | 触らない |

共通関数の変更が必要になったら、**必要な入出力と理由を自分のIssue・PRに書いて処理担当へ渡します。** 同じ修正を2人で実装しません。

## 画面担当への申し送り

画面に出す値は [Issue #23](https://github.com/0k4c/ai-hack-2026/issues/23) の契約表を見てください。そのうえで、**意味を取り違えると審査で不利になる**のが次の3点です。

- **`status: "filled"` は勤務確定ではなく承認待ち**です。画面でも「確定済み」と表示しません
- **`channel: "dryrun"` / `delivered: false` は未送信**です。送信したように見せません
- **欠損値 `null` は「不明」と表示します。** 0や0円にしません。費用を0と見せると、コストの説明そのものが疑われます

**承認ボタンの先には、まだ確定処理がありません。** 実際の勤務確定につなぐには、保存処理・二重承認の防止・入力条件を処理担当と決める必要があります。現時点では、**画面だけで「確定済み」に変えて完成扱いにしないこと。** この未解決点は #18 のレビューで確認します。

## 別々の作業場所で始める

別PCなら各自のcloneを使います。同じPCで複数のAIセッションを動かすなら、**必ず別worktree**にします。既存フォルダに未コミット変更があれば保持してください。

処理担当は既存のPR #21 のブランチを続けます。**同じブランチを別のAIで同時に動かしません。**

画面担当・比較担当は、自分のcloneのルートか、同じPCのリポジトリルートで次を実行します（Git for WindowsではBashを使用）。ブランチやフォルダが既にある場合は作り直さず、担当と状態を確認してください。

```sh
git fetch origin
git worktree add .worktrees/<作業名> -b codex/<担当者>-<作業内容> origin/main
cd .worktrees/<作業名>
```

## AIへの依頼文

mainへこの文書が入ったあとは、各自のCodexに貼れば始められます。

処理担当（@Murakami-1124）：

```text
AGENTS.md と docs/parallel-work.md を読んでください。
担当はIssue #15です。本文・コメント・PR #21 を確認し、既存の実装を引き継いでください。
まず origin/main を取り込み、失敗しているテスト
「CLIの通常起動で辞退→受諾を最後まで通し、再実行時はAPIを呼ばない」を直してください。
実API検証と、残っている完了条件・レビュー修正を担当してください。
app/ と src/compare-models.mjs は編集しません。共有ファイルは私が担当します。
出力JSONの実物を1件PR本文に貼り、フィールドを削除・改名する場合は
マージ前にIssue #23 へコメントしてください。
同じ作業はPR #21 を更新し、別作業は新しいPRにしてください。
テスト結果と未確認事項を記載し、Issueを閉じたりmainへマージしたりしないでください。
```

画面担当（@tomoyan2312）：

```text
AGENTS.md と docs/parallel-work.md を読んでください。
担当はIssue #18です。別worktree・別ブランチで着手してください。
Issue #23 の「出力JSON契約 v1」を見て、app/ の下に素のHTML1枚を作ります。
フレームワークを入れず、記録JSONを読んで表示するだけにしてください。
開発用の架空サンプルは app/sample-arrangement.json として自分で作ってよいです。
status:"filled" は承認待ち、channel:"dryrun" は未送信、null は「不明」と表示します。
package.json と README.md は編集せず、起動手順はPR本文に書いてください。
毎回PRを作成し、テスト結果と未確認事項を記載してください。
Issueの完了状態やmainは変更しないでください。
```

比較担当（@0k4c）：

```text
AGENTS.md と docs/parallel-work.md を読んでください。
担当はIssue #17です。別worktree・別ブランチで着手してください。
既存の selectWithOrca と requestInterpretation をそのまま import して使い、
src/orcarouter.mjs は変更しないでください。
同じ架空入力で auto / free / 直接指定 を各3回比べ、
実モデル・所要時間・トークン・概算費用を docs/model-comparison.md にまとめてください。
品質の判定は人が書きます。AIに採点させないでください。
APIキーは自分の環境だけで扱い、共有しません。
package.json・README.md・public/ は編集せず、PR本文で引き継いでください。
Named Routerの設定はConsoleでの人間の作業なので、比較と切り替えだけ担当します。
```

## 完了の扱い

同じ作業の修正は同じPRを更新し、別Issue・別作業は新しいPRにします。**相手が差分と操作結果を確認してから、人間がマージします。**

共有ファイルへの反映や記事への転記が終わっていない場合は、そのIssueを完了扱いにしません。
