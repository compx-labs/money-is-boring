import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';

export type AgentToolSchema = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type AgentToolContext = {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  onStatus?: (step: string) => void;
};

export type AgentToolResult = {
  body: unknown;
  paidMicro: bigint;
};

export type AgentToolProvider = {
  id: string;
  tools: AgentToolSchema[];
  run: (
    name: string,
    args: Record<string, unknown>,
    ctx: AgentToolContext,
  ) => Promise<AgentToolResult | null>;
};
