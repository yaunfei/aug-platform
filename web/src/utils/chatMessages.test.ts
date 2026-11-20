import { describe, expect, it } from 'vitest';
import { truncateChatMessages } from '@/utils/chatMessages';
import type { ChatMessage } from '@/types/schema';

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { role, content };
}

describe('truncateChatMessages', () => {
  it('总量超限时丢弃最旧消息', () => {
    const messages = [msg('user', 'a'.repeat(60)), msg('assistant', 'b'.repeat(60)), msg('user', 'c'.repeat(60))];
    const kept = truncateChatMessages(messages, 130);
    expect(kept.map((item) => item.content[0])).toEqual(['c']);
  });

  it('截断后保证 user 开头', () => {
    const messages = [msg('assistant', 'old'), msg('user', 'q'), msg('assistant', 'a'), msg('user', 'q2')];
    const kept = truncateChatMessages(messages, 1000);
    expect(kept[0].role).toBe('user');
  });

  it('保留最后一条 user 消息', () => {
    const messages = [msg('user', 'x'.repeat(50))];
    expect(truncateChatMessages(messages, 10)).toHaveLength(1);
  });
});
