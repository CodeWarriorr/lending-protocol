/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { DToken, Errors, LendingProtocol, PriceFeed } from "../typechain";
import { wbtcAddress, wethAddress } from "./utils/config";
import {
  defaultCollateralFactor,
  deployContracts,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
} from "./utils/setup";

describe("LendingProtocol: borrow", async () => {
  let LendingProtocol: LendingProtocol;
  let PriceFeed: PriceFeed;
  let Errors: Errors;
  let DToken: DToken;

  beforeEach(async () => {
    ({ LendingProtocol, Errors, PriceFeed } = await deployContracts());
    ({ DToken } = await deployWETHRTokenAndInitReserve(LendingProtocol));
  });

  describe("reverts", () => {
    // it("TEST DELETE ME", async () => {

    // });

    it("when amount is zero", async () => {
      const expectedError = await Errors.ZERO_AMOUNT();

      await expect(LendingProtocol.borrow(wethAddress, 0)).to.be.revertedWith(
        expectedError
      );
    });

    it("when reserve is not active", async () => {
      const expectedError = await Errors.RESERVE_INACTIVE();

      await expect(LendingProtocol.borrow(wbtcAddress, 1)).to.be.revertedWith(
        expectedError
      );
    });

    it("when user has no liquidity", async () => {
      const expectedError = await Errors.LIQUIDITY_LESS_THAN_BORROW();

      await expect(LendingProtocol.borrow(wethAddress, 1)).to.be.revertedWith(
        expectedError
      );
    });
  });

  describe("and user has enough liquidity", async () => {
    const initialWethDepositAmount = ethers.utils.parseEther("100");
    const [signer] = await ethers.getSigners();
    beforeEach(async () => {
      await swapETHForWETHAndApprove(
        signer,
        initialWethDepositAmount,
        LendingProtocol.address
      );
      await LendingProtocol.deposit(wethAddress, initialWethDepositAmount);
    });

    // TODO: case for enough liquidity but no enough asset to borrow !

    it("reverts when user has not enough liquidity", async () => {
      const expectedError = await Errors.LIQUIDITY_LESS_THAN_BORROW();

      await expect(
        LendingProtocol.borrow(wethAddress, initialWethDepositAmount)
      ).to.be.revertedWith(expectedError);
    });

    describe("and user has enough liquidity", () => {
      const safeToBorrowAmount = initialWethDepositAmount
        .mul(100)
        .div(defaultCollateralFactor - 5);
      let borrowedAmountInUsd: BigNumber;
      let userLiquidityBefore: BigNumber;

      beforeEach(async () => {
        userLiquidityBefore = await LendingProtocol.getUserLiquidity(
          signer.address
        );
        await LendingProtocol.borrow(wethAddress, safeToBorrowAmount);
        const borrowedAssetInUsd = await PriceFeed.getAssetUsdPrice(
          wethAddress
        );
        borrowedAmountInUsd = borrowedAssetInUsd[0]
          .mul(safeToBorrowAmount)
          .div(BigNumber.from(10).pow(18));
      });

      it("user receives Debt Token", async () => {
        const dTokenBalance = await DToken.balanceOf(signer.address);

        expect(dTokenBalance).to.be.eq(safeToBorrowAmount);
      });

      it("user liquidity has deacreased by proper amount", async () => {
        const userLiquidityAfter = await LendingProtocol.getUserLiquidity(
          signer.address
        );

        expect(userLiquidityAfter).to.be.closeTo(
          userLiquidityBefore.sub(borrowedAmountInUsd),
          1000
        );
      });
    });
  });
});
