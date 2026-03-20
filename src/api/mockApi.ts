/**
 * Mock API to simulate streaming chain of thought and final message output.
 */
export const streamMockResponse = async (
  prompt: string,
  onReasoningChunk: (chunk: string) => void,
  onContentChunk: (chunk: string) => void
) => {
  // Simulate network delay
  await new Promise((res) => setTimeout(res, 500));

  // 1. Simulate Reasoning Stream (Chain of Thought)
  const reasoningSteps = [
    `Analyzing request: "${prompt}"\n`,
    `> Identifying user intent...\n`,
    `> Formulating step-by-step plan...\n`,
    `> Plan ready. Preparing final response.\n`
  ];

  for (const step of reasoningSteps) {
    onReasoningChunk(step);
    await new Promise((res) => setTimeout(res, 400)); // typing speed
  }

  // 2. Simulate Final Content Stream
  const finalResponse = `I've successfully processed your request regarding "${prompt}". The interface is fully functional, complete with a Chain of Thought panel streaming mock reasoning data!`;
  const contentWords = finalResponse.split(' ');

  for (const word of contentWords) {
    onContentChunk(word + ' ');
    await new Promise((res) => setTimeout(res, 80)); // typing speed
  }
};
