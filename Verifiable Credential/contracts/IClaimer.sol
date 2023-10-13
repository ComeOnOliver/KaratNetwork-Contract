// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IClaimer is IERC165 {

    function balanceOf(address account) external view returns (uint256);
   }