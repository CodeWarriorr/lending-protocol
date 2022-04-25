/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { Errors, LendingProtocol, PriceFeed, RToken } from "../typechain";
import { wbtcAddress, wethAddress } from "./utils/config";
import {
  defaultCollateralFactor,
  deployContracts,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
} from "./utils/setup";

describe("LendingProtocol: deposit", async () => {
  let LendingProtocol: LendingProtocol;
  let PriceFeed: PriceFeed;
  let Errors: Errors;
  let RToken: RToken;

  beforeEach(async () => {
    ({ LendingProtocol, Errors, PriceFeed } = await deployContracts());
    ({ RToken } = await deployWETHRTokenAndInitReserve(LendingProtocol));
  });

  describe("reverts", () => {
    it("when amount is zero", async () => {
      const expectedError = await Errors.ZERO_AMOUNT();

      await expect(LendingProtocol.deposit(wethAddress, 0)).to.be.revertedWith(
        expectedError
      );
    });

    it("when reserve is not initialized", async () => {
      const expectedError = await Errors.RESERVE_INACTIVE();

      await expect(LendingProtocol.deposit(wbtcAddress, 1)).to.be.revertedWith(
        expectedError
      );
    });

    it("when user has no allowance or asset balance", async () => {
      await expect(LendingProtocol.deposit(wethAddress, 1)).to.be.revertedWith(
        "SafeERC20: low-level call failed"
      );
    });

    describe("and user has allowance and asset asset balance", () => {
      let signer: SignerWithAddress;
      const amountInEth = "10";
      const amount = ethers.utils.parseEther(amountInEth);

      beforeEach(async () => {
        [signer] = await ethers.getSigners();
        await swapETHForWETHAndApprove(signer, amount, LendingProtocol.address);
      });

      describe("and successfuly deposits asset", () => {
        beforeEach(async () => {
          await LendingProtocol.deposit(wethAddress, amount);
        });

        it("and user receives rToken", async () => {
          const balanceAfter = await RToken.balanceOf(signer.address);
          expect(balanceAfter).to.eq(amount); // TODO: this prob will change with intrest
        });

        it("and adds rToken to user data", async () => {
          const userData = await LendingProtocol.getUserData(signer.address);
          expect(userData.reserves.length).to.eq(1);
          expect(userData.reserves).to.deep.eq([wethAddress]);
        });

        it("and user has liquidity equal to the only deposit", async () => {
          const userLiquidity = await LendingProtocol.getUserLiquidity(
            signer.address
          );
          const assetUsdPrice = await PriceFeed.getAssetUsdPrice(
            await RToken.getUnderlyingAsset()
          );

          const expectedLiquidity = BigNumber.from(amountInEth)
            .mul(assetUsdPrice[0])
            .mul(defaultCollateralFactor)
            .div(100);

          expect(userLiquidity).to.be.eq(expectedLiquidity);
        });
      });
    });
  });
});
