import { ethers } from "hardhat";

export async function increaseTime(x: string | number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [x]);
  await ethers.provider.send("evm_mine", []);
}

export async function advanceBlock(x: number): Promise<void> {
  for (let i = 0; i < x; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

export async function getTime(): Promise<number> {
  const latestBlock = await ethers.provider.getBlock("latest");
  return latestBlock.timestamp;
}

export async function getBlockTime(
  blockNumber: string | number
): Promise<number> {
  const latestBlock = await ethers.provider.getBlock(blockNumber);
  return latestBlock.timestamp;
}
