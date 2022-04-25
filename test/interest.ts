/* eslint-disable node/no-missing-import */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DToken, LendingProtocol, RToken } from "../typechain";
import { daiAddress, wethAddress } from "./utils/config";
import {
  deployContracts,
  deployDaiRTokenAndInitReserve,
  deployWETHRTokenAndInitReserve,
  swapETHForWETHAndApprove,
  swapETHForDai,
  approveAndDepositDai,
  approveDai,
} from "./utils/setup";
import { toRay, wadToRay, wadMul, WAD } from "./utils/units";
import {
  increaseTime,
  SECONDS_PER_MONTH,
  SECONDS_PER_YEAR,
} from "./utils/network";
import { BigNumber } from "ethers";

describe("LendingProtocol: interest rates", () => {
  let signer: SignerWithAddress;
  let user1: SignerWithAddress;
  let LendingProtocol: LendingProtocol;
  let DaiRToken: RToken;
  let DaiDToken: DToken;

  beforeEach(async () => {
    [signer, user1] = await ethers.getSigners();

    ({ LendingProtocol } = await deployContracts());
    ({ RToken: DaiRToken, DToken: DaiDToken } =
      await deployDaiRTokenAndInitReserve(LendingProtocol));
    await deployWETHRTokenAndInitReserve(LendingProtocol);

    const extraEthLquidity = ethers.utils.parseEther("2");
    await swapETHForWETHAndApprove(
      signer,
      extraEthLquidity,
      LendingProtocol.address
    );
    await LendingProtocol.deposit(wethAddress, extraEthLquidity);
  });

  describe("utilisation rate", () => {
    const depositDaiAmount = ethers.utils.parseEther("100");

    it("when there is no deposit and no borrow", async () => {
      const utilisationRate = await LendingProtocol.getUtilisationRate(
        daiAddress
      );

      expect(utilisationRate).to.be.eq(0);
    });

    describe("when there is deposit but not borrow", () => {
      beforeEach(async () => {
        await swapETHForDai(signer, ethers.utils.parseEther("1"));
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

          expect(utilisationRate).to.be.eq(toRay("0.5"));
        });
      });
    });
  });

  describe("interest and borrow rates", () => {
    const depositAmount = ethers.utils.parseEther("100");
    // let depositTime: number;
    // let borrowTime: number;

    beforeEach(async () => {
      await swapETHForDai(signer, ethers.utils.parseEther("1"));
      await approveAndDepositDai(signer, depositAmount, LendingProtocol);
      // depositTime = await getTime();
    });

    [
      {
        borrowAmount: ethers.utils.parseEther("1"),
        utilisationRate: "1%",
        expectedDepositRate: ethers.utils.parseEther("0.000875"),
        expectedBorrowRate: ethers.utils.parseEther("0.03125"),
      },
      {
        borrowAmount: ethers.utils.parseEther("50"),
        utilisationRate: "50%",
        expectedDepositRate: ethers.utils.parseEther("0.04375"),
        expectedBorrowRate: ethers.utils.parseEther("0.0925"),
      },
      {
        borrowAmount: ethers.utils.parseEther("80"),
        utilisationRate: "80%",
        expectedDepositRate: ethers.utils.parseEther("0.07"),
        expectedBorrowRate: ethers.utils.parseEther("0.13"),
      },
      {
        borrowAmount: ethers.utils.parseEther("100"),
        utilisationRate: "100%",
        expectedDepositRate: ethers.utils.parseEther("3.0875"),
        expectedBorrowRate: ethers.utils.parseEther("3.155"),
      },
    ].forEach(
      ({
        borrowAmount,
        utilisationRate,
        expectedDepositRate,
        expectedBorrowRate,
      }) => {
        describe(`when utilisation rate is ${utilisationRate}`, () => {
          beforeEach(async () => {
            await LendingProtocol.borrow(daiAddress, borrowAmount);
            // borrowTime = await getTime();
          });

          it("verify that utilisaction rate is correct", async () => {
            const utilisationRate = await LendingProtocol.getUtilisationRate(
              daiAddress
            );

            expect(utilisationRate).to.be.eq(
              wadToRay(borrowAmount.toString()).div(100)
            );
          });

          it("verify that balances are equal to deposited and borrowed amount", async () => {
            const depositBalance = await DaiRToken.balanceOf(signer.address);
            const debtBalance = await DaiDToken.balanceOf(signer.address);

            expect(depositBalance).to.eq(depositAmount);
            expect(debtBalance).to.eq(borrowAmount);
          });

          [
            {
              addSeconds: 1,
              closeToDelta: 100,
            },
            {
              addSeconds: SECONDS_PER_MONTH,
              // closeToDelta: 1_000_000,
              // closeToDelta: 1_000,
              // closeToDelta: 1_00,
              closeToDelta: 100,
            },
            {
              addSeconds: SECONDS_PER_YEAR,
              // closeToDelta: 1_000_000_000_000,
              // closeToDelta: 1_000_000_000,
              // closeToDelta: 1_000_000,
              closeToDelta: 10_000,
            },
          ].forEach(({ addSeconds, closeToDelta }) => {
            describe(`and ${addSeconds} seconds has passed`, () => {
              beforeEach(async () => {
                await increaseTime(addSeconds);
              });

              it("and deposit balance has increased", async () => {
                // const currentTime = await getTime();
                // const timeDiff = currentTime - depositTime;
                // console.log("TIME DIFF", timeDiff, "add seconds", addSeconds);

                const depositBalance = await DaiRToken.balanceOf(
                  signer.address
                );

                const scaledInterestRate = expectedDepositRate
                  .mul(addSeconds)
                  // .mul(timeDiff)
                  .div(SECONDS_PER_YEAR);

                const expectedInterestIncrease = wadMul(
                  depositAmount,
                  scaledInterestRate.add(WAD)
                );

                expect(depositBalance).to.be.closeTo(
                  expectedInterestIncrease,
                  closeToDelta
                );
              });

              it("and borrow balance has increased", async () => {
                // const currentTime = await getTime();
                // const timeDiff = currentTime - borrowTime;
                // console.log(
                //   "TIME DIFF BORROW",
                //   timeDiff,
                //   "addSeconds",
                //   addSeconds
                // );

                const debtBalance = await DaiDToken.balanceOf(signer.address);

                const scaledBorrowRate = expectedBorrowRate
                  .mul(addSeconds)
                  .div(SECONDS_PER_YEAR);

                const expectedDebtIncrease = wadMul(
                  borrowAmount,
                  scaledBorrowRate.add(WAD)
                );

                expect(debtBalance).to.be.closeTo(
                  expectedDebtIncrease,
                  closeToDelta
                );
              });
            });
          });
        });
      }
    );
  });

  describe("compare intervals with reserve update to continous interest", () => {
    const depositAmount = ethers.utils.parseEther("100");
    // We assume utilistation eq 50%
    const borrowAmount = depositAmount.div(2);
    let depositBalanceWithIntervals: BigNumber;
    // let cumulatedInterest = BigNumber.from(0);

    beforeEach(async () => {
      await swapETHForDai(signer, ethers.utils.parseEther("1"));
      await swapETHForDai(user1, ethers.utils.parseEther("1"));
      await approveAndDepositDai(signer, depositAmount, LendingProtocol);
      // prepare approval for user1
      await approveDai(
        user1,
        LendingProtocol.address,
        ethers.constants.MaxUint256
      );
      await LendingProtocol.borrow(daiAddress, borrowAmount);
    });

    it("intervals with reserve update", async () => {
      for (let i = 0; i < 12; i++) {
        await increaseTime(SECONDS_PER_MONTH);
        // update reserve with 1 WEI from different user
        await LendingProtocol.connect(user1).deposit(
          daiAddress,
          BigNumber.from(1)
        );
      }
      depositBalanceWithIntervals = await DaiRToken.balanceOf(signer.address);
      console.log("depositBalanceWithIntervals", depositBalanceWithIntervals);
    });

    it("one year without reserve update", async () => {
      await increaseTime(SECONDS_PER_YEAR);
      const depositBalanceWithOneInterval = await DaiRToken.balanceOf(
        signer.address
      );
      console.log(
        "depositBalanceWithOneInterval 2",
        depositBalanceWithOneInterval
      );

      expect(depositBalanceWithOneInterval).to.eq(depositBalanceWithIntervals);
    });
  });
});
