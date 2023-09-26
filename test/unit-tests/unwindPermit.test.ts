import BigNumber from 'bignumber.js'

import {
  MockERC20Instance,
  OwnedUpgradeabilityProxyInstance,
  OTCWrapperInstance,
  MinimalForwarderInstance,
  UnwindPermitInstance,
  OTCWrapperV2Instance,
} from '../../build/types/truffle-types'

const { expectRevert } = require('@openzeppelin/test-helpers')

const MockERC20 = artifacts.require('MockERC20.sol')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy.sol')
const OTCWrapperV2 = artifacts.require('OTCWrapperV2.sol')
const MinimalForwarder = artifacts.require('MinimalForwarder.sol')
const UnwindPermitContract = artifacts.require('UnwindPermit.sol')

// address(0)
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract('OTCWrapperV2', ([admin, beneficiary, keeper, random]) => {
  // ERC20 mock
  let usdc: MockERC20Instance
  // OTC wrapper module
  let otcWrapperImplementation: OTCWrapperInstance
  let otcWrapperProxy: OTCWrapperV2Instance
  // minimal forwarder
  let minimalForwarder: MinimalForwarderInstance
  // unwind permit module
  let unwindPermitContract: UnwindPermitInstance

  const USDCDECIMALS = 6
  let name = 'test'

  before('Deployment', async () => {
    // ERC20 deployment
    usdc = await MockERC20.new('USDC', 'USDC', USDCDECIMALS)

    // deploy unwind permit
    unwindPermitContract = await UnwindPermitContract.new(name, keeper)

    // deploy minimal forwarder
    minimalForwarder = await MinimalForwarder.new()

    // deploy OTC wrapper
    otcWrapperImplementation = await OTCWrapperV2.new(
      minimalForwarder.address,
      usdc.address,
      unwindPermitContract.address,
    )
    const ownedUpgradeabilityProxy: OwnedUpgradeabilityProxyInstance = await OwnedUpgradeabilityProxy.new()
    ownedUpgradeabilityProxy.upgradeTo(otcWrapperImplementation.address)
    otcWrapperProxy = await OTCWrapperV2.at(ownedUpgradeabilityProxy.address)
  })

  describe('constructor', () => {
    it('reverts if address 0', async () => {
      await expectRevert(UnwindPermitContract.new(name, ZERO_ADDR), 'UnwindPermit: keeper can not be zero')
    })
    it('successfully sets the keeper', async () => {
      assert.equal((await unwindPermitContract.keeper()).toString(), keeper)
    })
  })

  describe('setOTCWrapper', () => {
    it('reverts if address 0', async () => {
      await expectRevert(
        unwindPermitContract.setOTCWrapper(ZERO_ADDR, { from: keeper }),
        'UnwindPermit: OTC wrapper address can not be zero',
      )
    })
    it('reverts if caller is not keeper', async () => {
      await expectRevert(
        unwindPermitContract.setOTCWrapper(random, { from: random }),
        'UnwindPermit: caller is not the keeper',
      )
    })
    it('successfully sets the OTC Wrapper', async () => {
      assert.equal((await unwindPermitContract.currentOTCWrapper()).toString(), ZERO_ADDR)

      await unwindPermitContract.setOTCWrapper(otcWrapperProxy.address, { from: keeper })

      assert.equal((await unwindPermitContract.currentOTCWrapper()).toString(), otcWrapperProxy.address)
    })
  })

  describe('checkOrderPermit', () => {
    it('reverts if caller is not OTC wrapper', async () => {
      const randomBytes32 = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

      await expectRevert(
        unwindPermitContract.checkOrderPermit(
          random,
          new BigNumber(1),
          new BigNumber(2),
          new BigNumber(3),
          new BigNumber(4),
          randomBytes32,
          randomBytes32,
        ),
        'UnwindPermit: caller is not OTC Wrapper',
      )
    })
  })
})
