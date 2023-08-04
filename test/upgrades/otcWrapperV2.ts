import { MinimalForwarderInstance, UnwindPermitInstance, OTCWrapperV2Instance } from '../../build/types/truffle-types'

const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy.sol')
const OTCWrapperV2 = artifacts.require('OTCWrapperV2.sol')
const OTCWrapper = artifacts.require('OTCWrapper.sol')
const MinimalForwarder = artifacts.require('MinimalForwarder.sol')
const UnwindPermitContract = artifacts.require('UnwindPermit.sol')

contract('OTCWrapperV2', ([random]) => {
  let otcWrapperProxy: OTCWrapperV2Instance
  // minimal forwarder
  let minimalForwarder: MinimalForwarderInstance
  // unwind permit module
  let unwindPermitContract: UnwindPermitInstance

  // permit related
  const name = 'UnwindPermit' // random example name
  const OTC_WRAPPER_MAINNET_ADDRESS = '0x5feDa53467125c7789C30376f91082B1FCAe4989'
  const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const ADMIN = '0xF8368119Bb1073Cf01B841848725d81b542A4c19'

  describe('Upgrade', () => {
    it('successfully upgrades the contract to V2 without storage collision', async () => {
      const proxy = await OwnedUpgradeabilityProxy.at(OTC_WRAPPER_MAINNET_ADDRESS)
      otcWrapperProxy = await OTCWrapper.at(OTC_WRAPPER_MAINNET_ADDRESS)

      // deploy unwind permit
      unwindPermitContract = await UnwindPermitContract.new(name, ADMIN)

      // deploy minimal forwarder
      minimalForwarder = await MinimalForwarder.new()

      // deploy new OTC wrapper implementation V2
      const otcWrapperImplementationV2 = await OTCWrapperV2.new(
        minimalForwarder.address,
        USDC_ADDRESS,
        unwindPermitContract.address,
      )

      // initial state
      const addressbookBef = (await otcWrapperProxy.addressbook()).toString()
      const marginRequirementsBef = (await otcWrapperProxy.marginRequirements()).toString()
      const controllerBef = (await otcWrapperProxy.controller()).toString()
      const oracleBef = (await otcWrapperProxy.oracle()).toString()
      const whitelistBef = (await otcWrapperProxy.whitelist()).toString()
      const OTokenFactoryBef = (await otcWrapperProxy.OTokenFactory()).toString()
      const calculatorBef = (await otcWrapperProxy.calculator()).toString()
      const latestOrderBef = (await otcWrapperProxy.latestOrder()).toString()
      const fillDeadlineBef = (await otcWrapperProxy.fillDeadline()).toString()
      const beneficiaryBef = (await otcWrapperProxy.beneficiary()).toString()
      const usdcBef = (await otcWrapperProxy.USDC()).toString()

      // upgrade proxy to new OTC wrapper implementation
      await proxy.upgradeTo(otcWrapperImplementationV2.address, { from: ADMIN })

      const otcWrapperProxyV2 = await OTCWrapperV2.at(OTC_WRAPPER_MAINNET_ADDRESS)

      // set new variables
      await otcWrapperProxyV2.setUnwindFee(random, 1000, { from: ADMIN })
      await otcWrapperProxyV2.setUnwindBufferDuration(4000, { from: ADMIN })

      // final state
      assert.equal((await proxy.implementation()).toString(), otcWrapperImplementationV2.address)
      const addressbookAft = (await otcWrapperProxy.addressbook()).toString()
      const marginRequirementsAft = (await otcWrapperProxy.marginRequirements()).toString()
      const controllerAft = (await otcWrapperProxy.controller()).toString()
      const oracleAft = (await otcWrapperProxy.oracle()).toString()
      const whitelistAft = (await otcWrapperProxy.whitelist()).toString()
      const OTokenFactoryAft = (await otcWrapperProxy.OTokenFactory()).toString()
      const calculatorAft = (await otcWrapperProxy.calculator()).toString()
      const latestOrderAft = (await otcWrapperProxy.latestOrder()).toString()
      const fillDeadlineAft = (await otcWrapperProxy.fillDeadline()).toString()
      const beneficiaryAft = (await otcWrapperProxy.beneficiary()).toString()
      const usdcAft = (await otcWrapperProxy.USDC()).toString()

      // ensure variables match
      assert.equal(addressbookBef, addressbookAft)
      assert.equal(marginRequirementsBef, marginRequirementsAft)
      assert.equal(controllerBef, controllerAft)
      assert.equal(oracleBef, oracleAft)
      assert.equal(whitelistBef, whitelistAft)
      assert.equal(OTokenFactoryBef, OTokenFactoryAft)
      assert.equal(calculatorBef, calculatorAft)
      assert.equal(latestOrderBef, latestOrderAft)
      assert.equal(fillDeadlineBef, fillDeadlineAft)
      assert.equal(beneficiaryBef, beneficiaryAft)
      assert.equal(usdcBef, usdcAft)
    })
  })
})
