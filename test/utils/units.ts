import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export const WAD = ethers.utils.parseUnits("1", 18);
export const RAY = ethers.utils.parseUnits("1", 27);

export const toWad = (amount: string | number) => {
  return ethers.utils.parseUnits(amount.toString(), "18");
};

export const fromWad = (amount: string | number) => {
  return ethers.utils.formatUnits(amount.toString(), "18");
};

export const toRay = (amount: string | number) => {
  return ethers.utils.parseUnits(amount.toString(), "27");
};

export const fromRay = (amount: string | number) => {
  return ethers.utils.formatUnits(amount.toString(), "27");
};

export const wadToRay = (amount: string | number) => {
  return ethers.utils.parseUnits(amount.toString(), "9");
};

export const rayToWad = (amount: string | number) => {
  return ethers.utils.formatUnits(amount.toString(), "9");
};

export const wadMul = (a: BigNumber, b: BigNumber) => {
  return a.mul(b).div(WAD);
};

export const rayMul = (a: BigNumber, b: BigNumber) => {
  return a.mul(b).div(RAY);
};
