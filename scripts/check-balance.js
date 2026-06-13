import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const address = "0x5024388c650fDB20B6A845c38A7E0402A1EbF9E9";
  try {
    const balance = await provider.getBalance(address);
    console.log(`Address: ${address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} USDC`);
  } catch (error) {
    console.error("Error fetching balance:", error);
  }
}

main().catch(console.error);
