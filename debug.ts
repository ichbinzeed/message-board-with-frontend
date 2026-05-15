import { initSimnet } from "@stacks/clarinet-sdk";
import { Cl } from "@stacks/transactions";

async function main() {
  const simnet = await initSimnet();
  const assets = simnet.getAssetsMap();
  const accounts = simnet.getAccounts();
  const john = accounts.get("wallet_2")!;
  const deployer = accounts.get("deployer")!;
  const CONTRACT = "message-board";
  const contractPrincipal = `${deployer}.${CONTRACT}`;

  const S_BTC_ASSET = ".sbtc-token.sbtc-token";
  const getSbtcBalance = (principal: string) =>
    simnet.getAssetsMap().get(S_BTC_ASSET)?.get(principal) ?? 0n;

  console.log("asset keys:", Array.from(simnet.getAssetsMap().keys()));

  const tx = simnet.callPublicFn(
    CONTRACT,
    "add-message",
    [Cl.stringUtf8("debug-message")],
    john,
  );

  console.log("john:", john);
  console.log("add-message result:", tx.result);
  console.log("john sBTC (fresh map):", getSbtcBalance(john));
  console.log("contract sBTC (fresh map):", getSbtcBalance(contractPrincipal));
  console.log(
    "contract sBTC (snapshot map):",
    assets.get(S_BTC_ASSET)?.get(contractPrincipal),
  );
}

main().catch(console.error);
