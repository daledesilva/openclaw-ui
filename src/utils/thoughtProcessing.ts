import type { ThoughtItem } from '../chatThreadTypes';

export function deriveRecentToolSummaryLine(thoughtItems: ThoughtItem[]): string | null {
  if(thoughtItems.length === 0) return null;
  
  let mostRecentThought = thoughtItems[thoughtItems.length - 1]!;
  if(mostRecentThought.kind === 'internalMonologue') return mostRecentThought.thought;
  if(mostRecentThought.kind === 'toolCall')  return mostRecentThought.content?.toString() || '';
  
  return null;
}
