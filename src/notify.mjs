import { randomUUID } from 'node:crypto';

export function validateReplies(replies, employees) {
  if (!Array.isArray(replies) || replies.length > 100 || replies.some(reply =>
    !reply || Object.keys(reply).sort().join(',') !== 'employeeId,text' ||
    !employees.some(employee => employee.id === reply.employeeId) ||
    typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 4000)) {
    throw new Error('返事は登録済みemployeeIdと1〜4000文字のtextを持つ配列（最大100件）にしてください。');
  }
}

// Each transport owns its script cursor. Nothing is sent to an external service.
export function createDryRunNotifier(replies) {
  const consumed = new Set();
  return {
    async sendRequest({ employeeId, message, contextId }) {
      return { channel: 'dryrun', sentAt: new Date().toISOString(), messageId: randomUUID(), delivered: false,
        employeeId, message, contextId };
    },
    async receiveReply({ contextId, employeeId }) {
      const index = replies.findIndex((reply, index) => reply.employeeId === employeeId && !consumed.has(index));
      if (index < 0) return null;
      consumed.add(index);
      return { contextId, ...replies[index] };
    },
  };
}
