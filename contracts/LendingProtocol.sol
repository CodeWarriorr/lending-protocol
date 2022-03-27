//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PriceConsumer.sol";
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
        // address priceFeedAsset; // TODO: consider using this for price feed contract
        address rTokenAddress; // Reserve Token Address
        address dTokenAddress; // Debt Token Address
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

    PriceConsumer internal priceConsumer;

    event Deposit(
        address indexed reserve,
        address indexed user,
        uint256 amount
    );
    event Borrow(address indexed reserve, address indexed user, uint256 amount);

    constructor(PriceConsumer _priceConsumer) {
        priceConsumer = _priceConsumer;
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
            _reserves[asset].rTokenAddress == address(0),
            Errors.RESERVE_INITIALIZED
        );

        ReserveData storage reserve = _reserves[asset];
        reserve.rTokenAddress = rTokenAddress;
        reserve.dTokenAddress = dTokenAddress;
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
            reserve.rTokenAddress,
            amount
        );

        RToken rToken = RToken(reserve.rTokenAddress);

        bool isNewReserve = rToken.mint(msg.sender, amount);

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
    function getUserLiquidity(address _user) public view returns (uint256) {
        UserData storage user = _users[_user];
        uint256 usdReserveBalance = 0;
        for (uint256 i = 0; i < user.reserves.length; i++) {
            address asset = user.reserves[i];
            ReserveData storage reserve = _reserves[asset];
            RToken rToken = RToken(reserve.rTokenAddress); // TODO: simplify 
            uint256 balance = rToken.balanceOf(_user);
            (uint256 price, ) = priceConsumer.getAssetUsdPrice(
                rToken.getUnderlyingAsset() // TODO: can we use address asset ?
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
            DToken dToken = DToken(reserve.dTokenAddress); // TODO: simplify
            uint256 debtBalance = dToken.balanceOf(_user);
            (uint256 price, ) = priceConsumer.getAssetUsdPrice(asset);
            usdDebtBalance += (debtBalance * price) / 10**reserve.decimals;
        }

        if (usdReserveBalance < usdDebtBalance) {
            return 0;
        }

        return usdReserveBalance - usdDebtBalance;
    }

    /**
     * @dev
     */
    function borrow(address asset, uint256 amount) external {
        ReserveData storage reserve = _reserves[asset];

        require(amount != 0, Errors.ZERO_AMOUNT);
        require(reserve.isActive, Errors.RESERVE_INACTIVE);

        (uint256 price, ) = priceConsumer.getAssetUsdPrice(asset);
        uint256 assetValueInUsd = (amount * price) / 10**reserve.decimals;

        uint256 userLiquidity = getUserLiquidity(msg.sender);
        require(
            assetValueInUsd < userLiquidity,
            Errors.LIQUIDITY_LESS_THAN_BORROW
        );

        bool isNewDebt = DToken(reserve.dTokenAddress).mint(msg.sender, amount);
        if (isNewDebt) {
            UserData storage user = _users[msg.sender];
            user.debts.push(asset);
        }

        RToken(reserve.rTokenAddress).transferUnderlyingAsset(
            msg.sender,
            amount
        );

        emit Borrow(asset, msg.sender, amount);
    }
}
