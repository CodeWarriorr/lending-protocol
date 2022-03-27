import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  DToken,
  Errors,
  LendingProtocol,
  PriceConsumer,
  RToken,
} from "../typechain";
import { wbtcAddress, wethAddress } from "./utils/config";
import {
  defaultCollateralFactor,
  deployContracts,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
} from "./utils/setup";

describe("LendingProtocol: borrow", async () => {
  let LendingProtocol: LendingProtocol;
  let PriceConsumer: PriceConsumer;
  let Errors: Errors;
  let RToken: RToken;
  let DToken: DToken;

  beforeEach(async () => {
    ({ LendingProtocol, Errors, PriceConsumer } = await deployContracts());
    ({ RToken, DToken } = await deployWETHRTokenAndInitReserve(
      LendingProtocol
    ));
  });

  describe("reverts", () => {
    it("when amount is zero", async () => {
      await expect(LendingProtocol.borrow(wethAddress, 0)).to.be.revertedWith(
        await Errors.ZERO_AMOUNT()
      );
    });

    it("when reserve is not active", async () => {
      await expect(LendingProtocol.borrow(wbtcAddress, 1)).to.be.revertedWith(
        await Errors.RESERVE_INACTIVE()
      );
    });

    it("when user has no liquidity", async () => {
      await expect(LendingProtocol.borrow(wethAddress, 1)).to.be.revertedWith(
        await Errors.LIQUIDITY_LESS_THAN_BORROW()
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

    it("reverts when user has not enough liquidity", async () => {
      await expect(
        LendingProtocol.borrow(wethAddress, initialWethDepositAmount)
      ).to.be.revertedWith(await Errors.LIQUIDITY_LESS_THAN_BORROW());
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
        const borrowedAssetInUsd = await PriceConsumer.getAssetUsdPrice(
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
