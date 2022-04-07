// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

library Errors {
  string public constant ASSET_IS_NOT_A_CONTRACT =  "LendingProtocol: asset is not a contract";
  string public constant RESERVE_INITIALIZED = "LendingProtocol: reserve already initialized";
  string public constant ZERO_AMOUNT = "LendingProtocol: amount can not be zero";
  string public constant RESERVE_INACTIVE = "LendingProtocol: reserve is not active";
  string public constant LIQUIDITY_LESS_THAN_BORROW = "LendingProtocol: liquidity can not cover borrow amount";
  string public constant LIQUIDITY_POSITIVE = "LendingProtocol: liquidity is positive";
  string public constant NO_RESERVE_ASSET = "LendingProtocol: user has no deposited specified asset";
  string public constant NO_BORROWED_ASSET = "LendingProtocol: users has no borrowed specified asset";
}