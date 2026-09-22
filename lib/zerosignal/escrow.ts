import {
  ABIMethod,
  OnApplicationComplete,
  SignedTransaction,
  assignGroupID,
  decodeMsgpack,
  encodeMsgpack,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  msgpackRawDecodeAsMap,
  msgpackRawEncode,
} from 'algosdk';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { algod } from '@/lib/algorand/client';
import { submitSignedGroup } from '@/lib/algorand/submit';
import { reuseAuth } from '@/lib/keystore/auth-options';
import { ALGOD_URL, USDC_ASA_ID, ZS_ESCROW_APP_ID } from '@/lib/theme';
import { b64Decode } from '@/lib/zerosignal/bytes';
import type { Ticket } from '@/lib/zerosignal/ticket';

const TICKET_ID_RAW_LEN = 16;
export const MBR_DEPOSIT_MICRO = 500_000n;
const depositMethod = ABIMethod.fromSignature('depositMbr(pay)void');

function addrString(v: { toString(): string } | string): string {
  return typeof v === 'string' ? v : v.toString();
}

async function decodeSignedGroup(b64: string, want: number, label: string): Promise<SignedTransaction[]> {
  if (!b64) throw new Error(`${label} is empty`);
  const decoded = msgpackRawDecodeAsMap(b64Decode(b64));
  if (!Array.isArray(decoded) || decoded.length !== want) {
    throw new Error(`${label} must be ${want} signed transactions`);
  }
  return decoded.map((entry, i) => {
    try {
      return decodeMsgpack(msgpackRawEncode(entry), SignedTransaction);
    } catch (err) {
      throw new Error(`${label}[${i}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

export async function isEscrowOptedIn(address: string): Promise<boolean> {
  const res = await fetch(`${ALGOD_URL}/v2/accounts/${address}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`algod ${res.status}`);
  const body = (await res.json()) as { 'apps-local-state'?: { id: number }[] };
  return (body['apps-local-state'] ?? []).some((ls) => ls.id === ZS_ESCROW_APP_ID);
}

export async function ensureMbrDeposit(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
): Promise<void> {
  const opted = await isEscrowOptedIn(address);
  const client = algod();
  const params = await client.getTransactionParams().do();
  const minFee = params.minFee;
  const appAddress = addrString(getApplicationAddress(ZS_ESCROW_APP_ID));

  const payment = makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: appAddress,
    amount: MBR_DEPOSIT_MICRO,
    suggestedParams: { ...params, fee: 0n, flatFee: true },
  });
  const appCall = makeApplicationCallTxnFromObject({
    sender: address,
    appIndex: ZS_ESCROW_APP_ID,
    onComplete: opted ? OnApplicationComplete.NoOpOC : OnApplicationComplete.OptInOC,
    appArgs: [depositMethod.getSelector()],
    suggestedParams: { ...params, fee: minFee * 2n, flatFee: true },
  });
  assignGroupID([payment, appCall]);

  const blobs: Uint8Array[] = [];
  for (const txn of [payment, appCall]) {
    const sig = await store.sign(keyId, txn.bytesToSign());
    blobs.push(txn.attachSignature(address, sig));
  }
  await submitSignedGroup(blobs, appCall.txID());
}

function verifyOpenGroup(
  signed: SignedTransaction[],
  args: { ticket: Ticket; payerAddress: string; signingAddr: string },
): void {
  const [pay, appl] = signed.map((s) => s.txn);
  const axfer = pay.assetTransfer;
  const app = appl.applicationCall;
  if (!axfer || pay.type !== 'axfer') throw new Error('open group gtxn[0] is not a USDC transfer');
  if (!app || appl.type !== 'appl') throw new Error('open group gtxn[1] is not an app call');
  if (addrString(pay.sender) !== args.payerAddress) throw new Error('open group payer mismatch');
  if (addrString(axfer.receiver) !== addrString(getApplicationAddress(ZS_ESCROW_APP_ID))) {
    throw new Error('open group USDC receiver is not escrow');
  }
  if (axfer.assetIndex !== BigInt(USDC_ASA_ID)) throw new Error('open group asset is not USDC');
  if (axfer.amount !== BigInt(args.ticket.max_price)) throw new Error('open group amount != max_price');
  if (app.appIndex !== BigInt(ZS_ESCROW_APP_ID)) throw new Error('open group app id mismatch');
  if (addrString(appl.sender) !== args.signingAddr) throw new Error('open group AppCall sender is not the node');
}

export async function composeOpen(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  args: { ticket: Ticket; payerAddress: string; signingAddr: string; presignedOpenTxn: string },
): Promise<{ txids: string[] }> {
  const ticketIdRaw = b64Decode(args.ticket.ticket_id);
  if (ticketIdRaw.length !== TICKET_ID_RAW_LEN) {
    throw new Error(`ticket id decodes to ${ticketIdRaw.length} bytes, want ${TICKET_ID_RAW_LEN}`);
  }

  const decoded = await decodeSignedGroup(args.presignedOpenTxn, 2, 'presigned_open_txn');
  verifyOpenGroup(decoded, args);

  const payerTxn = decoded[0].txn;
  const sig = await store.sign(keyId, payerTxn.bytesToSign());
  const payerBlob = payerTxn.attachSignature(args.payerAddress, sig);
  const operatorBlob = encodeMsgpack(decoded[1]);
  const txids = decoded.map((s) => s.txn.txID());
  await submitSignedGroup([payerBlob, operatorBlob], txids[1]);
  return { txids };
}

export async function submitPresignedSettleGroup(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  args: { settleGroupB64: string; payerAddress: string },
): Promise<void> {
  const decoded = await decodeSignedGroup(args.settleGroupB64, 2, 'settle-group');
  const payerTxn = decoded[1].txn;
  if (addrString(payerTxn.sender) !== args.payerAddress) {
    throw new Error('settle group payer mismatch');
  }
  const sig = await store.sign(keyId, payerTxn.bytesToSign(), undefined, reuseAuth);
  const payerBlob = payerTxn.attachSignature(args.payerAddress, sig);
  const operatorBlob = encodeMsgpack(decoded[0]);
  await submitSignedGroup([operatorBlob, payerBlob], payerTxn.txID());
}

export function isMbrPoolGuard(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('mbr deposit') || msg.includes('no mbr');
}
