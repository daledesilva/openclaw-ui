import React from 'react';
import type { ThoughtItem } from '../chatThreadTypes';

export type ChainOfThoughtModalContent =
  | { mode: 'structured'; thoughtItems: ThoughtItem[]; proseReasoning?: string }
  | { mode: 'plain'; text: string };

export interface ChainOfThoughtModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the dialog header */
  title?: string;
  content: ChainOfThoughtModalContent;
}

/** Plain-text export of trace + prose (same structure as structured modal sections). Exported for tests. */
export function formatThoughtItemsForModal(items: ThoughtItem[], proseReasoning?: string): string {
  const toolLines: string[] = [];
  const reasoningParts: string[] = [];
  for (const item of items) {
    if (item.kind === 'toolCall') {
      const name = item.toolName?.trim() || 'tool';
      const preview = typeof item.content === 'string' ? item.content : String(item.content ?? '');
      toolLines.push(preview.trim() ? `• ${name}(${preview})` : `• ${name}()`);
    } else if (item.kind === 'internalMonologue') {
      reasoningParts.push(item.thought);
    }
  }
  const chunks = [
    toolLines.length ? `Tools\n${toolLines.join('\n')}` : '',
    reasoningParts.join('').trim() ? reasoningParts.join('') : '',
    proseReasoning?.trim() ? proseReasoning.trim() : '',
  ].filter(Boolean);
  return chunks.join('\n\n---\n\n');
}

/** Modal shell is stubbed until segmented UI is re-enabled; props are kept for API stability. */
export const ChainOfThoughtModal: React.FC<ChainOfThoughtModalProps> = (_props) => null;
