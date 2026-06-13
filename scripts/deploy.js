import hre from "hardhat";

async function main() {
  const LiminalSpaceGame = await hre.ethers.getContractFactory("LiminalSpaceGame");
  console.log("Deploying LiminalSpaceGame...");
  const game = await LiminalSpaceGame.deploy();
  await game.waitForDeployment();
  const address = await game.getAddress();
  console.log("LiminalSpaceGame deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
