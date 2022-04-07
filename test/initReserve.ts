/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { Errors, LendingProtocol } from "../typechain";
import { wethAddress } from "./utils/config";
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
      const expectedError = await Errors.ASSET_IS_NOT_A_CONTRACT();

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
      ).to.be.revertedWith(expectedError);
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
      const expectedError = await Errors.RESERVE_INITIALIZED();

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
      ).to.be.revertedWith(expectedError);
    });

    it("gets newly created reserve data", async () => {
      const reserveData = await LendingProtocol.getReserveData(wethAddress);

      expect(reserveData.rToken).to.eq(randomValidAddress);
      expect(reserveData.dToken).to.eq(randomValidAddress);
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
