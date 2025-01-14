// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface WhitelistWrapperInterface {
    /* View functions */

    function addressBook() external view returns (address);

    function isWhitelistedProduct(
        address _underlying,
        address _strike,
        address _collateral,
        bool _isPut
    ) external view returns (bool);

    function isWhitelistedCollateral(address _collateral) external view returns (bool);

    function isCoveredWhitelistedCollateral(
        address _collateral,
        address _underlying,
        bool _isPut
    ) external view returns (bool);

    function isNakedWhitelistedCollateral(
        address _collateral,
        address _underlying,
        bool _isPut
    ) external view returns (bool);

    function isWhitelistedOtoken(address _otoken) external view returns (bool);

    function isWhitelistedCallee(address _callee) external view returns (bool);

    /* Admin / factory only functions */
    function whitelistProduct(
        address _underlying,
        address _strike,
        address _collateral,
        bool _isPut
    ) external;

    function blacklistProduct(
        address _underlying,
        address _strike,
        address _collateral,
        bool _isPut
    ) external;

    function whitelistCollateral(address _collateral) external;

    function blacklistCollateral(address _collateral) external;

    function whitelistCoveredCollateral(
        address _collateral,
        address _underlying,
        bool _isPut
    ) external;

    function whitelistNakedCollateral(
        address _collateral,
        address _underlying,
        bool _isPut
    ) external;

    function whitelistOtoken(address _otoken) external;

    function blacklistOtoken(address _otoken) external;

    function whitelistCallee(address _callee) external;

    function blacklistCallee(address _callee) external;
}
