import React from 'react';
import { CollapsibleToolBubble } from './CollapsibleToolBubble';

export interface ToolResultBubbleProps {
  summary: string;
  expandPayload: unknown;
}

export const ToolResultBubble: React.FC<ToolResultBubbleProps> = ({ summary, expandPayload }) => (
  <CollapsibleToolBubble summary={summary} expandPayload={expandPayload} />
);
