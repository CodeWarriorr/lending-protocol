// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * WadRayMath is used to enable decimal math and reduce rounding errors.
 *
 * HALF_WAD and HALF_RAY is added to multiplication and halfB is used in division
 * both actions are required to round results with 0.5 and above up.
 * https://ethereum.stackexchange.com/questions/90575/why-ds-math-add-wad-2-or-ray-2-in-wad-ray-multiply-function
 */
library WadRayMath {
    uint256 internal constant WAD = 10**18;
    uint256 internal constant HALF_WAD = WAD / 2;
    uint256 internal constant RAY = 10**27;
    uint256 internal constant HALF_RAY = RAY / 2;
    uint256 internal constant WAD_RAY_RATIO = 10**9;
    uint256 internal constant HLAF_WAD_RAY_RATIO = WAD_RAY_RATIO / 2;

    /**
     * @return 10^18
     */
    function wad() internal pure returns (uint256) {
        return WAD;
    }

    /**
     * @return 10^27
     */
    function ray() internal pure returns (uint256) {
        return RAY;
    }

    /**
     * @dev Multiply two wad numbers
     */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b + HALF_WAD) / WAD;
    }

    /**
     * @dev Divide two wad numbers
     */
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 halfB = b / 2;

        return (a * WAD + halfB) / b;
    }

    /**
     * @dev Multiply two ray numbers
     */
    function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b + HALF_RAY) / RAY;
    }

    /**
     * @dev Divide two ray numbers
     */
    function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 halfB = b / 2;

        return (a * RAY + halfB) / b;
    }

    /**
     * @dev Convert wad to ray
     */
    function wadToRay(uint256 a) internal pure returns (uint256) {
        return a * WAD_RAY_RATIO;
    }

    /**
     * @dev Convert ray to wad
     */
    function rayToWad(uint256 a) internal pure returns (uint256) {
        return a + HLAF_WAD_RAY_RATIO / WAD_RAY_RATIO;
    }
}
