import { describe, expect, it } from 'vitest';
import type { AssistantDisplayPayload } from '../api/gateway-types';
import type { Message } from '../chatThreadTypes';
import {
  appendThoughtItem,
  applyAssistantFinalWithThoughtBuffer,
  assistantHistoryRowDisplaysToUser,
  findLastAssistantIndex,
  foldFetchedHistoryToMessages,
  formatThoughtItemsForModal,
  mergeAssistantFinalIntoMessages,
  withReasoningTraceBeforeLastAssistant,
} from './recentThoughtsReducer';

describe('appendThoughtItem', () => {
  it('dedupes consecutive identical tool hints', () => {
    let t = appendThoughtItem([], { kind: 'toolHint', label: 'search()' });
    t = appendThoughtItem(t, { kind: 'toolHint', label: 'search()' });
    expect(t).toEqual([{ kind: 'toolHint', label: 'search()' }]);
  });

  it('allows same tool hint after a different item', () => {
    let t = appendThoughtItem([], { kind: 'toolHint', label: 'a' });
    t = appendThoughtItem(t, { kind: 'reasoningChunk', text: 'x' });
    t = appendThoughtItem(t, { kind: 'toolHint', label: 'a' });
    expect(t).toHaveLength(3);
  });
});

describe('findLastAssistantIndex', () => {
  it('returns last assistant slot', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'ai', kind: 'assistant', content: '' },
    ];
    expect(findLastAssistantIndex(messages)).toBe(1);
  });

  it('returns -1 when missing', () => {
    expect(findLastAssistantIndex([{ id: '1', role: 'user', content: 'hi' }])).toBe(-1);
  });
});

describe('withReasoningTraceBeforeLastAssistant', () => {
  it('inserts trace before streaming assistant', () => {
    const prev: Message[] = [
      { id: 'u', role: 'user', content: 'q' },
      { id: 'a', role: 'ai', kind: 'assistant', content: 'partial' },
    ];
    const items = [{ kind: 'toolHint' as const, label: 't()' }];
    const next = withReasoningTraceBeforeLastAssistant(prev, {
      thoughtItems: items,
      traceId: 'trace-1',
      proseReasoning: 'thinking',
    });
    expect(next).toHaveLength(3);
    expect(next![1]!.kind).toBe('reasoningTrace');
    expect(next![1]!.thoughtItems).toEqual(items);
    expect(next![2]!.id).toBe('a');
  });

  it('returns null when no items and no prose', () => {
    const prev: Message[] = [{ id: 'a', role: 'ai', kind: 'assistant', content: '' }];
    expect(
      withReasoningTraceBeforeLastAssistant(prev, { thoughtItems: [], traceId: 't' })
    ).toBeNull();
  });

  it('allows prose-only trace', () => {
    const prev: Message[] = [{ id: 'a', role: 'ai', kind: 'assistant', content: '' }];
    const next = withReasoningTraceBeforeLastAssistant(prev, {
      thoughtItems: [],
      traceId: 't',
      proseReasoning: 'only thinking',
    });
    expect(next).toHaveLength(2);
    expect(next![0]!.kind).toBe('reasoningTrace');
    expect(next![0]!.proseReasoning).toBe('only thinking');
  });
});

describe('applyAssistantFinalWithThoughtBuffer', () => {
  it('merges final payload into assistant after trace', () => {
    const prev: Message[] = [
      { id: 'u', role: 'user', content: 'q' },
      { id: 'a', role: 'ai', kind: 'assistant', content: 'streamed' },
    ];
    const payload: AssistantDisplayPayload = {
      content: 'final answer',
      reasoning: '',
      linkPreviews: [],
      imageUrls: [],
      toolCalls: [],
    };
    const next = applyAssistantFinalWithThoughtBuffer(
      prev,
      payload,
      [{ kind: 'toolHint', label: 'read()' }],
      'tr'
    );
    expect(next).toHaveLength(3);
    expect(next[1]!.kind).toBe('reasoningTrace');
    expect(next[2]!.content).toBe('final answer');
  });

  it('skips trace when buffer empty and no prose reasoning', () => {
    const prev: Message[] = [{ id: 'a', role: 'ai', kind: 'assistant', content: 'x' }];
    const payload: AssistantDisplayPayload = {
      content: 'y',
      reasoning: '',
      linkPreviews: [],
      imageUrls: [],
      toolCalls: [],
    };
    const next = applyAssistantFinalWithThoughtBuffer(prev, payload, [], 'tr');
    expect(next).toHaveLength(1);
    expect(next[0]!.content).toBe('y');
  });

  it('inserts prose-only trace when payload has reasoning', () => {
    const prev: Message[] = [{ id: 'a', role: 'ai', kind: 'assistant', content: '' }];
    const payload: AssistantDisplayPayload = {
      content: 'ans',
      reasoning: 'model thinking',
      linkPreviews: [],
      imageUrls: [],
      toolCalls: [],
    };
    const next = applyAssistantFinalWithThoughtBuffer(prev, payload, [], 'tr');
    expect(next).toHaveLength(2);
    expect(next[0]!.kind).toBe('reasoningTrace');
    expect(next[1]!.content).toBe('ans');
  });
});

