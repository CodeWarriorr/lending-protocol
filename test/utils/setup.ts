import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { LendingProtocol } from "../../typechain";
// import { Errors, LendingProtocol } from "../../typechain";
// import { PriceConsumer } from "../../typechain";
import {
  ethMainnetFeedRegistryAddress,
  wethAddress,
  ethAddress,
} from "./config";

export const defaultCollateralFactor = 75;
export const defaultLiquidationIncentive = 5;
export const randomValidAddress = ethers.Wallet.createRandom().address;
export const wethDecimals = 18;

export const deployContracts = async () => {
  const ErrorsFactory = await ethers.getContractFactory("Errors");
  const Errors = await ErrorsFactory.deploy();

  const PriceConsumerFactory = await ethers.getContractFactory("PriceConsumer");
  const PriceConsumer = await PriceConsumerFactory.deploy(
    ethMainnetFeedRegistryAddress
  );
  await PriceConsumer.updateFeedPriceAddress(wethAddress, ethAddress);

  const LendingProtocolFactory = await ethers.getContractFactory(
    "LendingProtocol"
  );
  const LendingProtocol = await LendingProtocolFactory.deploy(
    PriceConsumer.address
  );

  return {
    Errors,
    PriceConsumer,
    LendingProtocol,
  };
};

export const deployWETHRToken = async (lendingProtocolAddress: string) => {
  const RTokenFactory = await ethers.getContractFactory("RToken");
  const RToken = await RTokenFactory.deploy(
    lendingProtocolAddress,
    wethAddress,
    "ReserveWETH",
    "RWETH"
  );

  return { RToken };
};

export const deployWETHDToken = async (lendingProtocolAddress: string) => {
  const DTokenFactory = await ethers.getContractFactory("DToken");
  const DToken = await DTokenFactory.deploy(
    lendingProtocolAddress,
    wethAddress,
    "DebtWETH",
    "DWETH"
  );

  return { DToken };
};

export const deployWETHRTokenAndInitReserve = async (
  LendingProtocol: LendingProtocol
) => {
  const { RToken } = await deployWETHRToken(LendingProtocol.address);
  const { DToken } = await deployWETHDToken(LendingProtocol.address);

  await LendingProtocol.initReserve(
    wethAddress,
    RToken.address,
    DToken.address,
    defaultCollateralFactor,
    defaultLiquidationIncentive,
    wethDecimals,
    true
  );

  return { RToken, DToken };
};

export const wethContractWithSigner = (signer: SignerWithAddress) => {
  const wetAbi = [
    "function allowance(address owner, address spender) external view returns (uint256 remaining)",
    "function approve(address spender, uint256 value) external returns (bool success)",
    "function balanceOf(address owner) external view returns (uint256 balance)",
    "function decimals() external view returns (uint8 decimalPlaces)",
    "function name() external view returns (string memory tokenName)",
    "function symbol() external view returns (string memory tokenSymbol)",
    "function totalSupply() external view returns (uint256 totalTokensIssued)",
    "function transfer(address to, uint256 value) external returns (bool success)",
    "function transferFrom(address from, address to, uint256 value) external returns (bool success)",
    "function deposit() external payable",
    "function withdraw(uint wad) external",
  ];

  return new ethers.Contract(wethAddress, wetAbi, signer);
};

export const swapETHForWETH = async (
  signer: SignerWithAddress,
  amount: BigNumber
) => {
  const contract = wethContractWithSigner(signer);
  try {
    const tx = await contract.deposit({
      from: signer.address,
      value: amount,
    });
    await tx.wait();
  } catch (err) {
    console.log(err);
  }
};

export const swapETHForWETHAndApprove = async (
  signer: SignerWithAddress,
  amount: BigNumber,
  spender: string
) => {
  await swapETHForWETH(signer, amount);
  const weth = wethContractWithSigner(signer);
  await weth.approve(spender, amount);
};
