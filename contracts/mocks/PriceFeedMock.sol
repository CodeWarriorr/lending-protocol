//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPriceFeed.sol";

contract PriceFeedMock is IPriceFeed {
    mapping(address => address) private _wrapped;
    mapping(address => uint256) private _prices;

    constructor(address _registry) {
        _registry;
    }

    /**
     * @dev
     */
    function updateAssetPriceFeedAddress(
        address asset,
        address feedPriceAddress
    ) external pure override {
        asset;
        feedPriceAddress;
    }

    function setAssetUsdPrice(address asset, uint256 price) external {
        _prices[asset] = price;
    }

    /**
     * @dev
     */
    function getAssetUsdPrice(address asset)
        external
        view
        override
        returns (uint256, uint8)
    {
        return (_prices[asset], 8);
    }

    /**
     * @dev
     */
    function getAssetEthPrice(address asset)
        external
        view
        override
        returns (uint256, uint8)
    {
        return (_prices[asset], 18);
    }

    /**
     * @dev
     */
    function getPrice(address asset, address quote)
        external
        view
        override
        returns (uint256, uint8)
    {
        quote;
        return (_prices[asset], 18);
    }
}
