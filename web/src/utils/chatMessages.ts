import type { ChatMessage } from '@/types/schema';

export const MAX_CHAT_CHARS = 100_000;

/**
 * 发送前截断：总字符 ≤100K，从最旧的消息开始丢弃；
 * 截断后若首条为 assistant 则继续丢弃，保证 user 开头。
 */
export function truncateChatMessages(
  messages: ChatMessage[],
  limit = MAX_CHAT_CHARS,
): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const length = (message.content || '').length;
    if (kept.length > 0 && total + length > limit) break;
    kept.unshift(message);
    total += length;
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift();
  return kept;
}

/** 转换为后端约定结构（assistant 历史只保留 reply 文本）。 */
export function toApiMessages(messages: ChatMessage[]): ChatMessage[] {
  return truncateChatMessages(messages).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}
