/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  DToken,
  Errors,
  LendingProtocol,
  PriceFeed,
  PriceFeedMock,
  RToken,
} from "../typechain";
import { daiAddress, wbtcAddress, wethAddress } from "./utils/config";
import {
  deployContracts,
  defaultCollateralFactor,
  defaultLiquidationIncentive,
  randomValidAddress,
  wethDecimals,
  deployDaiRTokenAndInitReserve,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
  swapETHForDaiAndDeposit,
  swapETHForDai,
  approveAndDepositDai,
  deployBtcRTokenAndInitReserve,
  approveDai,
} from "./utils/setup";

describe("LendingProtocol: interest rates", () => {
  let signer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let LendingProtocol: LendingProtocol;
  let PriceFeed: PriceFeed;
  let PriceFeedMock: PriceFeedMock;
  let Errors: Errors;
  let WethRToken: RToken;
  let WethDToken: DToken;
  let DaiRToken: RToken;
  let DaiDToken: DToken;
  const wethCollateralAmount = ethers.utils.parseEther("100");

  beforeEach(async () => {
    [signer, user1, user2] = await ethers.getSigners();

    ({ LendingProtocol, Errors, PriceFeed, PriceFeedMock } =
      await deployContracts());
    ({ RToken: DaiRToken, DToken: DaiDToken } =
      await deployDaiRTokenAndInitReserve(LendingProtocol));
    ({ RToken: WethRToken, DToken: WethDToken } =
      await deployWETHRTokenAndInitReserve(LendingProtocol));
  });

  describe("utilisation rate", () => {
    const depositDaiAmount = ethers.utils.parseEther("100");
    let rateDecimals: BigNumber;
    beforeEach(async () => {
      rateDecimals = await DaiRToken.getRateDecimals();
    });

    it("when there is no deposit and no borrow", async () => {
      const utilisationRate = await LendingProtocol.getUtilisationRate(
        daiAddress
      );

      expect(utilisationRate).to.be.eq(0);
    });

    describe("when there is deposit but not borrow", () => {
      beforeEach(async () => {
        await swapETHForDai(signer, ethers.utils.parseEther("100"));
        await approveAndDepositDai(signer, depositDaiAmount, LendingProtocol);
      });

      it("and the utilisation is zero", async () => {
        const utilisationRate = await LendingProtocol.getUtilisationRate(
          daiAddress
        );

        expect(utilisationRate).to.be.eq(0);
      });

      describe("when there is deposit and borrow", async () => {
        beforeEach(async () => {
          await LendingProtocol.borrow(daiAddress, depositDaiAmount.div(2));
        });

        it("and the utilisation rate is 50%", async () => {
          const utilisationRate = await LendingProtocol.getUtilisationRate(
            daiAddress
          );

          expect(utilisationRate.div(rateDecimals)).to.be.eq(50);
        });
      });
    });
  });
});
