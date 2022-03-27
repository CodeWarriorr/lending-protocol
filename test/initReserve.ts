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
  // let PriceConsumer: PriceConsumer;
  let LendingProtocol: LendingProtocol;
  let Errors: Errors;
  // const defaultCollateralFactor = 75;
  // const defaultLiquidationIncentive = 5;
  // const randomValidAddress = ethers.Wallet.createRandom().address;

  beforeEach(async () => {
    ({ Errors, LendingProtocol } = await deployContracts());
    // const ErrorsFactory = await ethers.getContractFactory("Errors");
    // Errors = await ErrorsFactory.deploy();
    // const PriceConsumerFactory = await ethers.getContractFactory(
    //   "PriceConsumer"
    // );
    // PriceConsumer = await PriceConsumerFactory.deploy(
    //   ethMainnetFeedRegistryAddress
    // );
    // const LendingProtocolFactory = await ethers.getContractFactory(
    //   "LendingProtocol"
    // );
    // LendingProtocol = await LendingProtocolFactory.deploy(
    //   PriceConsumer.address
    // );
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

      // console.log(reserveData);

      expect(reserveData.rTokenAddress).to.eq(randomValidAddress);
      expect(reserveData.collateralFactor.toNumber()).to.eq(
        defaultCollateralFactor
      );
      expect(reserveData.liquidationIncentive.toNumber()).to.eq(
        defaultLiquidationIncentive
      );
      expect(reserveData.isActive).to.eq(true);

      // expect(reserveData).to.deep.include({
      //   rTokenAddress: randomValidAddress,
      //   collateralFactor: defaultCollateralFactor,
      //   liquidationIncentive: defaultLiquidationIncentive,
      //   isActive: true,
      // });
    });
  });
});
