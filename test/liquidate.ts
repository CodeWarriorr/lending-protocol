/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  DToken,
  Errors,
  LendingProtocol,
  PriceFeedMock,
  RToken,
} from "../typechain";
import { daiAddress, wbtcAddress, wethAddress } from "./utils/config";
import {
  deployContracts,
  randomValidAddress,
  deployDaiRTokenAndInitReserve,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
  swapETHForDaiAndDeposit,
  swapETHForDai,
  deployBtcRTokenAndInitReserve,
  approveDai,
} from "./utils/setup";

describe("LendingProtocol: liquidate", () => {
  let signer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let LendingProtocol: LendingProtocol;
  let PriceFeedMock: PriceFeedMock;
  let Errors: Errors;
  let WethRToken: RToken;
  let DaiDToken: DToken;
  const wethCollateralAmount = ethers.utils.parseEther("100");

  beforeEach(async () => {
    [signer, user1, user2] = await ethers.getSigners();

    ({ LendingProtocol, Errors, PriceFeedMock } = await deployContracts());
    ({ DToken: DaiDToken } = await deployDaiRTokenAndInitReserve(
      LendingProtocol
    ));
    ({ RToken: WethRToken } = await deployWETHRTokenAndInitReserve(
      LendingProtocol
    ));

    await swapETHForWETHAndApprove(
      signer,
      wethCollateralAmount,
      LendingProtocol.address
    );
    await LendingProtocol.deposit(wethAddress, wethCollateralAmount);

    await swapETHForDaiAndDeposit(user1, wethCollateralAmount, LendingProtocol);
  });

  describe("reverts", () => {
    it("when collateral is not active", async () => {
      const expectedError = await Errors.RESERVE_INACTIVE();

      await expect(
        LendingProtocol.liquidate(
          wbtcAddress,
          randomValidAddress,
          randomValidAddress,
          1
        )
      ).to.be.revertedWith(expectedError);
    });

    it("when user has not deposited specifies collateral asset", async () => {
      await deployBtcRTokenAndInitReserve(LendingProtocol);

      const expectedError = await Errors.NO_BORROWED_ASSET();

      await expect(
        LendingProtocol.liquidate(wethAddress, daiAddress, signer.address, 1)
      ).to.be.revertedWith(expectedError);
    });

    it("when user has not borrowed specified debt asset", async () => {
      const expectedError = await Errors.NO_BORROWED_ASSET();

      await expect(
        LendingProtocol.liquidate(wethAddress, daiAddress, signer.address, 1)
      ).to.be.revertedWith(expectedError);
    });

    it("when user liquidity is positive", async () => {
      await LendingProtocol.borrow(daiAddress, ethers.utils.parseEther("1"));

      const expectedError = await Errors.LIQUIDITY_POSITIVE();

      await expect(
        LendingProtocol.liquidate(wethAddress, daiAddress, signer.address, 1)
      ).to.be.revertedWith(expectedError);
    });
  });

  describe("and user has debt", () => {
    beforeEach(async () => {
      await LendingProtocol.updatePriceFeed(PriceFeedMock.address);
      // init high ether price to allow any borrow
      await PriceFeedMock.setAssetUsdPrice(
        wethAddress,
        ethers.utils.parseUnits("3000", 6)
      );
      await PriceFeedMock.setAssetUsdPrice(
        daiAddress,
        ethers.utils.parseUnits("1", 6)
      );
      // borrow just above 100 * 0.75
      await LendingProtocol.borrow(daiAddress, ethers.utils.parseEther("800"));
      // set price of ether to 10 usd for easy math
      await PriceFeedMock.setAssetUsdPrice(
        wethAddress,
        ethers.utils.parseUnits("10", 6)
      );
    });

    it("when liquidity is below zero", async () => {
      const userLiquidity = await LendingProtocol.getUserLiquidity(
        signer.address
      );

      expect(userLiquidity.toNumber()).to.be.lessThan(0);
    });

    describe("reverts", () => {
      it("when liquidator funds transfer fails", async () => {
        await expect(
          LendingProtocol.connect(user1).liquidate(
            wethAddress,
            daiAddress,
            signer.address,
            ethers.constants.MaxUint256
            // ethers.utils.parseUnits("725", 6)
          )
        ).to.be.revertedWith("Dai/insufficient-balance");
      });
    });

    describe("and liquidator has funds that are approved", () => {
      let userCollateralBalanceBefore: BigNumber;
      beforeEach(async () => {
        userCollateralBalanceBefore = await WethRToken.balanceOf(
          signer.address
        );

        await swapETHForDai(user1, ethers.utils.parseEther("100"));

        await approveDai(
          user1,
          LendingProtocol.address,
          ethers.constants.MaxUint256
        );
      });

      describe("and user debt is fully liquidated and collateral is partialy liquidated", () => {
        const expectedCollateralWithBonusLiquidation =
          ethers.utils.parseEther("84");

        beforeEach(async () => {
          await LendingProtocol.connect(user1).liquidate(
            wethAddress,
            daiAddress,
            signer.address,
            ethers.constants.MaxUint256
          );
        });

        it("user collateral balance has decreased", async () => {
          const userCollateralBalance = await WethRToken.balanceOf(
            signer.address
          );

          expect(
            userCollateralBalanceBefore.sub(
              expectedCollateralWithBonusLiquidation
            )
          ).to.be.closeTo(userCollateralBalance, 1_000_000_000_000);
        });

        it("user debt balance is zero", async () => {
          const userDebtBalance = await DaiDToken.balanceOf(signer.address);

          expect(userDebtBalance).to.be.eq(0);
        });

        it("liquidator collateral balance has increased", async () => {
          const liquidatorCollateralBalance = await WethRToken.balanceOf(
            user1.address
          );

          expect(liquidatorCollateralBalance).to.closeTo(
            expectedCollateralWithBonusLiquidation,
            500_000_000_000
          );
        });

        it("debt asset address is removed from user data", async () => {
          const { debts, reserves } = await LendingProtocol.getUserData(
            signer.address
          );

          expect(reserves).to.include(wethAddress);
          expect(debts).to.not.include(daiAddress);
        });
      });

      describe("and user debt is partialy liquidated and collateral is liquidated accordingly", () => {
        const expectedCollateralWithBonusLiquidation =
          ethers.utils.parseEther("42");

        beforeEach(async () => {
          await LendingProtocol.connect(user1).liquidate(
            wethAddress,
            daiAddress,
            signer.address,
            ethers.utils.parseEther("400")
          );
        });

        it("user collateral balance has decreased", async () => {
          const userCollateralBalance = await WethRToken.balanceOf(
            signer.address
          );

          expect(
            userCollateralBalanceBefore.sub(
              expectedCollateralWithBonusLiquidation
            )
          ).to.be.eq(userCollateralBalance);
        });

        it("user debt balance is lower", async () => {
          const userDebtBalance = await DaiDToken.balanceOf(signer.address);

          expect(userDebtBalance).to.be.closeTo(
            ethers.utils.parseEther("400"),
            10_000_000_000_000
          );
        });

        it("liquidator collateral balance has increased", async () => {
          const liquidatorCollateralBalance = await WethRToken.balanceOf(
            user1.address
          );

          expect(liquidatorCollateralBalance).to.eq(
            expectedCollateralWithBonusLiquidation
          );
        });

        it("user liquidity is positive", async () => {
          const userLiquidity = await LendingProtocol.getUserLiquidity(
            signer.address
          );

          expect(userLiquidity.toNumber()).to.be.greaterThan(0);
        });

        it("debt or reserve asset address is NOT removed from user data", async () => {
          const { debts, reserves } = await LendingProtocol.getUserData(
            signer.address
          );

          expect(reserves).to.include(wethAddress);
          expect(debts).to.include(daiAddress);
        });
      });

      describe("and user has not enough collateral and is fully liquidated", () => {
        const expectedCollateralWithBonusLiquidation = wethCollateralAmount;

        beforeEach(async () => {
          await PriceFeedMock.setAssetUsdPrice(
            wethAddress,
            ethers.utils.parseUnits("5", 6)
          );

          await LendingProtocol.connect(user1).liquidate(
            wethAddress,
            daiAddress,
            signer.address,
            ethers.constants.MaxUint256
          );
        });

        it("user collateral balance is zero", async () => {
          const userCollateralBalance = await WethRToken.balanceOf(
            signer.address
          );

          expect(userCollateralBalance).to.be.eq(0);
        });

        it("user debt balance is zero", async () => {
          const userDebtBalance = await DaiDToken.balanceOf(signer.address);

          expect(userDebtBalance).to.be.eq(0);
        });

        it("liquidator collateral balance is now equal to original collateral deposit", async () => {
          const liquidatorCollateralBalance = await WethRToken.balanceOf(
            user1.address
          );

          expect(liquidatorCollateralBalance).to.eq(
            expectedCollateralWithBonusLiquidation
          );
        });

        it("user liquidity is zero", async () => {
          const userLiquidity = await LendingProtocol.getUserLiquidity(
            signer.address
          );

          expect(userLiquidity.toNumber()).to.eq(0);
        });

        it("debt or reserve asset address is removed from user data", async () => {
          const { debts, reserves } = await LendingProtocol.getUserData(
            signer.address
          );

          expect(reserves).to.not.include(wethAddress);
          expect(debts).to.not.include(daiAddress);
        });
      });
    });
    // describe("", () => {});
  });
});
