import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'

import {
  MarginCalculatorInstance,
  MockOtokenInstance,
  MockERC20Instance,
  MockOracleInstance,
  MockWhitelistModuleInstance,
  MarginPoolInstance,
  ControllerInstance,
  AddressBookInstance,
  OwnedUpgradeabilityProxyInstance,
  MarginRequirementsInstance,
  OTCWrapperInstance,
  ForceSendInstance,
  OtokenFactoryInstance,
  MinimalForwarderInstance,
  UnwindPermitInstance,
  OTCWrapperV2Instance,
} from '../../build/types/truffle-types'

import {
  createTokenAmount,
  createScaledBigNumber as scaleBigNum,
  createScaledNumber as scaleNum,
  permit,
  createValidExpiry,
  unwindPermit,
} from '../utils'
import { makeRe } from 'minimatch'
const { expectRevert, time, BN, expect } = require('@openzeppelin/test-helpers')
const { parseUnits } = require('ethers/lib/utils')

const { fromRpcSig } = require('ethereumjs-util')
const ethSigUtil = require('eth-sig-util')
const Wallet = require('ethereumjs-wallet').default

const MockERC20 = artifacts.require('MockERC20.sol')
const MockOtoken = artifacts.require('MockOtoken.sol')
const MockOracle = artifacts.require('MockOracle.sol')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy.sol')
const MarginCalculator = artifacts.require('MarginCalculator.sol')
const MockWhitelistModule = artifacts.require('MockWhitelistModule.sol')
const AddressBook = artifacts.require('AddressBook.sol')
const MarginPool = artifacts.require('MarginPool.sol')
const Controller = artifacts.require('Controller.sol')
const MarginVault = artifacts.require('MarginVault.sol')
const MarginRequirements = artifacts.require('MarginRequirements.sol')
const OTCWrapperV2 = artifacts.require('OTCWrapperV2.sol')
const ForceSend = artifacts.require('ForceSend.sol')
const OtokenFactory = artifacts.require('OtokenFactory.sol')
const MinimalForwarder = artifacts.require('MinimalForwarder.sol')
const UnwindPermitContract = artifacts.require('UnwindPermit.sol')

// address(0)
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

// permit related
const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
]
const UnwindPermit = [
  { name: 'owner', type: 'address' },
  { name: 'orderID', type: 'uint256' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
]

enum ActionType {
  OpenVault,
  MintShortOption,
  BurnShortOption,
  DepositLongOption,
  WithdrawLongOption,
  DepositCollateral,
  WithdrawCollateral,
  SettleVault,
  Redeem,
  Call,
  InvalidAction,
}

// minimal forwarder related
const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
]

const ForwardRequest = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'data', type: 'bytes' },
]

