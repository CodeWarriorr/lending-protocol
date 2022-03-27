import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { PriceConsumer } from "../typechain";
import { ethAddress, wethAddress } from "./utils/config";
import { deployContracts } from "./utils/setup";

describe("PriceConsumer", () => {
  let PriceConsumer: PriceConsumer;

  beforeEach(async () => {
    ({ PriceConsumer } = await deployContracts());
  });

  describe("getAssetUsdPrice", () => {
    it("rejects when address is not a supported asset", async () => {
      const randomValidAddress = "0x72AFAECF99C9d9C8215fF44C77B94B99C28741e8";

      await expect(
        PriceConsumer.getAssetUsdPrice(randomValidAddress)
      ).to.be.revertedWith("Feed not found");
    });

    it("returns eth price dumb REMOVE ME", async () => {
      const price = await PriceConsumer.getAssetUsdPrice(
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      );

      expect(price).to.be.instanceOf(Array);
      expect(price[0]).to.be.instanceOf(BigNumber);
      expect(price[0].toNumber()).to.be.greaterThan(0);
      expect(price[1]).to.be.greaterThan(0);
    });

    it("returns eth price", async () => {
      const price = await PriceConsumer.getAssetUsdPrice(ethAddress);

      expect(price).to.be.instanceOf(Array);
      expect(price[0]).to.be.instanceOf(BigNumber);
      expect(price[0].toNumber()).to.be.greaterThan(0);
      expect(price[1]).to.be.greaterThan(0);
    });

    it("returns weth price", async () => {
      const price = await PriceConsumer.getAssetUsdPrice(wethAddress);

      expect(price).to.be.instanceOf(Array);
      expect(price[0]).to.be.instanceOf(BigNumber);
      expect(price[0].toNumber()).to.be.greaterThan(0);
      expect(price[1]).to.be.greaterThan(0);
    });
  });
});
