import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { Errors, LendingProtocol, PriceConsumer, RToken } from "../typechain";
import { wbtcAddress, wethAddress } from "./utils/config";
import {
  defaultCollateralFactor,
  deployContracts,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
} from "./utils/setup";

describe("LendingProtocol: deposit", async () => {
  let LendingProtocol: LendingProtocol;
  let PriceConsumer: PriceConsumer;
  let Errors: Errors;
  let RToken: RToken;

  beforeEach(async () => {
    ({ LendingProtocol, Errors, PriceConsumer } = await deployContracts());
    ({ RToken } = await deployWETHRTokenAndInitReserve(LendingProtocol));
  });

  describe("reverts", () => {
    it("when amount is zero", async () => {
      await expect(LendingProtocol.deposit(wethAddress, 0)).to.be.revertedWith(
        await Errors.ZERO_AMOUNT()
      );
    });

    it("when reserve is not initialized", async () => {
      await expect(LendingProtocol.deposit(wbtcAddress, 1)).to.be.revertedWith(
        await Errors.RESERVE_INACTIVE()
      );
    });

    it("when user has no allowance or asset balance", async () => {
      await expect(LendingProtocol.deposit(wethAddress, 1)).to.be.revertedWith(
        "SafeERC20: low-level call failed"
      );
    });

    describe("and user has allowance and asset asset balance", () => {
      let signer: SignerWithAddress;
      const amountInEth = "100";
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
          // expect(userData.reserves).to.deep.eq([RToken.address]);
          expect(userData.reserves).to.deep.eq([wethAddress]);
        });

        it("and user has liquidity equal to the only deposit", async () => {
          const userLiquidity = await LendingProtocol.getUserLiquidity(
            signer.address
          );
          // expect(userLiquidity).to.eq(amount);
          const assetUsdPrice = await PriceConsumer.getAssetUsdPrice(
            await RToken.getUnderlyingAsset()
          );
          console.log("assetUsdPrice", assetUsdPrice);

          const expectedLiquidity = BigNumber.from(amountInEth)
            .mul(assetUsdPrice[0])
            .mul(defaultCollateralFactor)
            .div(100);
          // TODO: make math work
          // expect(userLiquidity).to.be.closeTo(expectedLiquidity, 100);
          expect(userLiquidity).to.be.eq(expectedLiquidity);
          // expect(false).to.eq(true);
          console.log("userLiquidity", userLiquidity.toString());
        });
      });

      // it("successfuly deposits asset and adds rToken to user data", async () => {
      //   await LendingProtocol.deposit(wethAddress, amount);

      //   const userData = await LendingProtocol.getUserData(signer.address);
      //   expect(userData.reserves.length).to.eq(1);
      //   expect(userData.reserves).to.deep.eq([RToken.address]);

      //   // TODO: we need to check more things probably, like intrest reate
      // });
    });
  });
});
