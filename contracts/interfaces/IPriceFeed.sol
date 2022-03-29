//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceFeed {
    function updateAssetPriceFeedAddress(address, address) external;

    function getAssetUsdPrice(address) external view returns (uint256, uint8);

    function getAssetEthPrice(address) external view returns (uint256, uint8);

    function getPrice(address, address) external view returns (uint256, uint8);
}
