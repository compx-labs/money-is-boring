import {
  createAssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
} from '@mariozechner/pi-ai';
import type { StreamFn } from '@mariozechner/pi-agent-core';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { MAX_OUTPUT, sealedRound } from '@/lib/zerosignal/chat';
import { contextToZsBody, ZS_API, ZS_PROVIDER } from '@/lib/zerosignal/context';
import type { PayListener } from '@/lib/zerosignal/pay';
import { applyTextDelta, emptyAssistant, failRound, finalizeRound } from '@/lib/zerosignal/stream-events';
import type { ZsNode } from '@/lib/zerosignal/discover';

export type ZsInferenceSession = {
  node: ZsNode;
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  onPay?: PayListener;
  awaitSign?: () => Promise<void>;
  confirmInference?: boolean;
  chargedMicro: number;
};

export function zerosignalModel(modelId: string): Model<typeof ZS_API> {
  return {
    id: modelId,
    name: modelId,
    api: ZS_API,
    provider: ZS_PROVIDER,
    baseUrl: '',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: MAX_OUTPUT,
  };
}

/**
 * ZeroSignal as a pi-ai Provider. Pi owns the loop; this only runs one sealed
 * pay-per-call round. Tickets, age, receipts, and settle stay in-app.
 */
export function createZerosignalStream(session: ZsInferenceSession): StreamFn {
  return (model, context, options?: SimpleStreamOptions) => {
    const stream = createAssistantMessageEventStream();
    const output = emptyAssistant(model);
    stream.push({ type: 'start', partial: output });

    void (async () => {
      try {
        if (options?.signal?.aborted) {
          stream.push(failRound(output, 'aborted', true));
          stream.end(output);
          return;
        }
        const maxOutput = options?.maxTokens ?? model.maxTokens ?? MAX_OUTPUT;
        const body = new TextEncoder().encode(
          JSON.stringify(contextToZsBody(model.id, context, maxOutput)),
        );
        let soFar = '';
        const { acc, chargedMicro } = await sealedRound({
          node: session.node,
          store: session.store,
          keyId: session.keyId,
          address: session.address,
          body,
          onPay: session.onPay,
          awaitSign: session.awaitSign,
          confirmInference: session.confirmInference,
          onDelta: (text) => {
            for (const event of applyTextDelta(output, soFar, text)) {
              stream.push(event);
            }
            soFar = text;
          },
        });
        session.chargedMicro += chargedMicro;
        for (const event of finalizeRound(output, acc, {
          input: acc.receipt?.actual_input_count,
          output: acc.receipt?.actual_output_count,
        })) {
          stream.push(event);
        }
        stream.end(output);
      } catch (error) {
        const event = failRound(output, error, options?.signal?.aborted === true);
        stream.push(event);
        stream.end(output);
      }
    })();

    return stream;
  };
}
