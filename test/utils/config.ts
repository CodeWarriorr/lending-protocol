export const ethMainnetFeedRegistryAddress =
  "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";
export const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const wbtcAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
export const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const uniRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

export const erc20Abi = [
  "function allowance(address owner, address spender) external view returns (uint256 remaining)",
  "function approve(address spender, uint256 value) external returns (bool success)",
  "function balanceOf(address owner) external view returns (uint256 balance)",
  "function decimals() external view returns (uint8 decimalPlaces)",
  "function name() external view returns (string memory tokenName)",
  "function symbol() external view returns (string memory tokenSymbol)",
  "function totalSupply() external view returns (uint256 totalTokensIssued)",
  "function transfer(address to, uint256 value) external returns (bool success)",
  "function transferFrom(address from, address to, uint256 value) external returns (bool success)",
];
