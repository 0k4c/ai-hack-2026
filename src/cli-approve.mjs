import { parseArgs } from 'node:util';
import { inspectArrangement, approveArrangement, ApprovalError } from './approve-arrangement.mjs';

try {
  const { values } = parseArgs({ options: {
    process: { type: 'string' }, records: { type: 'string', default: 'output/arrangements' },
    'expected-hash': { type: 'string' }, confirm: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) console.log('npm run approve -- --process ID [--records DIR]\n確認後: npm run approve -- --process ID --expected-hash HASH --confirm [--records DIR]\n承認はローカルデモの記録だけに保存します。外部送信・本番勤務表の更新は行いません。APIキーは不要です。');
  else {
    const options = { recordsDir: values.records, processId: values.process, expectedRecordHash: values['expected-hash'] };
    if (values.confirm) {
      const { approval, created } = await approveArrangement(options);
      console.log(created ? '承認済み（ローカルデモ）。' : '保存済みの承認です。二重保存しません。');
      console.log(JSON.stringify(approval, null, 2));
    } else {
      if (values['expected-hash']) throw new ApprovalError('invalid_input', '--expected-hashは--confirmと一緒に指定してください。');
      const state = await inspectArrangement(options);
      console.log(JSON.stringify(state, null, 2));
      console.log('この操作では保存していません。内容を確認し、承認する場合だけ表示されたrecordHashと--confirmを指定してください。');
    }
  }
} catch (error) {
  console.error(error instanceof ApprovalError ? `${error.code}: ${error.message}` : '引数を確認してください。npm run approve -- --helpで使い方を確認できます。');
  process.exitCode = 1;
}