describe('mergeAssistantFinalIntoMessages', () => {
  it('updates last assistant', () => {
    const prev: Message[] = [{ id: 'a', role: 'ai', kind: 'assistant', content: 'old' }];
    const payload: AssistantDisplayPayload = {
      content: 'new',
      reasoning: '',
      linkPreviews: [],
      imageUrls: [],
      toolCalls: [],
    };
    const next = mergeAssistantFinalIntoMessages(prev, payload);
    expect(next[0]!.content).toBe('new');
  });
});

describe('foldFetchedHistoryToMessages', () => {
  it('folds tool-only assistant, tool result, then answer with trace ordering', () => {
    const history = [
      {
        role: 'user',
        content: 'hello',
        reasoning: '',
      },
      {
        role: 'assistant',
        content: '',
        reasoning: '',
        toolCalls: [{ name: 'web_search', argumentsPreview: '{}' }],
      },
      {
        role: 'toolresult',
        content: '',
        reasoning: '',
        toolName: 'web_search',
        toolRawPayload: { results: [1, 2] },
        isError: false,
      },
      {
        role: 'assistant',
        content: 'Here is the answer.',
        reasoning: '',
      },
    ];
    const out = foldFetchedHistoryToMessages(history as never);
    expect(out[0]!.role).toBe('user');
    expect(out[1]!.kind).toBe('reasoningTrace');
    expect(out[1]!.thoughtItems?.some((t) => t.kind === 'toolResult')).toBe(true);
    expect(out[2]!.kind).toBe('assistant');
    expect(out[2]!.content).toBe('Here is the answer.');
    expect(out).toHaveLength(3);
  });

  it('flushes thinking-only assistant as orphan trace at end of history', () => {
    const history = [
      {
        role: 'assistant',
        content: '',
        reasoning: 'internal monologue',
      },
    ];
    const out = foldFetchedHistoryToMessages(history as never);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('reasoningTrace');
    expect(out[0]!.thoughtItems).toEqual([{ kind: 'reasoningChunk', text: 'internal monologue' }]);
    expect(out[0]!.proseReasoning).toBeUndefined();
  });

  it('merges thinking plus tool round into one trace before displayed answer', () => {
    const history = [
      { role: 'user', content: 'Hello?', reasoning: '' },
      {
        role: 'assistant',
        content: '',
        reasoning: 'Initiating protocols…',
        toolCalls: [
          { name: 'read', argumentsPreview: '{"file_path":"SOUL.md"}' },
          { name: 'read', argumentsPreview: '{"file_path":"USER.md"}' },
        ],
      },
      {
        role: 'toolresult',
        content: '',
        reasoning: '',
        toolName: 'read',
        toolRawPayload: { ok: true },
        isError: false,
      },
      {
        role: 'assistant',
        content: 'Hi Darf.',
        reasoning: '',
      },
    ];
    const out = foldFetchedHistoryToMessages(history as never);
    const traceIndices = out
      .map((m, i) => (m.kind === 'reasoningTrace' ? i : -1))
      .filter((i) => i >= 0);
    expect(traceIndices).toHaveLength(1);
    const trace = out[traceIndices[0]!]!;
    expect(trace.thoughtItems?.some((t) => t.kind === 'reasoningChunk')).toBe(true);
    expect(trace.thoughtItems?.some((t) => t.kind === 'toolHint')).toBe(true);
    expect(trace.thoughtItems?.some((t) => t.kind === 'toolResult')).toBe(true);
    expect(out[out.length - 1]!.content).toBe('Hi Darf.');
  });
});

describe('assistantHistoryRowDisplaysToUser', () => {
  it('is false for thinking-only row', () => {
    expect(
      assistantHistoryRowDisplaysToUser({
        role: 'assistant',
        content: '',
        reasoning: 'lots of thinking',
      } as never)
    ).toBe(false);
  });

  it('is true when body text present', () => {
    expect(
      assistantHistoryRowDisplaysToUser({
        role: 'assistant',
        content: 'Hello',
        reasoning: '',
      } as never)
    ).toBe(true);
  });
});

describe('formatThoughtItemsForModal', () => {
  it('joins tools and prose', () => {
    const text = formatThoughtItemsForModal(
      [
        { kind: 'toolHint', label: 'a()' },
        { kind: 'reasoningChunk', text: 'think' },
      ],
      'final prose'
    );
    expect(text).toContain('• a()');
    expect(text).toContain('think');
    expect(text).toContain('final prose');
  });
});
