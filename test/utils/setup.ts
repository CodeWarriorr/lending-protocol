/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signer } from "ethers";
import { ethers } from "hardhat";
import { LendingProtocol } from "../../typechain";
import {
  ethMainnetFeedRegistryAddress,
  wethAddress,
  ethAddress,
  daiAddress,
  uniRouterAddress,
  erc20Abi,
  wbtcAddress,
} from "./config";

export const defaultCollateralFactor = 75;
export const defaultLiquidationIncentive = 5;
export const randomValidAddress = ethers.Wallet.createRandom().address;
export const wethDecimals = 18;
export const daiDecimals = 18;
export const wbtcDecimals = 8;

export const deployContracts = async () => {
  const ErrorsFactory = await ethers.getContractFactory("Errors");
  const Errors = await ErrorsFactory.deploy();

  const PriceFeedMockFactory = await ethers.getContractFactory("PriceFeedMock");
  const PriceFeedMock = await PriceFeedMockFactory.deploy(randomValidAddress);

  const PriceFeedFactory = await ethers.getContractFactory("PriceFeed");
  const PriceFeed = await PriceFeedFactory.deploy(
    ethMainnetFeedRegistryAddress
  );
  await PriceFeed.updateAssetPriceFeedAddress(wethAddress, ethAddress);

  const LendingProtocolFactory = await ethers.getContractFactory(
    "LendingProtocol"
  );
  const LendingProtocol = await LendingProtocolFactory.deploy(
    PriceFeed.address
  );

  return {
    Errors,
    PriceFeed,
    PriceFeedMock,
    LendingProtocol,
  };
};

const deployRToken = async (
  lendingProtocolAddress: string,
  asset: string,
  name: string,
  symbol: string
) => {
  const RTokenFactory = await ethers.getContractFactory("RToken");
  const RToken = await RTokenFactory.deploy(
    lendingProtocolAddress,
    asset,
    name,
    symbol
  );

  return { RToken };
};

const deployDToken = async (
  lendingProtocolAddress: string,
  asset: string,
  name: string,
  symbol: string
) => {
  const DTokenFactory = await ethers.getContractFactory("DToken");
  const DToken = await DTokenFactory.deploy(
    lendingProtocolAddress,
    asset,
    name,
    symbol
  );

  return { DToken };
};

export const deployWETHRToken = async (lendProtocolAddress: string) => {
  return deployRToken(lendProtocolAddress, wethAddress, "ReserveWETH", "RWETH");
};

export const deployWETHDToken = async (lendingProtocolAddress: string) => {
  return deployDToken(lendingProtocolAddress, wethAddress, "DebtWETH", "DWETH");
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
  const wethAbi = [
    ...erc20Abi,
    "function deposit() external payable",
    "function withdraw(uint wad) external",
  ];

  return new ethers.Contract(wethAddress, wethAbi, signer);
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

export const deployDaiRToken = async (lendingProtocolAddress: string) => {
  return deployRToken(lendingProtocolAddress, daiAddress, "ReserveDAI", "RDAI");
};

export const deployDaiDToken = async (lendingProtocolAddress: string) => {
  return deployDToken(lendingProtocolAddress, daiAddress, "ReserveDAI", "RDAI");
};

export const deployDaiRTokenAndInitReserve = async (
  LendingProtocol: LendingProtocol
) => {
  const { RToken } = await deployDaiRToken(LendingProtocol.address);
  const { DToken } = await deployDaiDToken(LendingProtocol.address);

  await LendingProtocol.initReserve(
    daiAddress,
    RToken.address,
    DToken.address,
    defaultCollateralFactor,
    defaultLiquidationIncentive,
    daiDecimals,
    true
  );

  return { RToken, DToken };
};

export const swapETHForDai = async (
  signer: SignerWithAddress,
  amount: BigNumber
) => {
  const uniRouterAbi = [
    "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[] amounts)",
  ];
  const uniRouter = new ethers.Contract(uniRouterAddress, uniRouterAbi, signer);

  const tx = await uniRouter.swapExactETHForTokens(
    0,
    [wethAddress, daiAddress],
    signer.address,
    ethers.constants.MaxUint256,
    {
      value: amount,
    }
  );
  await tx.wait();
};

export const swapETHForDaiAndDeposit = async (
  signer: SignerWithAddress,
  amount: BigNumber,
  LendingProtocol: LendingProtocol
) => {
  await swapETHForDai(signer, amount);

  const dai = new ethers.Contract(daiAddress, erc20Abi, signer);

  const daiAmount = await dai.balanceOf(signer.address);

  await approveAndDepositDai(signer, daiAmount, LendingProtocol);

  return daiAmount;
};

export const approveAndDepositDai = async (
  signer: SignerWithAddress,
  amount: BigNumber,
  LendingProtocol: LendingProtocol
) => {
  const dai = new ethers.Contract(daiAddress, erc20Abi, signer);

  await dai.approve(LendingProtocol.address, amount);
  await LendingProtocol.connect(signer).deposit(daiAddress, amount);
};

export const approveDai = async (
  signer: SignerWithAddress,
  spender: string,
  amount: BigNumber
) => {
  const dai = new ethers.Contract(daiAddress, erc20Abi, signer);

  await dai.approve(spender, amount);
};

export const deployBtcRToken = async (lendProtocolAddress: string) => {
  return deployRToken(lendProtocolAddress, wbtcAddress, "ReserveWBTC", "RWBTC");
};

export const deployBtcDToken = async (lendProtocolAddress: string) => {
  return deployDToken(lendProtocolAddress, wbtcAddress, "DebtWBTC", "RWBTC");
};

export const deployBtcRTokenAndInitReserve = async (
  LendingProtocol: LendingProtocol
) => {
  const { RToken } = await deployBtcRToken(LendingProtocol.address);
  const { DToken } = await deployBtcDToken(LendingProtocol.address);

  await LendingProtocol.initReserve(
    wbtcAddress,
    RToken.address,
    DToken.address,
    defaultCollateralFactor,
    defaultLiquidationIncentive,
    wbtcDecimals,
    true
  );

  return { RToken, DToken };
};
