# ハッカソン用のスキル構成

2026-09-18に選定。ユーザーの選択により、公式3つ＋コミュニティ製1つの計4つを導入しました。今回は全プロジェクト共通の設定を変えず、このリポジトリ内に配置しています。

## 使う4つ

| スキル | 実行するAI | 役割・使うタイミング | 配置先 |
| --- | --- | --- | --- |
| doc-coauthoring | Claude Code | 企画書・要件定義書を人間と整理するとき | `.claude/skills/doc-coauthoring` |
| frontend-design | Codex | 要件が決まった後、画面を作る・改善するとき | `.agents/skills/frontend-design` |
| playwright | Codex | 入力・ボタン・画面遷移を実際のブラウザで確認するとき | `.agents/skills/playwright` |
| verification-before-completion | Codex | 実装の完了、修正成功、テスト成功を報告する前 | `.agents/skills/verification-before-completion` |

提供元：[Anthropicの文書作成](https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring)、[Anthropicの画面設計](https://github.com/anthropics/skills/tree/main/skills/frontend-design)、[OpenAIのPlaywright](https://github.com/openai/skills/tree/main/skills/.curated/playwright)、[obra/Superpowersの完了前検証](https://github.com/obra/superpowers/tree/main/skills/verification-before-completion)。

完了前検証は「何を確認し、どの結果を根拠に完了とするか」を扱い、Playwrightは「ブラウザを実際に操作する手段」を担当します。UI以外の確認にはプロジェクトのテスト・build等を使います。現時点ではアプリが未実装なので、アプリの動作確認済みを意味しません。

## 競合を抑える運用

1. Claude Codeで目的・完成条件を固め、既存の企画書・要件定義書へ記録する。
2. Codexへ担当Issueを渡す。UI変更がある場合にfrontend-designを使う。
3. 必要なブラウザ確認にPlaywrightを使い、別途その変更に合ったテスト等を実行する。
4. verification-before-completionで確認結果と未確認事項を整理して報告する。
5. 人間のレビュー後、Claude Codeが進捗を更新する。

各スキルの上流ファイルは改変していません。適用範囲はAGENTS.md・CLAUDE.mdに明記しています。スキルはユーザーが決めた役割分担を変更する権限ではありません。別のUI設計スキルや全体開発フレームワークを追加する場合は、同じ目的のスキルと同時に適用しないようにします。

## 他の候補を比較した結果

GitHub APIで2026-09-18に確認した指標です。スター数はリポジトリ全体への関心の目安で、個別スキルの品質・安全性・効果の評価点ではありません。

| 候補 | スター数 | 今回の判断 |
| --- | ---: | --- |
| [obra/superpowers](https://github.com/obra/superpowers) | 288,227 | 完了前検証だけを採用。全体導入は設計・計画・実装まで管理し、既存の役割分担と重なる |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 128,594 | UI設計の有力な代替候補。frontend-designと領域が重なるため併用しない。検索機能にPythonが必要 |
| [旧GSD](https://github.com/gsd-build/get-shit-done) | 64,515 | 旧リポジトリはアーカイブ済み。現行の[open-gsd/gsd-core](https://github.com/open-gsd/gsd-core)へ移転。今回の単体スキル追加には採用しない |

Superpowersのsystematic-debuggingも確認しましたが、上流の手順がtest-driven-developmentとverification-before-completionを呼び出す構成です。最初の4つには含めず、必要になった時点で依存と作業量を再評価します。既存の進捗管理はGitHub Issuesに統一します。

## 呼び出し例

Claude Codeで：

```text
/doc-coauthoring
AGENTS.mdとdocs/ai-roles.mdを守り、既存のdocs/proposal.mdと
docs/requirements.mdを一緒に具体化してください。実装はCodexへ渡します。
```

Codexで：

```text
$frontend-design
担当Issueと合意済み要件に従って画面を実装してください。
```

```text
$playwright
入力から結果表示までの操作を確認し、未確認箇所も報告してください。
```

```text
$verification-before-completion
この変更の完了条件と実際の確認結果を照合してください。
```

必要なスキルだけを作業ごとに使います。検証スキルを理由に、同じ変更に対する確認を際限なく繰り返す必要はありません。

## 3人で使うには

- この変更を含むブランチを取得し、リポジトリを開く。mainにはPRがマージされた後で反映される。
- Codexは次のターンから利用可能。候補に出ない場合は新しいセッションで開き直す。
- Claude Codeはプロジェクトで新しいセッションを開始し、`/doc-coauthoring` が候補にあるか確認する。
- 個人設定や既存プラグインに同名・同目的のスキルがある場合は、プロジェクトと二重に適用しない。メンバーの個人設定はこの導入では変更していない。
- クラウド利用時は、この変更を含むブランチを選ぶ。ローカルでのみ配置されたファイルはクラウドに伝わらない。

参照：[Codexのプロジェクトスキル](https://learn.chatgpt.com/docs/build-skills)、[Claude Codeのプロジェクトスキル](https://code.claude.com/docs/en/skills)。

## WindowsでのPlaywright

Node.js・npm・Git for WindowsのBashを使用します。上流スキルにあるユーザー共通ディレクトリの例を、このプロジェクトのパスに読み替えて実行します。

```powershell
& 'C:/Program Files/Git/bin/bash.exe' './.agents/skills/playwright/scripts/playwright_cli.sh' --help
```

Bashの場所は各PCの導入先に合わせてください。ラッパーはnpx経由でPlaywright CLIを取得するため、初回はネット接続が必要です。ブラウザがない環境ではブラウザの追加セットアップも必要です。CLI自体のバージョンは上流ラッパーでは固定されていません。

## 導入元と更新

このPCでは4つのSKILL.mdが固定した配布元と一致すること、付属ファイルのハッシュ、説明資料の相対リンクを確認しました。Playwright CLIのヘルプ表示と、専用の一時Edgeセッションでabout:blankを開く・読み取る・閉じる操作も確認済みです。ほかのPC・クラウドでの読み込みと、実アプリの動作は各環境で別途確認してください。

各スキルは特定のコミットから取得し、導入元・SHA-256を [skills-lock.json](skills-lock.json) に記録しています。これは記録用ファイルで、自動更新を制御する仕組みではありません。更新時はPRで差分・参照先・競合を確認し、同ファイルを更新します。配布元に付属するライセンス・NOTICEを保持し、完了前検証には配布元のMITライセンスを同梱しました。
