import { ethers } from "hardhat";

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
