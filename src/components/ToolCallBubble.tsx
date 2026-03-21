import React from 'react';
import { CollapsibleToolBubble } from './CollapsibleToolBubble';

export interface ToolCallBubbleProps {
  summary: string;
  expandPayload: unknown;
}

export const ToolCallBubble: React.FC<ToolCallBubbleProps> = ({ summary, expandPayload }) => (
  <CollapsibleToolBubble summary={summary} expandPayload={expandPayload} />
);
