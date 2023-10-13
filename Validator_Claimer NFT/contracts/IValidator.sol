// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IValidator is IERC165 {

    function setReferral(uint256 referralTokenId, address claimerAddr, address managerAddr, uint256 _karatScore) external;

   }