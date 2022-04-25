//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "./interfaces/IPriceFeed.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./tokens/RToken.sol";
import "./tokens/DToken.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./libraries/Errors.sol";
import "./libraries/WadRayMath.sol";
import "./libraries/PercentageMath.sol";

contract LendingProtocol is Ownable {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;
    using PercentageMath for uint256;

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    struct ReserveData {
        RToken rToken; // Reserve ERC20 Token
        DToken dToken; // Debt ERC20 Token
        uint256 collateralFactor; // 100% = 100, 75% = 75 // TODO: convert to percentage math
        uint256 liquidationIncentive; // 5% = 5 // TODO: convert to percentage math
        uint256 interestIndex; // Cumulative interest multiplier. Init with one ray.
        uint256 borrowIndex; // Cumulative borrow multiplier. Init with one ray.
        uint256 interestRate; // Init with one ray;
        uint256 borrowRate; // Init with one ray;
        uint256 utilisationRateThreshold; // TODO: Make sure that its renamed everywhere from rateThreshold
        uint256 interestRateBase; // In ray
        uint256 interestRateSlope1; // In ray
        uint256 interestRateSlope2; // In ray
        uint256 borrowRateBase; // In ray
        uint256 borrowRateSlope1; // In ray
        uint256 borrowRateSlope2; // In ray
        uint40 lastUpdateTimestamp; // uint40 has 34K-year-till-overflow
        uint8 decimals; // Underlying Asset Decimals
        bool isActive;
    }
    mapping(address => ReserveData) private _reserves;

    struct UserData {
        address[] reserves;
        address[] debts;
    }
    mapping(address => UserData) private _users;

    IPriceFeed internal priceFeed;

    event Deposit(
        address indexed reserve,
        address indexed user,
        uint256 amount
    );
    event Borrow(address indexed reserve, address indexed user, uint256 amount);
    event Liquidation(
        address indexed collateral,
        address indexed debt,
        address indexed user,
        uint256 liquidatedCollateral,
        uint256 debtCovered,
        address liquidator
    );

    constructor(IPriceFeed _priceFeed) {
        priceFeed = _priceFeed;
    }

    /**
     * @dev
     */
    function updatePriceFeed(IPriceFeed _priceFeed) external onlyOwner {
        priceFeed = _priceFeed;
    }

    /**
     * @dev
     */
    function initReserve(
        address asset,
        address rTokenAddress,
        address dTokenAddress,
        uint256 collateralFactor,
        uint256 liquidationIncentive,
        uint8 decimals,
        bool isActive
    ) external onlyOwner {
        require(Address.isContract(asset), Errors.ASSET_IS_NOT_A_CONTRACT);
        require(
            address(_reserves[asset].rToken) == address(0),
            Errors.RESERVE_INITIALIZED
        );

        ReserveData storage reserve = _reserves[asset];
        reserve.rToken = RToken(rTokenAddress);
        reserve.dToken = DToken(dTokenAddress);
        reserve.collateralFactor = collateralFactor;
        reserve.liquidationIncentive = liquidationIncentive;

        reserve.decimals = decimals; // TODO: convert to ONE UNIT and make WadRayMath count unitMul, unitDiv AND probably rename to UnitMath
        reserve.isActive = isActive;

        // Setup initial interest and borrow indexing values to ONE
        reserve.interestIndex = WadRayMath.ray();
        reserve.borrowIndex = WadRayMath.ray();

        // Rate threshold for slope2 kick in
        reserve.utilisationRateThreshold = WadRayMath.ray().percentMul(8000); // 80%
        // Interest rate params
        reserve.interestRateBase = 0;
        reserve.interestRateSlope1 = WadRayMath.ray().percentMul(700); // 7%
        reserve.interestRateSlope2 = WadRayMath.ray().percentMul(30000); // 300 %
        // Borrow rate params
        reserve.borrowRateBase = WadRayMath.ray().percentMul(300); // 3%
        reserve.borrowRateSlope1 = WadRayMath.ray().percentMul(1000); // 10%
        reserve.borrowRateSlope2 = WadRayMath.ray().percentMul(30000); // 300 %

        // Init update timestamp
        reserve.lastUpdateTimestamp = uint40(block.timestamp);
    }

    /**
     * @dev
     */
    function getReserveData(address asset)
        external
        view
        returns (ReserveData memory)
    {
        return _reserves[asset];
    }

    /**
     * @dev
     */
    function getInterestIndex(address asset) external view returns (uint256) {
        return _calculateInterestIndex(_reserves[asset]);
    }

    /**
     * @dev
     */
    function getBorrowIndex(address asset) external view returns (uint256) {
        return _calculateBorrowIndex(_reserves[asset]);
    }

    /**
     * @dev
     */
    function deposit(address asset, uint256 amount) external {
        ReserveData storage reserve = _reserves[asset];

        require(amount != 0, Errors.ZERO_AMOUNT);
        require(reserve.isActive, Errors.RESERVE_INACTIVE);

        _calculateIndexes(reserve);
        _calculateRates(reserve, amount, 0, 0, 0);

        IERC20(asset).safeTransferFrom(
            msg.sender,
            address(reserve.rToken),
            amount
        );

        bool isNewReserve = reserve.rToken.mint(
            msg.sender,
            amount,
            reserve.interestIndex
        );

        if (isNewReserve) {
            UserData storage user = _users[msg.sender];
            user.reserves.push(asset);
        }

        emit Deposit(asset, msg.sender, amount);
    }

    /**
     * @dev
     */
    function getUserData(address user) public view returns (UserData memory) {
        return _users[user];
    }

    /**
     * @dev count liquidity portion of reserve balance
     */
    function _liquidityForReserve(ReserveData storage reserve, uint256 balance)
        internal
        view
        returns (uint256)
    {
        // TODO: make this percent math ?
        return (balance * reserve.collateralFactor) / 100;
    }

    /**
     * @dev
     */
    function getUserLiquidity(address _user) public view returns (int256) {
        UserData storage user = _users[_user];

        uint256 usdReserveBalance = 0;
        for (uint256 i = 0; i < user.reserves.length; i++) {
            address asset = user.reserves[i];
            ReserveData storage reserve = _reserves[asset];
            uint256 balance = reserve.rToken.balanceOf(_user);
            (uint256 price, ) = priceFeed.getAssetUsdPrice(asset);
            uint256 liquidityBalance = _liquidityForReserve(reserve, balance);
            usdReserveBalance +=
                (liquidityBalance * price) /
                10**reserve.decimals;
        }

        uint256 usdDebtBalance = 0;
        for (uint256 i = 0; i < user.debts.length; i++) {
            address asset = user.debts[i];
            ReserveData storage reserve = _reserves[asset];
            uint256 debtBalance = reserve.dToken.balanceOf(_user);
            (uint256 price, ) = priceFeed.getAssetUsdPrice(asset);
            usdDebtBalance += (debtBalance * price) / 10**reserve.decimals;
        }

        return int256(usdReserveBalance) - int256(usdDebtBalance);
    }

    /**
     * @dev
     */
    function borrow(address asset, uint256 amount) external {
        ReserveData storage reserve = _reserves[asset];

        require(amount != 0, Errors.ZERO_AMOUNT);
        require(reserve.isActive, Errors.RESERVE_INACTIVE);

        (uint256 price, ) = priceFeed.getAssetUsdPrice(asset);
        uint256 assetValueInUsd = (amount * price) / 10**reserve.decimals;

        int256 userLiquidity = getUserLiquidity(msg.sender);
        require(
            userLiquidity < 0 || assetValueInUsd < uint256(userLiquidity),
            Errors.LIQUIDITY_LESS_THAN_BORROW
        );

        _calculateIndexes(reserve);
        _calculateRates(reserve, 0, 0, amount, 0);

        bool isNewDebt = reserve.dToken.mint(
            msg.sender,
            amount,
            reserve.borrowIndex
        );
        if (isNewDebt) {
            UserData storage user = _users[msg.sender];
            user.debts.push(asset);
        }

        reserve.rToken.transferUnderlyingAsset(msg.sender, amount);

        emit Borrow(asset, msg.sender, amount);
    }

    /**
     * @dev
     */
    function _getCollateralToLiquidate(
        ReserveData storage collateral,
        ReserveData storage debt,
        address collateralAsset,
        address debtAsset,
        uint256 debtAmount,
        uint256 userCollateralBalance
    ) internal view returns (uint256, uint256) {
        (uint256 debtPrice, ) = priceFeed.getAssetUsdPrice(debtAsset);
        (uint256 collateralPrice, ) = priceFeed.getAssetUsdPrice(
            collateralAsset
        );

        uint256 collateralDecimals = 10**collateral.decimals;

        // TODO: ReWrite this to be more clear
        uint256 collateralAmount = (debtAmount *
            debtPrice *
            collateralDecimals *
            (100 + collateral.liquidationIncentive)) /
            100 /
            (collateralPrice * collateralDecimals);

        if (collateralAmount > userCollateralBalance) {
            collateralAmount = userCollateralBalance;
            // TODO: do we want to recalculate debt amount?
        }

        return (collateralAmount, debtAmount);
    }

    /**
     * @dev
     */
    function _executeLiquidationTransfers(
        ReserveData storage collateral,
        ReserveData storage debt,
        address user,
        uint256 collateralAmount,
        uint256 debtAmountNeeded
    ) internal {
        bool isZeroCollateralBalance = collateral.rToken.transferLiquidation(
            user,
            msg.sender,
            collateralAmount
        );

        UserData storage userData = _users[user];
        // Remove collateral address from user data when fully liquidated
        if (isZeroCollateralBalance) {
            _removeAddressFromArray(
                userData.reserves,
                collateral.rToken.getUnderlyingAsset()
            );
        }

        bool isZeroDebtBalance = debt.dToken.burn(user, debtAmountNeeded, debt.borrowIndex);
        // Remove debt address from user data when fully repaid
        if (isZeroDebtBalance) {
            _removeAddressFromArray(
                userData.debts,
                debt.dToken.getUnderlyingAsset()
            );
        }

        IERC20(debt.dToken.getUnderlyingAsset()).safeTransferFrom(
            msg.sender,
            address(debt.rToken),
            debtAmountNeeded
        );
    }

    /**
     * @dev
     */
    function _removeAddressFromArray(
        address[] storage array,
        address addressToRemove
    ) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == addressToRemove) {
                array[i] = array[array.length - 1];
                array.pop();

                return;
            }
        }
    }

    /**
     * @dev
     */
    function liquidate(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtAmount
    ) external {
        ReserveData storage collateral = _reserves[collateralAsset];
        ReserveData storage debt = _reserves[debtAsset];

        require(collateral.isActive, Errors.RESERVE_INACTIVE);

        uint256 userCollateralBalance = collateral.rToken.balanceOf(user);
        require(userCollateralBalance > 0, Errors.NO_RESERVE_ASSET);

        uint256 userDebtBalance = debt.dToken.balanceOf(user);
        require(userDebtBalance > 0, Errors.NO_BORROWED_ASSET);

        int256 userLiquidity = getUserLiquidity(user);
        require(userLiquidity < 0, Errors.LIQUIDITY_POSITIVE);

        uint256 maxDebtAmount = debtAmount > userDebtBalance
            ? userDebtBalance
            : debtAmount;

        (
            uint256 collateralAmount,
            uint256 debtAmountNeeded
        ) = _getCollateralToLiquidate(
                collateral,
                debt,
                collateralAsset,
                debtAsset,
                maxDebtAmount,
                userCollateralBalance
            );

        // Recalculate only debt reserve, collateral stays the same as we are sending RToken for now
        _calculateIndexes(debt);
        _calculateRates(debt, 0, 0, 0, debtAmountNeeded);

        _executeLiquidationTransfers(
            collateral,
            debt,
            user,
            collateralAmount,
            debtAmountNeeded
        );

        emit Liquidation(
            collateralAsset,
            debtAsset,
            user,
            collateralAmount,
            debtAmountNeeded,
            msg.sender
        );
    }

    /**
     * @dev
     */
    function getUtilisationRate(address asset) external view returns (uint256) {
        ReserveData storage reserve = _reserves[asset];

        return _calculateUtilisationRate(reserve, 0, 0, 0, 0);
    }

    /**
     * @dev
     */
    function _calculateRateBelowTreshold(
        uint256 utilisationRate,
        uint256 rateThreshold,
        uint256 base,
        uint256 slope1
    ) internal pure returns (uint256) {
        uint256 slope1Factor = utilisationRate.rayDiv(rateThreshold);

        return base + slope1Factor.rayMul(slope1);
    }

    /**
     * @dev
     */
    function _calculateRateAboveThreshold(
        uint256 utilisationRate,
        uint256 rateThreshold,
        uint256 base,
        uint256 slope1,
        uint256 slope2
    ) internal pure returns (uint256) {
        uint256 slope1Factor = utilisationRate.rayDiv(rateThreshold);
        uint256 slope2Factor = (utilisationRate - rateThreshold).rayDiv(
            WadRayMath.ray() - rateThreshold
        );

        return base + slope1Factor.rayMul(slope1) + slope2Factor.rayMul(slope2);
    }

    /**
     * @dev
     */
    function _calculateRate(
        uint256 utilisationRate,
        uint256 rateThreshold,
        uint256 base,
        uint256 slope1,
        uint256 slope2
    ) internal pure returns (uint256) {
        uint256 rate;
        if (utilisationRate <= rateThreshold) {
            rate = _calculateRateBelowTreshold(
                utilisationRate,
                rateThreshold,
                base,
                slope1
            );
        } else {
            rate = _calculateRateAboveThreshold(
                utilisationRate,
                rateThreshold,
                base,
                slope1,
                slope2
            );
        }

        return rate;
    }

    /**
     * @dev
     */
    function _calculateIndex(uint256 rate, uint256 lastUpdateTimestamp)
        internal
        view
        returns (uint256)
    {
        uint256 timePased = block.timestamp - lastUpdateTimestamp;

        return ((rate * timePased) / SECONDS_PER_YEAR) + WadRayMath.ray();
    }

    /**
     * @dev
     */
    function _calculateInterestIndex(ReserveData storage reserve)
        internal
        view
        returns (uint256)
    {
        uint256 cumulatedInterestIndex = _calculateIndex(
            reserve.interestRate,
            reserve.lastUpdateTimestamp
        );

        return reserve.interestIndex.rayMul(cumulatedInterestIndex);
    }

    /**
     * @dev
     */
    function _calculateBorrowIndex(ReserveData storage reserve)
        internal
        view
        returns (uint256)
    {
        uint256 cumulatedBorrowIndex = _calculateIndex(
            reserve.borrowRate,
            reserve.lastUpdateTimestamp
        );

        return reserve.borrowIndex.rayMul(cumulatedBorrowIndex);
    }

    /**
     * @dev
     */
    function _calculateIndexes(ReserveData storage reserve) internal {
        // If there is any interest
        if (reserve.interestRate > 0) {
            reserve.interestIndex = _calculateInterestIndex(reserve);

            // if there is any borrow
            if (reserve.borrowRate > 0) {
                reserve.borrowIndex = _calculateBorrowIndex(reserve);
            }
        }
    }

    /**
     * @dev Return reserve utilistation rate, expressed in ray. 100% is 1 ray.
     */
    function _calculateUtilisationRate(
        ReserveData storage reserve,
        uint256 collateralAdded,
        uint256 collateralTaken,
        uint256 debtAdded,
        uint256 debtTaken
    ) internal view returns (uint256) {
        uint256 collateralSupply = reserve.rToken.totalSupply();
        uint256 debtSupply = reserve.dToken.totalSupply();

        // console.log("collateralSupply", collateralSupply);
        // console.log("debtSupply", debtSupply);

        if (collateralSupply == 0) {
            // console.log("utilistation rate return 0");
            return 0;
        }

        uint256 utilisationRate = (debtSupply + debtAdded - debtTaken).rayDiv(
            collateralSupply + collateralAdded - collateralTaken
        );

        // console.log("utilisationRate", utilisationRate);

        return utilisationRate;
    }

    /**
     * @dev
     */
    function _calculateRates(
        ReserveData storage reserve,
        uint256 collateralAdded,
        uint256 collateralTaken,
        uint256 debtAdded,
        uint256 debtTaken
    ) internal {
        uint256 utilisationRate = _calculateUtilisationRate(
            reserve,
            collateralAdded,
            collateralTaken,
            debtAdded,
            debtTaken
        );

        if (utilisationRate > 0) {
            reserve.interestRate = _calculateRate(
                utilisationRate,
                reserve.utilisationRateThreshold,
                reserve.interestRateBase,
                reserve.interestRateSlope1,
                reserve.interestRateSlope2
            );
            // console.log("reserve.interestRate", reserve.interestRate);

            reserve.borrowRate = _calculateRate(
                utilisationRate,
                reserve.utilisationRateThreshold,
                reserve.borrowRateBase,
                reserve.borrowRateSlope1,
                reserve.borrowRateSlope2
            );
            // console.log("reserve.borrowRate", reserve.borrowRate);
        }

        reserve.lastUpdateTimestamp = uint40(block.timestamp);
    }
}
