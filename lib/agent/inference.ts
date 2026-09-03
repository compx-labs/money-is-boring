import type { Api, Model } from '@mariozechner/pi-ai';
import type { StreamFn } from '@mariozechner/pi-agent-core';
import { createZerosignalStream, zerosignalModel, type ZsInferenceSession } from '@/lib/zerosignal/provider';

export type InferenceKind = 'zerosignal';

export type WalletInference = {
  kind: InferenceKind;
  model: Model<Api>;
  streamFn: StreamFn;
};

/** Swappable inference seam. NEO-342 adds QVAC here; do not hardcode the chat loop. */
export function createWalletInference(
  kind: InferenceKind,
  session: ZsInferenceSession,
): WalletInference {
  if (kind !== 'zerosignal') {
    throw new Error(`Unsupported inference backend: ${String(kind)}`);
  }
  return {
    kind,
    model: zerosignalModel(session.node.model),
    streamFn: createZerosignalStream(session),
  };
}
