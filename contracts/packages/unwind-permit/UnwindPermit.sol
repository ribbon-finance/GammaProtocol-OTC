// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "./ECDSA.sol";
import "./EIP712.sol";
import "./Counters.sol";
import {UnwindPermitInterface} from "../../interfaces/otcWrapperInterfaces/UnwindPermitInterface.sol";

// UnwindPermit was based on Openzeppelin ERC20Permit
// link: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/7f028d69593342673492b0a0b1679e2a898cf1cf/contracts/token/ERC20/extensions/ERC20Permit.sol

contract UnwindPermit is EIP712, UnwindPermitInterface {
    using Counters for Counters.Counter;

    mapping(address => Counters.Counter) private _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("UnwindPermit(address owner,uint256 orderID,uint256 value,uint256 nonce,uint256 deadline)");

    // Unwind permit keeper
    address public keeper;

    // Current OTC wrapper address that is allowed to call checkOrderPermit()
    address public currentOTCWrapper;

    /**
     * @dev Initializes the {EIP712} domain separator using the `name` parameter, and setting `version` to `"1"`.
     */
    constructor(string memory name, address _keeper) EIP712(name, "1") {
        require(_keeper != address(0), "UnwindPermit: keeper can not be zero");
        keeper = _keeper;
    }

    function setOTCWrapper(address _otcWrapper) external {
        require(msg.sender == keeper, "UnwindPermit: caller is not the keeper");
        require(_otcWrapper != address(0), "UnwindPermit: OTC wrapper address can not be zero");
        currentOTCWrapper = _otcWrapper;
    }

    function checkOrderPermit(
        address owner,
        uint256 orderID,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(msg.sender == currentOTCWrapper, "UnwindPermit: caller is not OTC Wrapper");
        require(block.timestamp <= deadline, "UnwindPermit: expired deadline");

        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, owner, orderID, value, _useNonce(owner), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "UnwindPermit: invalid signature");
    }

    function nonces(address owner) public view returns (uint256) {
        return _nonces[owner].current();
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev "Consume a nonce": return the current value and increment.
     */
    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }
}
