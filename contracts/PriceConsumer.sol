//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import "@chainlink/contracts/src/v0.8/Denominations.sol";

contract PriceConsumer {
    FeedRegistryInterface internal registry;
    mapping(address => address) private _wrapped;

    constructor(address _registry) {
        registry = FeedRegistryInterface(_registry);
    }

    /**
     * // TODO: add modifier
     * // TODO: potentialy change name to something more accurate
     * @dev
     */
    function updateFeedPriceAddress(address asset, address feedPriceAddress)
        public
    {
        _wrapped[asset] = feedPriceAddress;
    }

    /**
     * @dev
     */
    function _getPriceFeedAddress(address asset)
        internal
        view
        returns (address)
    {
        address priceFeedAddress = _wrapped[asset] != address(0)
            ? _wrapped[asset]
            : asset;

        return priceFeedAddress;
    }

    /**
     * TODO: consider using get agggregator to not search two times: function getFeed(address base, address quote) external view returns (AggregatorV2V3Interface aggregator);
     * @dev
     */
    function getAssetUsdPrice(address asset)
        public
        view
        returns (uint256, uint8)
    {
        (, int256 price, , , ) = registry.latestRoundData(
            _getPriceFeedAddress(asset),
            Denominations.USD
        );

        uint8 decimals = registry.decimals(
            _getPriceFeedAddress(asset),
            Denominations.USD
        );

        return (uint256(price), decimals);
    }

    /**
    *  TODO: consider using eth instead of USD
    * @dev 
     */
    function getAssetEthPrice(address asset)
        public
        view
        returns (uint256, uint8)
    {
        (, int256 price, , , ) = registry.latestRoundData(
            _getPriceFeedAddress(asset),
            Denominations.ETH
        );

        uint8 decimals = registry.decimals(
            _getPriceFeedAddress(asset),
            Denominations.ETH
        );

        return (uint256(price), decimals);
    }

    /**
     * @dev
     */
    function getPrice(address asset, address quote)
        public
        view
        returns (uint256, uint8)
    {
        (, int256 price, , , ) = registry.latestRoundData(
            _getPriceFeedAddress(asset),
            quote
        );

        uint8 decimals = registry.decimals(_getPriceFeedAddress(asset), quote);

        return (uint256(price), decimals);
    }
}