contract('OTCWrapperV2', ([admin, beneficiary, keeper, random]) => {
  // ERC20 mock
  let usdc: MockERC20Instance
  let weth: MockERC20Instance
  let wbtc: MockERC20Instance
  // oracle module
  let oracle: MockOracleInstance
  // calculator module
  let calculator: MarginCalculatorInstance
  // margin pool module
  let marginPool: MarginPoolInstance
  // whitelist module mock
  let whitelist: MockWhitelistModuleInstance
  // margin requirements module
  let marginRequirements: MarginRequirementsInstance
  // addressbook module mock
  let addressBook: AddressBookInstance
  // otoken factory module
  let otokenFactory: OtokenFactoryInstance
  // otoken implementation module
  let otokenImp: MockOtokenInstance
  // controller module
  let controllerImplementation: ControllerInstance
  let controllerProxy: ControllerInstance
  // OTC wrapper module
  let otcWrapperImplementation: OTCWrapperInstance
  let otcWrapperProxy: OTCWrapperV2Instance
  // minimal forwarder
  let minimalForwarder: MinimalForwarderInstance
  // unwind permit module
  let unwindPermitContract: UnwindPermitInstance

  const USDCDECIMALS = 6
  const WETHDECIMALS = 18
  const WBTCDECIMALS = 8

  // permit related
  const name = 'ETHUSDC/1597511955/200P/USDC' // random example name
  const version = '1'
  const user = '0xA94Ab2Bb0C67842FB40A1068068DF1225A031a7d'
  const marketMaker = '0x427fB2c379f02761594768357B33D267fFdf80C5'
  const marketMaker2 = '0x5bE5e1f5635EA3dC44CAd435d00916d2b59BfC3C'

  let userSignature1: permit
  let userSignature2: permit
  let userSignature3: permit
  let userSignature4: permit
  let userSignature5: permit
  let mmSignatureUSDC1: permit
  let mmSignatureUSDC2: permit
  let mmSignatureUSDC3: permit
  let mmSignatureUSDC4: permit
  let mmSignatureUSDC5: permit
  let mmSignatureUSDC6: permit
  let mmSignatureUSDC7: permit
  let mmSignatureUSDC8: permit
  let mmSignatureUSDC9: permit
  let mmSignatureUSDC10: permit
  let mmSignatureUSDC11: permit
  let mm2SignatureUSDC1: permit
  let forceSend: ForceSendInstance
  let userUnwindSignature: unwindPermit
  let userUnwindSignature2: unwindPermit
  let userUnwindSignature3: unwindPermit
  let userUnwindSignature4: unwindPermit
  let userUnwindSignature5: unwindPermit
  let userUnwindSignature6: unwindPermit
  let userUnwindSignature7: unwindPermit
  let mmUnwindSignature: unwindPermit
  let mmUnwindSignature2: unwindPermit
  let mmUnwindSignature3: unwindPermit
  let mmUnwindSignature4: unwindPermit
  let mmUnwindSignature5: unwindPermit
  let mmUnwindSignature6: unwindPermit
  let mm2UnwindSignature: unwindPermit
  let mm2UnwindSignature2: unwindPermit
  let unwindPermitDeadline: string

  // time to expiry
  let expiry: number

  before('Deployment', async () => {
    // deploy addressbook
    addressBook = await AddressBook.new()
    // ERC20 deployment
    weth = await MockERC20.new('WETH', 'WETH', WETHDECIMALS)
    usdc = await MockERC20.new('USDC', 'USDC', USDCDECIMALS)
    wbtc = await MockERC20.new('WBTC', 'WBTC', WBTCDECIMALS)

    // deploy oracle
    oracle = await MockOracle.new(addressBook.address, { from: admin })
    // deploy calculator
    calculator = await MarginCalculator.new(oracle.address, addressBook.address)
    // deploy margin pool
    marginPool = await MarginPool.new(addressBook.address)
    // deploy whitelist
    whitelist = await MockWhitelistModule.new()
    // deploy otoken factory
    otokenFactory = await OtokenFactory.new(addressBook.address)
    // deploy otoken
    otokenImp = await MockOtoken.new()
    // set keeper in addressbook
    await addressBook.setKeeper(keeper)
    // set margin pool in addressbook
    await addressBook.setMarginPool(marginPool.address)
    // set calculator in addressbook
    await addressBook.setMarginCalculator(calculator.address)
    // set oracle in addressbook
    await addressBook.setOracle(oracle.address)
    // set whitelist in addressbook
    await addressBook.setWhitelist(whitelist.address)
    // set otoken in addressbook
    await addressBook.setOtokenImpl(otokenImp.address)
    // set otoken factory in addressbook
    await addressBook.setOtokenFactory(otokenFactory.address)
    // deploy MarginRequirements
    marginRequirements = await MarginRequirements.new(addressBook.address)
    // set margin requirements in addressbook
    await addressBook.setMarginRequirements(marginRequirements.address)
    // deploy controller
    const lib = await MarginVault.new()
    await Controller.link('MarginVault', lib.address)
    controllerImplementation = await Controller.new()

    // set controller address in addressbook
    await addressBook.setController(controllerImplementation.address, { from: admin })

    // check controller deployment
    const controllerProxyAddress = await addressBook.getController()
    controllerProxy = await Controller.at(controllerProxyAddress)
    const proxy: OwnedUpgradeabilityProxyInstance = await OwnedUpgradeabilityProxy.at(controllerProxyAddress)

    assert.equal(await proxy.proxyOwner(), addressBook.address, 'Proxy owner address mismatch')
    assert.equal(await controllerProxy.owner(), admin, 'Controller owner address mismatch')
    assert.equal(await controllerProxy.systemPartiallyPaused(), false, 'system is partially paused')

    // deploy unwind permit
    unwindPermitContract = await UnwindPermitContract.new(name)

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

    otcWrapperProxy.initialize(addressBook.address, admin, 15 * 60)

    // set OTC wrapper address in addressbook
    await addressBook.setOTCWrapper(otcWrapperProxy.address)

    // set oracle price
    await oracle.setRealTimePrice(usdc.address, scaleBigNum(1, 8))
    await oracle.setRealTimePrice(weth.address, scaleBigNum(1500, 8))
    await oracle.setRealTimePrice(wbtc.address, scaleBigNum(20000, 8))

    // set expiry for options
    expiry = createValidExpiry(Number(await time.latest()), 10)

    // admin whitelists product and collateral
    await whitelist.whitelistCollateral(usdc.address)
    await whitelist.whitelistProduct(weth.address, usdc.address, usdc.address, false)
    await whitelist.whitelistNakedCollateral(usdc.address, weth.address, false)

    await whitelist.whitelistProduct(weth.address, usdc.address, wbtc.address, true)
    await whitelist.whitelistNakedCollateral(wbtc.address, weth.address, true)
    await whitelist.whitelistCollateral(wbtc.address)

    // set initial margin for new product
    await marginRequirements.setInitialMargin(weth.address, wbtc.address, false, marketMaker, 1000)
    await marginRequirements.setInitialMargin(weth.address, usdc.address, false, marketMaker, 1000)

    // set naked cap collateral to high number
    await controllerProxy.setNakedCap(usdc.address, parseUnits('1', 25))
    await controllerProxy.setNakedCap(wbtc.address, parseUnits('1', 25))

    // set upper bound values and spot shock
    const upperBoundValue = 1
    await calculator.setUpperBoundValues(weth.address, usdc.address, usdc.address, false, [expiry], [upperBoundValue])
    await calculator.setSpotShock(weth.address, usdc.address, usdc.address, false, scaleBigNum(1500, 35))

    await calculator.setUpperBoundValues(weth.address, usdc.address, wbtc.address, true, [expiry], [upperBoundValue])
    await calculator.setSpotShock(weth.address, usdc.address, wbtc.address, true, scaleBigNum(1500, 35))

    // USDC at expiry
    await oracle.setExpiryPriceFinalizedAllPeiodOver(usdc.address, expiry, createTokenAmount(1), true)

    // OTC wrapper setup
    await otcWrapperProxy.setMinMaxNotional(weth.address, parseUnits('50000', 6), parseUnits('1000000', 6))
    await otcWrapperProxy.setWhitelistMarketMaker(marketMaker, true)
    await otcWrapperProxy.setWhitelistMarketMaker(marketMaker2, true)
    await otcWrapperProxy.setFee(weth.address, 10000) // 1%
    await otcWrapperProxy.setBeneficiary(beneficiary)
    await otcWrapperProxy.setFillDeadline(new BigNumber(600))
    await otcWrapperProxy.setMaxDeviation(weth.address, 100)

    unwindPermitDeadline = new BigNumber(await time.latest()).plus(8600000 * 100).toString()
  })

  describe('permit correct setups', () => {
    it('set up user permit USDC signature 1', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 0
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      userSignature1 = { amount, deadline, acct, v, r, s }
    })
    it('set up user permit USDC signature 2', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 1
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      userSignature2 = { amount, deadline, acct, v, r, s }
    })
    it('set up user permit USDC signature 3', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 2
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      userSignature3 = { amount, deadline, acct, v, r, s }
    })
    it('set up user permit USDC signature 4', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 3
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      userSignature4 = { amount, deadline, acct, v, r, s }
    })
    it('set up user permit USDC signature 5', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 4
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      userSignature5 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 1', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('30000', 6).toNumber()
      const nonce = 0
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC1 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 2', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 1
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC2 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 3', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15002', 6).toNumber()
      const nonce = 1
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC3 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 4', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 1
      const spender = otcWrapperProxy.address
      const maxDeadline = new BigNumber(await time.latest()).plus(8600000 * 50).toString()

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC4 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 5', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 2
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC5 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 6', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 2
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC6 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 7', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('16001', 6).toNumber()
      const nonce = 3
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC7 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 8', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('16001', 6).toNumber()
      const nonce = 4
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC8 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 9', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 4
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC9 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 10', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 5
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC10 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker permit USDC signature 11', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 6
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mmSignatureUSDC11 = { amount, deadline, acct, v, r, s }
    })
    it('set up market maker 2 permit USDC signature', async () => {
      //resulting address = 0x5be5e1f5635ea3dc44cad435d00916d2b59bfc3c
      const randomBuffer = Buffer.alloc(32, 'opkl')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 0
      const spender = otcWrapperProxy.address
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), usdc.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const amount = value.toString()
      const deadline = maxDeadline

      mm2SignatureUSDC1 = { amount, deadline, acct, v, r, s }
    })
    it('set up user unwind permit signature 1', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 0
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up user unwind permit signature 2', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('5000', 6).toNumber()
      const nonce = 0
      const orderID = 2
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature2 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up user unwind permit signature 3', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = parseUnits('35000', 6).toNumber()
      const nonce = 0
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature3 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up user unwind permit signature 4', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = 0
      const nonce = 0
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature4 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up user unwind permit signature 5', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = 1
      const nonce = 1
      const orderID = 2
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature5 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up user unwind permit signature 6', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = 1
      const nonce = 2
      const orderID = 3
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature6 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up user unwind permit signature 7', async () => {
      // resulting address = 0xa94ab2bb0c67842fb40a1068068df1225a031a7d
      const randomBuffer = Buffer.alloc(32, 'dsaas')

      const userWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = userWallet.getAddressString()
      const value = 1
      const nonce = 2
      const orderID = 4
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(userWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      userUnwindSignature7 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 1 unwind permit signature 1', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 0
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mmUnwindSignature = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 1 unwind permit signature 2', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 0
      const orderID = 2
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mmUnwindSignature2 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 1 unwind permit signature 3', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 1
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mmUnwindSignature3 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 1 unwind permit signature 4', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 2
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mmUnwindSignature4 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 1 unwind permit signature 5', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('16001', 6).toNumber()
      const nonce = 1
      const orderID = 3
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mmUnwindSignature5 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 1 unwind permit signature 6', async () => {
      //resulting address = 0x427fb2c379f02761594768357b33d267ffdf80c5
      const randomBuffer = Buffer.alloc(32, 'abc')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 1
      const orderID = 4
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mmUnwindSignature6 = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 2 unwind permit signature 1', async () => {
      //resulting address = 0x5be5e1f5635ea3dc44cad435d00916d2b59bfc3c
      const randomBuffer = Buffer.alloc(32, 'opkl')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 0
      const orderID = 2
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mm2UnwindSignature = { acct, orderID, bidValue, deadline, v, r, s }
    })
    it('set up market maker 2 unwind permit signature 2', async () => {
      //resulting address = 0x5be5e1f5635ea3dc44cad435d00916d2b59bfc3c
      const randomBuffer = Buffer.alloc(32, 'opkl')

      const mmWallet = Wallet.fromPrivateKey(randomBuffer)

      const owner = mmWallet.getAddressString()
      const value = parseUnits('15001', 6).toNumber()
      const nonce = 0
      const orderID = 1
      const maxDeadline = unwindPermitDeadline

      // fund eth
      forceSend = await ForceSend.new(addressBook.address)
      await forceSend.go(owner, { value: ethers.utils.parseEther('2').toString() })

      // fund usdc
      await usdc.mint(owner, createTokenAmount(200000, USDCDECIMALS))

      const buildData = (chainId: number, verifyingContract: string, deadline = maxDeadline) => ({
        primaryType: 'UnwindPermit',
        types: { EIP712Domain, UnwindPermit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, orderID, value, nonce, deadline },
      })

      const data = buildData((await usdc.getChainId()).toNumber(), unwindPermitContract.address)
      const signature = ethSigUtil.signTypedMessage(mmWallet.getPrivateKey(), { data })
      const { v, r, s } = fromRpcSig(signature)

      const acct = owner
      const bidValue = value.toString()
      const deadline = maxDeadline

      mm2UnwindSignature2 = { acct, orderID, bidValue, deadline, v, r, s }
    })
  })

  describe('constructor', () => {
    it('reverts if unwind permit is 0', async () => {
      await expectRevert(
        OTCWrapperV2.new(minimalForwarder.address, usdc.address, ZERO_ADDR),
        'OTCWrapper: unwind permit address cannot be 0',
      )
    })
    it('successfully sets unwind permit', async () => {
      assert.equal(await otcWrapperProxy.UNWIND_PERMIT(), unwindPermitContract.address)
      assert.equal((await otcWrapperProxy.FEE_PERCENT_MULTIPLER()).toString(), parseUnits('1', 6).toString())
    })
  })

  describe('setUnwindFee', () => {
    it('reverts if unwind underlying is 0', async () => {
      await expectRevert(otcWrapperProxy.setUnwindFee(ZERO_ADDR, 0), 'OTCWrapper: asset address cannot be 0')
    })
    it('reverts if unwind fee is higher than 100%', async () => {
      await expectRevert(
        otcWrapperProxy.setUnwindFee(weth.address, 10000000),
        'OTCWrapper: fee cannot be higher than 100%',
      )
    })
    it('successfully sets the WETH unwind fee to 1%', async () => {
      assert.equal((await otcWrapperProxy.unwindFee(weth.address)).toString(), '0')

      await otcWrapperProxy.setUnwindFee(weth.address, 10000)

      assert.equal((await otcWrapperProxy.unwindFee(weth.address)).toString(), '10000')
    })
  })

  describe('setUnwindBufferDuration', () => {
    it('reverts if buffer is lower than fillDeadline + 60', async () => {
      await expectRevert(otcWrapperProxy.setUnwindBufferDuration(1), 'OTCWrapper: insufficient buffer time')
    })
    it('successfully sets the unwind buffer duration to 1 hour', async () => {
      assert.equal((await otcWrapperProxy.unwindBufferDuration()).toString(), '0')

      await otcWrapperProxy.setUnwindBufferDuration(3600)

      assert.equal((await otcWrapperProxy.unwindBufferDuration()).toString(), '3600')
    })
  })

  describe('_settleFunds', () => {
    it('reverts if USDC price is zero', async () => {
      // user places order
      const strikePrice = scaleBigNum(1300, 8)
      const size = parseUnits('100', 8)

      await otcWrapperProxy.placeOrder(weth.address, false, strikePrice, expiry, parseUnits('5000', 6), size, {
        from: user,
      })

      // order gets executed
      const premium = parseUnits('5000', 6)
      const collateralAmount = parseUnits('30000', 6)
      const orderID = 1

      // USDC depegs to 0
      await oracle.setRealTimePrice(usdc.address, 0)
      await oracle.setRealTimePrice(wbtc.address, parseUnits('20000', 8))

      await wbtc.mint(marketMaker, collateralAmount)
      await wbtc.approve(otcWrapperProxy.address, collateralAmount, { from: marketMaker })

      await expectRevert(
        otcWrapperProxy.executeOrder(
          orderID,
          userSignature1,
          mmSignatureUSDC1,
          premium,
          wbtc.address,
          collateralAmount,
          {
            from: marketMaker,
          },
        ),
        'OTCWrapper: invalid USDC price',
      )

      // USDC repegs
      await oracle.setRealTimePrice(usdc.address, scaleBigNum(1, 8))
    })
    it('fee is properly calculated in a depeg scenario', async () => {
      // user places order
      const strikePrice = scaleBigNum(1300, 8)
      const size = parseUnits('100', 8)

      /*       await otcWrapperProxy.placeOrder(weth.address, false, strikePrice, expiry, parseUnits('5000', 6), size, {
        from: user,
      })
 */
      // order gets executed
      const premium = parseUnits('5000', 6)
      const collateralAmount = parseUnits('30000', 6)
      const orderID = 1

      // USDC depegs 50%
      await oracle.setRealTimePrice(usdc.address, scaleBigNum(5, 7))
      const originalOrderFee = parseUnits('1500', 6) // 1% of notional 150k notional
      const depegOrderFee = originalOrderFee.mul(2)

      const otcWrapperUSDCBalBefore = new BigNumber(await usdc.balanceOf(otcWrapperProxy.address))

      await otcWrapperProxy.executeOrder(
        orderID,
        userSignature1,
        mmSignatureUSDC1,
        premium,
        usdc.address,
        collateralAmount,
        {
          from: marketMaker,
        },
      )

      const otcWrapperUSDCBalAfter = new BigNumber(await usdc.balanceOf(otcWrapperProxy.address))

      assert.equal(otcWrapperUSDCBalAfter.minus(otcWrapperUSDCBalBefore).toString(), depegOrderFee.toString())

      // USDC repegs
      await oracle.setRealTimePrice(usdc.address, scaleBigNum(1, 8))
    })
  })

  describe('claimFees', () => {
    it('reverts if asset is address 0', async () => {
      await expectRevert(otcWrapperProxy.claimFees(ZERO_ADDR), 'OTCWrapper: asset address cannot be 0')
    })
    it('successfully claims fees', async () => {
      const amountToClaim = parseUnits('3000', 6)

      assert.equal((await usdc.balanceOf(beneficiary)).toString(), '0')
      assert.isAbove(Number(await usdc.balanceOf(otcWrapperProxy.address)), 0)

      const tx = await otcWrapperProxy.claimFees(usdc.address)

      assert.equal((await usdc.balanceOf(beneficiary)).toString(), amountToClaim.toString())
      assert.equal((await usdc.balanceOf(otcWrapperProxy.address)).toString(), '0')

      const { logs } = tx
      assert.equal(logs[0].args.amountClaimed.toString(), amountToClaim)
      assert.equal(logs[0].args.asset.toString(), usdc.address)
    })
    it('reverts if contract balance is 0', async () => {
      await expectRevert(otcWrapperProxy.claimFees(wbtc.address), 'OTCWrapper: amount to claim cannot be 0')
    })
  })

  describe('sellRedeemRights', () => {
    // seller approves otc wrapper contract
    const orderID = 1
    const size = parseUnits('100', 8)

    it('reverts if an order permit was not signed by the respective party', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(mm2UnwindSignature, mm2UnwindSignature, mm2SignatureUSDC1, {
          from: marketMaker2,
        }),
        'UnwindPermit: invalid signature',
      )

      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature, userUnwindSignature, mm2SignatureUSDC1, {
          from: marketMaker2,
        }),
        'UnwindPermit: invalid signature',
      )
    })
    it('reverts if orderID from order permits do not match', async () => {
      // seller approves otc wrapper contract
      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature2, mmUnwindSignature, mmSignatureUSDC2, {
          from: marketMaker,
        }),
        'OTCWrapper: orders do not match',
      )
    })
    it('reverts if order is inexistent or unsuccessful', async () => {
      // seller approves otc wrapper contract
      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature2, mmUnwindSignature2, mmSignatureUSDC2, {
          from: marketMaker,
        }),
        'OTCWrapper: inexistent or unsuccessful order',
      )
    })
    it('reverts if caller is not the bidder', async () => {
      // seller approves otc wrapper contract
      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature, mmUnwindSignature, mmSignatureUSDC2, {
          from: marketMaker2,
        }),
        'OTCWrapper: sender is not bidder',
      )
    })
    it('reverts if seller is not the order buyer', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(mm2UnwindSignature2, mmUnwindSignature, mmSignatureUSDC2, {
          from: marketMaker,
        }),
        'OTCWrapper: seller has no right to sell',
      )
    })
    it('reverts if seller bidValue is higher than bidder bidValue', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature3, mmUnwindSignature, mmSignatureUSDC2, {
          from: marketMaker,
        }),
        'OTCWrapper: insufficient bid amount',
      )
    })
    it('reverts if seller bidValue is 0', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature4, mmUnwindSignature, mmSignatureUSDC2, {
          from: marketMaker,
        }),
        'OTCWrapper: invalid bid value',
      )
    })
    it('reverts if bidder signatures accounts do not match', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature, mmUnwindSignature, mm2SignatureUSDC1, {
          from: marketMaker,
        }),
        'OTCWrapper: accounts do not match',
      )
    })
    it('reverts if bidder signatures bidValue/amount do not match', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature, mmUnwindSignature, mmSignatureUSDC3, {
          from: marketMaker,
        }),
        'OTCWrapper: amount and bid value do not match',
      )
    })
    it('reverts if bidder signatures deadlines do not match', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature, mmUnwindSignature, mmSignatureUSDC4, {
          from: marketMaker,
        }),
        'OTCWrapper: deadlines do not match',
      )
    })
    it('reverts if caller is not a whitelisted market maker', async () => {
      // blacklist maker
      await otcWrapperProxy.setWhitelistMarketMaker(marketMaker, false)

      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature, mmUnwindSignature, mmSignatureUSDC2, {
          from: marketMaker,
        }),
        'OTCWrapper: address not whitelisted market maker',
      )

      // whitelist maker back
      await otcWrapperProxy.setWhitelistMarketMaker(marketMaker, true)
    })
    it('user sucessfully unwinds position to the original market maker', async () => {
      const bidValue = new BigNumber(15001000000) // parseUnits('15001', 6)
      const unwindFee = new BigNumber(150010000) // parseUnits('15001', 4)

      // seller approves otc wrapper contract
      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      const maker1USDCBalBef = new BigNumber(await usdc.balanceOf(marketMaker))
      const maker1OtokenBalBef = new BigNumber(await otoken.balanceOf(marketMaker))
      const userUSDCBalBef = new BigNumber(await usdc.balanceOf(user))
      const userOtokenBalBef = new BigNumber(await otoken.balanceOf(user))
      const otcWrapperUSDCBalBef = new BigNumber(await usdc.balanceOf(otcWrapperProxy.address))

      const tx = await otcWrapperProxy.sellRedeemRights(userUnwindSignature, mmUnwindSignature, mmSignatureUSDC2, {
        from: marketMaker,
      })

      const maker1USDCBalAft = new BigNumber(await usdc.balanceOf(marketMaker))
      const maker1OtokenBalAft = new BigNumber(await otoken.balanceOf(marketMaker))
      const userUSDCBalAft = new BigNumber(await usdc.balanceOf(user))
      const userOtokenBalAft = new BigNumber(await otoken.balanceOf(user))
      const otcWrapperUSDCBalAft = new BigNumber(await usdc.balanceOf(otcWrapperProxy.address))

      assert.equal(otcWrapperUSDCBalAft.minus(otcWrapperUSDCBalBef).toString(), unwindFee.toString())
      assert.equal(maker1USDCBalBef.minus(maker1USDCBalAft).toString(), bidValue.toString())
      assert.equal(maker1OtokenBalAft.minus(maker1OtokenBalBef).toString(), size.toString())
      assert.equal(userUSDCBalAft.minus(userUSDCBalBef).toString(), bidValue.minus(unwindFee).toString())
      assert.equal(userOtokenBalBef.minus(userOtokenBalAft).toString(), size.toString())

      // emits event
      const { logs } = tx
      assert.equal(logs[0].args.orderID.toString(), '1')
      assert.equal(logs[0].args.seller.toString(), user)
      assert.equal(logs[0].args.bidder.toString(), marketMaker)
      assert.equal(logs[0].args.bidValue.toString(), bidValue)
    })
    it('reverts if buyer is the order seller', async () => {
      await expectRevert(
        otcWrapperProxy.sellRedeemRights(mmUnwindSignature3, mmUnwindSignature4, mmSignatureUSDC5, {
          from: marketMaker,
        }),
        'OTCWrapper: can not sell if same address is already long and short the option',
      )
    })
    it('user sucessfully unwinds position to another maker who holds to expiry and redeems', async () => {
      // user places order
      const strikePrice = scaleBigNum(1300, 8)
      const size = parseUnits('100', 8)

      await otcWrapperProxy.placeOrder(weth.address, false, strikePrice, expiry, parseUnits('5000', 6), size, {
        from: user,
      })

      // order gets executed
      const premium = parseUnits('5000', 6)
      const collateralAmount = parseUnits('15001', 6)
      const orderID = 2

      await otcWrapperProxy.executeOrder(
        orderID,
        userSignature2,
        mmSignatureUSDC6,
        premium,
        usdc.address,
        collateralAmount,
        {
          from: marketMaker,
        },
      )

      // user unwinds order
      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      const bidValue = new BigNumber(15001000000) // parseUnits('15001', 6)

      const tx = await otcWrapperProxy.sellRedeemRights(userUnwindSignature5, mm2UnwindSignature, mm2SignatureUSDC1, {
        from: marketMaker2,
      })

      // emits event
      const { logs } = tx
      assert.equal(logs[0].args.orderID.toString(), '2')
      assert.equal(logs[0].args.seller.toString(), user)
      assert.equal(logs[0].args.bidder.toString(), marketMaker2)
      assert.equal(logs[0].args.bidValue.toString(), bidValue)

      await otoken.approve(otcWrapperProxy.address, size, { from: marketMaker2 })

      // move to past expiry date
      await time.increase(8600000)

      // set expiry to ITM with enough collateral
      await oracle.setExpiryPriceFinalizedAllPeiodOver(weth.address, expiry, createTokenAmount(1400), true)
      await oracle.setExpiryPriceFinalizedAllPeiodOver(usdc.address, expiry, createTokenAmount(1), true)
      const payout = parseUnits('10000', 6) // user payout = (1400-1300)*100 = 10000 USDC
      const withdrawableCollateral = parseUnits('5001', 6) // 15001 - 10000 USDC

      const mm2USDCBalBef = new BigNumber(await usdc.balanceOf(marketMaker2))
      const mm2OtokenBalBef = new BigNumber(await otoken.balanceOf(marketMaker2))
      const mm1USDCBalBef = new BigNumber(await usdc.balanceOf(marketMaker))

      // call redeem and settle vault after user has unwinded the position
      await otcWrapperProxy.redeem(orderID, { from: marketMaker2 })
      await otcWrapperProxy.settleVault(orderID, { from: marketMaker })

      const mm2USDCBalAft = new BigNumber(await usdc.balanceOf(marketMaker2))
      const mm2OtokenBalAft = new BigNumber(await otoken.balanceOf(marketMaker2))
      const mm1USDCBalAft = new BigNumber(await usdc.balanceOf(marketMaker))

      assert.equal(mm2USDCBalAft.minus(mm2USDCBalBef).toString(), payout.toString())
      assert.equal(mm2OtokenBalBef.minus(mm2OtokenBalAft).toString(), size.toString())
      assert.equal(mm1USDCBalAft.minus(mm1USDCBalBef).toString(), withdrawableCollateral.toString())
    })
    it('reverts if selling redeem rights after buffer started', async () => {
      // user places order
      const strikePrice = scaleBigNum(1300, 8)
      const size = parseUnits('100', 8)
      const expiry = createValidExpiry(Number(await time.latest()), 10)

      await otcWrapperProxy.placeOrder(weth.address, false, strikePrice, expiry, parseUnits('5000', 6), size, {
        from: user,
      })

      // order gets executed
      const premium = parseUnits('5000', 6)
      const collateralAmount = parseUnits('16001', 6)
      const orderID = 3

      await otcWrapperProxy.executeOrder(
        orderID,
        userSignature3,
        mmSignatureUSDC7,
        premium,
        usdc.address,
        collateralAmount,
        {
          from: marketMaker,
        },
      )

      console.log('1', (await time.latest()).toString())

      // increase time to the forbidden buffer zone
      const timeToIncrease = new BigNumber(expiry).minus(new BigNumber(await time.latest())).minus(new BigNumber(3000))
      await time.increase(Number(timeToIncrease))

      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      console.log('2', (await time.latest()).toString())
      console.log('3', expiry.toString())

      await expectRevert(
        otcWrapperProxy.sellRedeemRights(userUnwindSignature6, mmUnwindSignature5, mmSignatureUSDC8, {
          from: marketMaker,
        }),
        'OTCWrapper: can not unwind too close to expiry',
      )
    })
  })

  describe('withdrawCollateral', () => {
    const strikePrice = scaleBigNum(1300, 8)
    const size = parseUnits('100', 8)
    let expiry: number

    it('reverts if withdrawing more than margin requirements allow', async () => {
      const withdrawAmount = parseUnits('2000', 6)
      await expectRevert(
        otcWrapperProxy.withdrawCollateral(3, withdrawAmount, { from: marketMaker }),
        'OTCWrapper: insufficient collateral',
      )
    })
    it('market maker successfully withdraws collateral when buyer different than seller', async () => {
      const orderID = 3

      const vaultBefore = await controllerProxy.getVaultWithDetails(otcWrapperProxy.address, 3)
      const vaultCollateralBefore = new BigNumber(vaultBefore[0].collateralAmounts[0])
      const marketMakerBalBeforeUSDC = new BigNumber(await usdc.balanceOf(marketMaker))
      const marginPoolBalBeforeUSDC = new BigNumber(await usdc.balanceOf(marginPool.address))

      // call withdraw collateral
      const withdrawAmount = parseUnits('1000', 6)
      const tx = await otcWrapperProxy.withdrawCollateral(orderID, withdrawAmount, { from: marketMaker })

      const vaultAfter = await controllerProxy.getVaultWithDetails(otcWrapperProxy.address, 3)
      const vaultCollateralAfter = new BigNumber(vaultAfter[0].collateralAmounts[0])
      const marketMakerBalAfterUSDC = new BigNumber(await usdc.balanceOf(marketMaker))
      const marginPoolBalAfterUSDC = new BigNumber(await usdc.balanceOf(marginPool.address))

      // token flows
      assert.equal(vaultCollateralBefore.minus(vaultCollateralAfter).toString(), withdrawAmount.toString())
      assert.equal(marketMakerBalAfterUSDC.minus(marketMakerBalBeforeUSDC).toString(), withdrawAmount.toString())
      assert.equal(marginPoolBalBeforeUSDC.minus(marginPoolBalAfterUSDC).toString(), withdrawAmount.toString())

      assert.equal((await otcWrapperProxy.orders(orderID))[12].toString(), size)

      // emits event
      const { logs } = tx
      assert.equal(logs[0].args.orderID.toString(), '3')
      assert.equal(logs[0].args.amount.toString(), withdrawAmount)
      assert.equal(logs[0].args.acct.toString(), marketMaker)
    })
    it('market maker successfully withdraws collateral when buyer is the same as the seller', async () => {
      // user places order
      expiry = createValidExpiry(Number(await time.latest()), 10)

      await otcWrapperProxy.placeOrder(weth.address, false, strikePrice, expiry, parseUnits('5000', 6), size, {
        from: user,
      })

      // order gets executed
      const premium = parseUnits('5000', 6)
      const collateralAmount = parseUnits('15001', 6)
      const orderID = 4

      await otcWrapperProxy.executeOrder(
        orderID,
        userSignature4,
        mmSignatureUSDC9,
        premium,
        usdc.address,
        collateralAmount,
        {
          from: marketMaker,
        },
      )

      const otoken = await MockERC20.at((await otcWrapperProxy.orders(orderID))[10].toString())
      await otoken.approve(otcWrapperProxy.address, size, { from: user })

      await otcWrapperProxy.sellRedeemRights(userUnwindSignature7, mmUnwindSignature6, mmSignatureUSDC10, {
        from: marketMaker,
      })

      const vaultBefore = await controllerProxy.getVaultWithDetails(otcWrapperProxy.address, 4)
      const vaultCollateralBefore = new BigNumber(vaultBefore[0].collateralAmounts[0])
      const marketMakerBalBeforeUSDC = new BigNumber(await usdc.balanceOf(marketMaker))
      const marginPoolBalBeforeUSDC = new BigNumber(await usdc.balanceOf(marginPool.address))

      // seller approves otc wrapper contract
      await otoken.approve(otcWrapperProxy.address, size, { from: marketMaker })

      // call withdraw collateral
      const withdrawAmount = parseUnits('15001', 6)
      const tx = await otcWrapperProxy.withdrawCollateral(orderID, 1, { from: marketMaker })

      const vaultAfter = await controllerProxy.getVaultWithDetails(otcWrapperProxy.address, 4)
      const vaultCollateralAfter = new BigNumber(vaultAfter[0].collateralAmounts[0])
      const marketMakerBalAfterUSDC = new BigNumber(await usdc.balanceOf(marketMaker))
      const marginPoolBalAfterUSDC = new BigNumber(await usdc.balanceOf(marginPool.address))

      // token flows
      assert.equal(vaultCollateralBefore.minus(vaultCollateralAfter).toString(), withdrawAmount.toString())
      assert.equal(marketMakerBalAfterUSDC.minus(marketMakerBalBeforeUSDC).toString(), withdrawAmount.toString())
      assert.equal(marginPoolBalBeforeUSDC.minus(marginPoolBalAfterUSDC).toString(), withdrawAmount.toString())
      assert.equal(vaultCollateralAfter.toString(), '0')

      assert.equal((await otcWrapperProxy.orders(orderID))[12].toString(), '0')

      // emits event
      const { logs } = tx
      assert.equal(logs[0].args.orderID.toString(), '4')
      assert.equal(logs[0].args.amount.toString(), withdrawAmount.toString())
      assert.equal(logs[0].args.acct.toString(), marketMaker.toString())
    })
    it('reverts if withdrawing again after vault has been emptied even if maker has still otokens left', async () => {
      // user places order
      await otcWrapperProxy.placeOrder(weth.address, false, strikePrice, expiry, parseUnits('5000', 6), size, {
        from: user,
      })

      // order gets executed
      const premium = parseUnits('5000', 6)
      const collateralAmount = parseUnits('15001', 6)
      const orderID = 5

      await otcWrapperProxy.executeOrder(
        orderID,
        userSignature5,
        mmSignatureUSDC11,
        premium,
        usdc.address,
        collateralAmount,
        {
          from: marketMaker,
        },
      )

      const otoken1 = await MockERC20.at((await otcWrapperProxy.orders(4))[10].toString())
      const otoken2 = await MockERC20.at((await otcWrapperProxy.orders(5))[10].toString())
      await otoken1.approve(otcWrapperProxy.address, size, { from: marketMaker })
      await otoken1.transfer(marketMaker, size, { from: user })

      assert.isAbove(Number(await otoken1.balanceOf(marketMaker)), 0)
      assert.equal(otoken1.toString(), otoken2.toString())

      const vault = await controllerProxy.getVaultWithDetails(otcWrapperProxy.address, 4)
      const vaultCollateral = new BigNumber(vault[0].collateralAmounts[0])
      assert.equal(vaultCollateral.toString(), '0')

      await expectRevert(otcWrapperProxy.withdrawCollateral(4, 1, { from: marketMaker }), 'V3')
    })
    it('reverts if redeeming after vault has been emptied via withdrawal', async () => {
      // move to past expiry date
      await time.increase(86000000)

      // set expiry to ITM
      await oracle.setExpiryPriceFinalizedAllPeiodOver(weth.address, expiry, createTokenAmount(1400), true)
      await oracle.setExpiryPriceFinalizedAllPeiodOver(usdc.address, expiry, createTokenAmount(1), true)

      const vault = await controllerProxy.getVaultWithDetails(otcWrapperProxy.address, 4)
      const vaultCollateral = new BigNumber(vault[0].collateralAmounts[0])
      assert.equal(vaultCollateral.toString(), '0')

      const mm1USDCBalBef = await usdc.balanceOf(marketMaker)

      await otcWrapperProxy.redeem(4, { from: marketMaker })

      const mm1USDCBalAft = await usdc.balanceOf(marketMaker)

      assert.equal(mm1USDCBalBef.toString(), mm1USDCBalAft.toString())
    })
    it('reverts if settling vault after vault has been emptied via withdrawal', async () => {
      await expectRevert(otcWrapperProxy.settleVault(4, { from: marketMaker }), 'C30')
    })
  })
})
