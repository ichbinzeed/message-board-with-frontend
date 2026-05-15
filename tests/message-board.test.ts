import { Cl, ClarityType } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

const CONTRACT = "message-board";
const accounts = simnet.getAccounts();
const alice = accounts.get("wallet_1")!;
const john = accounts.get("wallet_2")!;
const S_BTC_ASSET = ".sbtc-token.sbtc-token";
const noSbtcUser = "ST000000000000000000002AMW42H";

const getAssetBalance = (asset: string, principal: string) =>
  simnet.getAssetsMap().get(asset)?.get(principal) ?? 0n;

describe("Messages", () => {
  let addMessage: any; // ← Declarar aquí
  let currentBurnBlockHeight = simnet.burnBlockHeight;
  beforeEach(() => {
    let message = "Hello, world!";
    addMessage = simnet.callPublicFn(
      CONTRACT,
      "add-message",
      [Cl.stringUtf8(message)],
      john,
    );
  });

  it("can insert a new message", () => {
    const messageCount = simnet.getDataVar(CONTRACT, "message-count");
    expect(addMessage.result).toHaveClarityType(ClarityType.ResponseOk);
    expect(addMessage.result).toBeOk(messageCount);
  });

  it("can read a message", () => {
    const readMessage = simnet.callReadOnlyFn(
      CONTRACT,
      "get-message",
      [Cl.uint(1)],
      alice,
    );
    const messageCount = simnet.getDataVar(CONTRACT, "message-count");
    expect(readMessage.result).toHaveClarityType(ClarityType.OptionalSome);
    expect(addMessage.events[1].data.value).toBeTuple({
      author: Cl.standardPrincipal(john),
      event: Cl.stringAscii("[Stacks Dev Quickstart] New Message"),
      id: messageCount,
      message: Cl.stringUtf8("Hello, world!"),
      time: Cl.uint(currentBurnBlockHeight),
    });
  });

  it("can't read a non-existent message", () => {
    const readMessage = simnet.callReadOnlyFn(
      CONTRACT,
      "get-message",
      [Cl.uint(999)],
      alice,
    );
    expect(readMessage.result).toHaveClarityType(ClarityType.OptionalNone);
  });
  it("can't post a message without sBtc", () => {
    expect(getAssetBalance(S_BTC_ASSET, noSbtcUser)).toBe(0n);

    const result = simnet.callPublicFn(
      CONTRACT,
      "add-message",
      [Cl.stringUtf8("This message should fail")],
      noSbtcUser,
    );
    expect(result.result).toHaveClarityType(ClarityType.ResponseErr);
    expect(result.result).toBeErr(Cl.uint(1004));
  });
});
