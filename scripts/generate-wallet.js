import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const wallet = ethers.Wallet.createRandom();
  console.log("=========================================");
  console.log("New Deployer Wallet Generated!");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("=========================================");
  console.log("Please fund this address with testnet USDC at: https://faucet.circle.com");
  console.log("Select 'Arc Testnet' network, paste the address, and claim tokens.");
  console.log("=========================================");

  const envPath = path.join(__dirname, "../.env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  if (!envContent.includes("DEPLOYER_PRIVATE_KEY")) {
    fs.writeFileSync(envPath, envContent + `\nDEPLOYER_PRIVATE_KEY="${wallet.privateKey}"\n`);
    console.log("Saved DEPLOYER_PRIVATE_KEY to .env");
  } else {
    console.log("DEPLOYER_PRIVATE_KEY already exists in .env, not overwriting.");
  }
}

main();
