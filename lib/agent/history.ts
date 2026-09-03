type AgentBubble = { role: 'user' | 'assistant' | 'system'; text: string };

export function spokenHistory(
  history: AgentBubble[],
): Array<{ role: 'user' | 'assistant'; text: string }> {
  return history.filter(
    (turn): turn is { role: 'user' | 'assistant'; text: string } =>
      turn.role === 'user' || turn.role === 'assistant',
  );
}
