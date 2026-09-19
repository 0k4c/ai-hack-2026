# 前回作品の参照メモ

2026-09-19確認。ユーザーが共有した運営メッセージでは全48作品、このメッセージに含まれるリンクは23件です。以下の3記事は本文を確認し、残り20件はリンクの保存のみです。前回作品の審査結果や今回の得点を推測する資料ではありません。

## 今回の設計に参考になる3記事

| 作品・出典 | 記事で確認した設計 | 今回への提案 |
| --- | --- | --- |
| [FollowUp AI](https://zenn.dev/toukaidou/articles/followup-ai-personal-gym-line-support) | 顧客フォローの返信案をAIが作り、人が確認・編集・承認して送る。数値計算等はコードで行う | 「任せる判断」と「人が確定する操作」を要件に分けて書く |
| [HRper](https://qiita.com/AITeamP/items/d6a98083b82976d0df11) | AI・コード・人の役割を分け、引用番号を検証する。実装上の制約も記事に明記 | AIの出力をそのまま実行せず、許可値を検証する。未対応も提出記事で説明する |
| [KYAKUMAP](https://zenn.dev/iineineno03k/articles/20260815-kyakumap-sales-prep-ai) | 根拠IDを許可リストと照合。Guardrailsの有効化前後で同じ入力を試し、マスク・ブロックを確認 | 設定を入れた事実に加え、同じサンプルによる確認結果を残す |

上記は著者の記事の記述であり、こちらでアプリを実行して再現した結果ではありません。今回への提案はその記述からの判断です。3記事から全48作品の傾向を断定せず、機能数やクラウド構成をそのまま真似しないでください。

## 共有されたリンク一覧

| チーム | 作品・記事 | 本文確認 |
| --- | --- | --- |
| A | [Foris](https://qiita.com/arishow/private/cf1d26f52f4b48b0c187) | 未確認（限定共有URL） |
| C | [高齢者ケアアシスタントAI](https://zenn.dev/kagliostro/articles/d07b45a58d17ef) | 未確認 |
| D | [Crowd Weather](https://qiita.com/a2239154301/items/ec0dd58a85dbf4db759b) | 未確認 |
| E | [SpotCheck](https://zenn.dev/bakumin/articles/c5372ab89a85ed) | 未確認 |
| F | [泣きやみなさいわが子よ](https://qiita.com/t-ry/items/ba3bf2973a3b52641746) | 未確認 |
| G | [HAKARU](https://zenn.dev/floppy30/articles/2cf7f3d11ae5c2) | 未確認 |
| H | [pygMe](https://zenn.dev/kon0930/articles/c32f250b194ae8) | 未確認 |
| I | [MAWASU](https://zenn.dev/tomomj/articles/ai-hack-2026) | 未確認 |
| J | [Okaeri](https://qiita.com/haru-qiita/items/e00ebc98c598a1c4411a) | 未確認 |
| K | [ツマヅキ](https://qiita.com/tokyosini573/items/85ba4eec246a83c2aa33) | 未確認 |
| M | [FollowUp AI](https://zenn.dev/toukaidou/articles/followup-ai-personal-gym-line-support) | 確認済み |
| O | [Wellie](https://zenn.dev/st4rcitizen/articles/b44dd0a8f01009) | 未確認 |
| P | [HRper](https://qiita.com/AITeamP/items/d6a98083b82976d0df11) | 確認済み |
| Q | [プロダクト名未記載](https://zenn.dev/enyugi/articles/b5a703567eec46) | 未確認 |
| R | [Routeoff](https://qiita.com/araidon/items/466dd1b6d5421e7ae5fe) | 未確認 |
| S | [CHIGIRI](https://qiita.com/keyakima/items/e65966842d3ccc6d4665) | 未確認 |
| T | [FoodRescue-ai](https://qiita.com/Nandar-09/items/4df5137a6148ff1fd556) | 未確認 |
| U | [LifeFork](https://qiita.com/ITO_89/items/73972053c11993433e75) | 未確認 |
| V | [Paresio](https://zenn.dev/harukadia/articles/40e9ba59e5a118) | 未確認 |
| W | [pakulist](https://qiita.com/tmyymmt/items/48429e733db7c0311325) | 未確認 |
| X | [SmartWater Guardian](https://zenn.dev/fin_fta/articles/00f69860b87fce) | 未確認 |
| Y | [KYAKUMAP](https://zenn.dev/iineineno03k/articles/20260815-kyakumap-sales-prep-ai) | 確認済み |
| Z | [AIおたよりシステム](https://qiita.com/B1F/items/f3a6118bbed735245bc4) | 未確認 |

このリポジトリはPrivateです。公開する場合は、限定共有URLも公開対象に含めてよいか確認してください。
