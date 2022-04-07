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

contract LendingProtocol is Ownable {
    using SafeERC20 for IERC20;

    struct ReserveData {
        RToken rToken;
        DToken dToken;
        uint256 collateralFactor; // 100% = 100, 75% = 75
        uint256 liquidationIncentive; // 5% = 5
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
        reserve.decimals = decimals;
        reserve.isActive = isActive;
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
    function deposit(address asset, uint256 amount) external {
        ReserveData storage reserve = _reserves[asset];

        require(amount != 0, Errors.ZERO_AMOUNT);
        require(reserve.isActive, Errors.RESERVE_INACTIVE);

        IERC20(asset).safeTransferFrom(
            msg.sender,
            address(reserve.rToken),
            amount
        );

        bool isNewReserve = reserve.rToken.mint(msg.sender, amount);

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
            (uint256 price, ) = priceFeed.getAssetUsdPrice(
                asset
            );
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

        bool isNewDebt = reserve.dToken.mint(msg.sender, amount);
        if (isNewDebt) {
            UserData storage user = _users[msg.sender];
            user.debts.push(asset);
        }

        reserve.rToken.transferUnderlyingAsset(msg.sender, amount);

        emit Borrow(asset, msg.sender, amount);
    }

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

        bool isZeroDebtBalance = debt.dToken.burn(user, debtAmountNeeded);
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

        // console.log("FINAL LIQUIDATION", collateralAmount, debtAmountNeeded);

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
}
