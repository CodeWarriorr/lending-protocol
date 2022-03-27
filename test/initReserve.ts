import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Errors, LendingProtocol } from "../typechain";
import { PriceConsumer } from "../typechain";
import { ethMainnetFeedRegistryAddress, wethAddress } from "./utils/config";
import {
  deployContracts,
  defaultCollateralFactor,
  defaultLiquidationIncentive,
  randomValidAddress,
  wethDecimals,
} from "./utils/setup";

describe("LendingProtocol: initReserve", () => {
  let LendingProtocol: LendingProtocol;
  let Errors: Errors;

  beforeEach(async () => {
    ({ Errors, LendingProtocol } = await deployContracts());
  });

  describe("reverts", () => {
    it("when asset is not a contract", async () => {
      await expect(
        LendingProtocol.initReserve(
          randomValidAddress,
          randomValidAddress,
          randomValidAddress,
          defaultCollateralFactor,
          defaultLiquidationIncentive,
          wethDecimals,
          true
        )
      ).to.be.revertedWith(await Errors.ASSET_IS_NOT_A_CONTRACT());
    });
  });

  describe("and init reserve is successful", () => {
    beforeEach(async () => {
      await LendingProtocol.initReserve(
        wethAddress,
        randomValidAddress,
        randomValidAddress,
        defaultCollateralFactor,
        defaultLiquidationIncentive,
        wethDecimals,
        true
      );
    });

    it("reverts init already existing reserve", async () => {
      await expect(
        LendingProtocol.initReserve(
          wethAddress,
          randomValidAddress,
          randomValidAddress,
          defaultCollateralFactor,
          defaultLiquidationIncentive,
          wethDecimals,
          true
        )
      ).to.be.revertedWith(await Errors.RESERVE_INITIALIZED());
    });

    it("gets newly created reserve data", async () => {
      const reserveData = await LendingProtocol.getReserveData(wethAddress);

      expect(reserveData.rTokenAddress).to.eq(randomValidAddress);
      expect(reserveData.collateralFactor.toNumber()).to.eq(
        defaultCollateralFactor
      );
      expect(reserveData.liquidationIncentive.toNumber()).to.eq(
        defaultLiquidationIncentive
      );
      expect(reserveData.isActive).to.eq(true);
    });
  });
});
