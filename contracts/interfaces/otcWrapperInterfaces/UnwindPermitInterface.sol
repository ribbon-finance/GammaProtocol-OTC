// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface UnwindPermitInterface {
    function checkOrderPermit(
        address owner,
        uint256 orderID,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
