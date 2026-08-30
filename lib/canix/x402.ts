import {
  assignGroupID,
  encodeUnsignedTransaction,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
} from 'algosdk';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { algod } from '@/lib/algorand/client';
import { signWithAc2 } from '@/lib/keystore/ac2';

type Accept = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  extra?: { feePayer?: string };
};

type PaymentRequired = {
  x402Version: number;
  accepts: Accept[];
};

function decodeHeader(header: string): PaymentRequired {
  return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as PaymentRequired;
}

function encodeHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

export function x402AmountMicro(paymentRequiredHeader: string): bigint {
  const required = decodeHeader(paymentRequiredHeader);
  const accept = required.accepts?.[0];
  if (!accept) throw new Error('No x402 payment option');
  return BigInt(accept.amount);
}

/**
 * Sign a Canix exact-scheme x402 USDC transfer from the wallet.
 * Fee-payer txn stays unsigned; the user signs only the USDC transfer.
 */
export async function signX402Payment(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
  paymentRequiredHeader: string,
): Promise<string> {
  const required = decodeHeader(paymentRequiredHeader);
  const accept = required.accepts?.[0];
  if (!accept) throw new Error('No x402 payment option');

  const amount = BigInt(accept.amount);
  const assetIndex = Number(accept.asset);
  const feePayer = accept.extra?.feePayer;
  const params = await algod().getTransactionParams().do();
  const minFee = params.minFee;

  const payment = makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: accept.payTo,
    amount,
    assetIndex,
    suggestedParams: { ...params, fee: 0n, flatFee: true },
  });

  const group = [payment];
  if (feePayer) {
    const feeTxn = makePaymentTxnWithSuggestedParamsFromObject({
      sender: feePayer,
      receiver: feePayer,
      amount: 0,
      suggestedParams: { ...params, fee: minFee * 2n, flatFee: true },
    });
    group.unshift(feeTxn);
  }
  assignGroupID(group);

  const paymentIndex = feePayer ? 1 : 0;
  const sig = await signWithAc2(
    store,
    keyId,
    group[paymentIndex].bytesToSign(),
    'Approve this Canix payment',
  );
  const signedPayment = group[paymentIndex].attachSignature(address, sig);

  const paymentGroup: string[] = group.map((txn, i) => {
    const bytes = i === paymentIndex ? signedPayment : encodeUnsignedTransaction(txn);
    return Buffer.from(bytes).toString('base64');
  });

  return encodeHeader({
    x402Version: required.x402Version ?? 2,
    scheme: accept.scheme,
    network: accept.network,
    accepted: accept,
    payload: { paymentGroup, paymentIndex },
  });
}
