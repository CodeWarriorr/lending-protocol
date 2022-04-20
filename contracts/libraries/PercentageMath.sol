pragma solidity ^0.8.0;

/**
 * Percentage calculations.
 * 
 * HALF_PERCENTAGE is used to round results 0.5 and above up.
 * https://ethereum.stackexchange.com/questions/90575/why-ds-math-add-wad-2-or-ray-2-in-wad-ray-multiply-function
 */
library PercentageMath {
  uint internal constant PERCENTAGE = 10**4;
  uint internal constant HALF_PERCENTAGE = PERCENTAGE / 2;

  /**
   * @dev Multiply by percentage
   */
  function percentMul(uint value, uint percent) internal pure returns(uint) {
    return (value * percent + HALF_PERCENTAGE) / PERCENTAGE;
  }

  /**
  * @dev Divide by percentage
   */
  function percentDiv(uint value, uint percent) internal pure returns (uint) {
    uint halfPercent = percent / 2;

    return (value * PERCENTAGE + halfPercent) / percent;
  }
}