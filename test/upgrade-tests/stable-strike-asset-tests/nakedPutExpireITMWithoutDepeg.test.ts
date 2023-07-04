import {
  MockERC20Instance,
  MarginCalculatorInstance,
  AddressBookInstance,
  MockOracleInstance,
  OtokenInstance,
  ControllerInstance,
  WhitelistInstance,
  MarginPoolInstance,
  OtokenFactoryInstance,
} from '../../../build/types/truffle-types'
import { createTokenAmount, createValidExpiry, createScaledBigNumber as scaleBigNum } from '../../utils'
import BigNumber from 'bignumber.js'

const { time } = require('@openzeppelin/test-helpers')
const { parseUnits } = require('ethers/lib/utils')
const AddressBook = artifacts.require('AddressBook.sol')
const MockOracle = artifacts.require('MockOracle.sol')
const Otoken = artifacts.require('Otoken.sol')
const MockERC20 = artifacts.require('MockERC20.sol')
const MarginCalculator = artifacts.require('MarginCalculator.sol')
const Whitelist = artifacts.require('Whitelist.sol')
const MarginPool = artifacts.require('MarginPool.sol')
const Controller = artifacts.require('Controller.sol')
const MarginVault = artifacts.require('MarginVault.sol')
const OTokenFactory = artifacts.require('OtokenFactory.sol')
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

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
}

contract('Naked Put Option with USDC collateral and stable strike asset expires Itm flow without depeg', ([accountOwner1, buyer]) => {
  let expiry: number

  let addressBook: AddressBookInstance
  let calculator: MarginCalculatorInstance
  let controllerImplementation: ControllerInstance
  let controllerProxy: ControllerInstance
  let marginPool: MarginPoolInstance
  let whitelist: WhitelistInstance
  let otokenImplementation: OtokenInstance
  let otokenFactory: OtokenFactoryInstance

  // oracle module mock
  let oracle: MockOracleInstance

  let stableStrikeAsset: MockERC20Instance
  let usdc: MockERC20Instance
  let weth: MockERC20Instance

  let ethPut: OtokenInstance
  const strikePrice = 1400

  const optionsAmount = 10
  const collateralAmount = optionsAmount * strikePrice
  let vaultCounter: number

  const stableStrikeAssetDecimals = 18
  const usdcDecimals = 6
  const wethDecimals = 18

  before('set up contracts', async () => {
    const now = (await time.latest()).toNumber()
    expiry = createValidExpiry(now, 30)

    // setup stableStrikeAsset, usdc and weth
    stableStrikeAsset = await MockERC20.new('stableStrikeAsset', 'SSA', stableStrikeAssetDecimals)
    usdc = await MockERC20.new('USDC', 'USDC', usdcDecimals)
    weth = await MockERC20.new('WETH', 'WETH', wethDecimals)

    // initiate addressbook first.
    addressBook = await AddressBook.new()
    // setup margin pool
    marginPool = await MarginPool.new(addressBook.address)
    // setup margin vault
    const lib = await MarginVault.new()
    // setup controller module
    await Controller.link('MarginVault', lib.address)
    controllerImplementation = await Controller.new(addressBook.address)
    // setup mock Oracle module
    oracle = await MockOracle.new(addressBook.address)
    // setup calculator
    calculator = await MarginCalculator.new(oracle.address, addressBook.address)
    // setup whitelist module
    whitelist = await Whitelist.new(addressBook.address)
    // whitelist product and collateral
    await whitelist.whitelistCollateral(usdc.address)
    await whitelist.whitelistProduct(weth.address, stableStrikeAsset.address, usdc.address, true)
    await whitelist.whitelistNakedCollateral(usdc.address, weth.address, true)
    // set upper bound values and spot shock
    // In combination when the spot shock and upperBoundValue are set to a very high number and anvery low number respectively,
    // they make the Opyn restrictions to be very low collateral - which means that our restrictions from MarginRequirements.sol are the ones that become active
    const upperBoundValue = 1
    await calculator.setUpperBoundValues(
      weth.address,
      stableStrikeAsset.address,
      usdc.address,
      true,
      [expiry],
      [upperBoundValue],
    )
    await calculator.setSpotShock(weth.address, stableStrikeAsset.address, usdc.address, true, scaleBigNum(1500, 35))
    // setup otoken
    otokenImplementation = await Otoken.new()
    // setup factory
    otokenFactory = await OTokenFactory.new(addressBook.address)

    // setup address book
    await addressBook.setOracle(oracle.address)
    await addressBook.setMarginCalculator(calculator.address)
    await addressBook.setWhitelist(whitelist.address)
    await addressBook.setMarginPool(marginPool.address)
    await addressBook.setOtokenFactory(otokenFactory.address)
    await addressBook.setOtokenImpl(otokenImplementation.address)
    await addressBook.setController(controllerImplementation.address)

    const controllerProxyAddress = await addressBook.getController()
    controllerProxy = await Controller.at(controllerProxyAddress)

    // set naked cap collateral to high number
    await controllerProxy.setNakedCap(usdc.address, parseUnits('1', 25))

    await otokenFactory.createOtoken(
      weth.address,
      stableStrikeAsset.address,
      usdc.address,
      createTokenAmount(strikePrice),
      expiry,
      true,
    )
    const ethPutAddress = await otokenFactory.getOtoken(
      weth.address,
      stableStrikeAsset.address,
      usdc.address,
      createTokenAmount(strikePrice),
      expiry,
      true,
    )

    ethPut = await Otoken.at(ethPutAddress)

    // mint usdc to user
    const accountOwner1Usdc = createTokenAmount(10 * collateralAmount, usdcDecimals)
    await usdc.mint(accountOwner1, accountOwner1Usdc)

    // have the user approve all the usdc transfers
    await usdc.approve(marginPool.address, accountOwner1Usdc, { from: accountOwner1 })

    const vaultCounterBefore = new BigNumber(await controllerProxy.getAccountVaultCounter(accountOwner1))
    vaultCounter = vaultCounterBefore.toNumber() + 1
  })

  describe('Integration test: Close a naked put after it expires ITM without depeg', () => {
    const scaledOptionsAmount = createTokenAmount(optionsAmount, 8)
    const scaledCollateralAmount = createTokenAmount(collateralAmount, usdcDecimals)
    const expirySpotPrice = 1300

    before('Seller should be able to open a short put option', async () => {
      // set oracle price
      await oracle.setRealTimePrice(stableStrikeAsset.address, scaleBigNum(1, 8))
      await oracle.setRealTimePrice(weth.address, scaleBigNum(1500, 8))

      const actionArgs = [
        {
          actionType: ActionType.OpenVault,
          owner: accountOwner1,
          secondAddress: accountOwner1,
          asset: ZERO_ADDR,
          vaultId: vaultCounter,
          amount: '0',
          index: '0',
          data: web3.eth.abi.encodeParameter('uint256', 1), // Vault type 1
        },
        {
          actionType: ActionType.MintShortOption,
          owner: accountOwner1,
          secondAddress: accountOwner1,
          asset: ethPut.address,
          vaultId: vaultCounter,
          amount: scaledOptionsAmount,
          index: '0',
          data: ZERO_ADDR,
        },
        {
          actionType: ActionType.DepositCollateral,
          owner: accountOwner1,
          secondAddress: accountOwner1,
          asset: usdc.address,
          vaultId: vaultCounter,
          amount: scaledCollateralAmount,
          index: '0',
          data: ZERO_ADDR,
        },
      ]

      await controllerProxy.operate(actionArgs, { from: accountOwner1 })
    })

    it('Seller: close an ITM position after expiry', async () => {
      // Keep track of balances before
      const ownerUsdcBalanceBefore = new BigNumber(await usdc.balanceOf(accountOwner1))
      const marginPoolUsdcBalanceBefore = new BigNumber(await usdc.balanceOf(marginPool.address))
      const ownerOtokenBalanceBefore = new BigNumber(await ethPut.balanceOf(accountOwner1))
      const oTokenSupplyBefore = new BigNumber(await ethPut.totalSupply())

      // TODO double check this
      // We skip checking that we start at a valid state since we override the Rsyk margin requirements
      const vaultBefore = await controllerProxy.getVaultWithDetails(accountOwner1, vaultCounter)
      // const vaultStateBefore = await calculator.getExcessCollateral(vaultBefore[0], vaultBefore[1])
      // assert.equal(vaultStateBefore[0].toString(), '0')
      // assert.equal(vaultStateBefore[1], true)

      // Set the oracle price
      if ((await time.latest()) < expiry) {
        await time.increaseTo(expiry + 2)
      }
      const strikePriceChange = Math.max(strikePrice - expirySpotPrice, 0)
      const scaledETHPrice = createTokenAmount(expirySpotPrice, 8)
      const scaledUSDCPrice = createTokenAmount(1)
      const scaledStableStrikeAssetPrice = createTokenAmount(1)
      await oracle.setExpiryPriceFinalizedAllPeiodOver(weth.address, expiry, scaledETHPrice, true)
      await oracle.setExpiryPriceFinalizedAllPeiodOver(usdc.address, expiry, scaledUSDCPrice, true)
      await oracle.setExpiryPriceFinalizedAllPeiodOver(
        stableStrikeAsset.address,
        expiry,
        scaledStableStrikeAssetPrice,
        true,
      )

      const collateralPayout = collateralAmount - strikePriceChange * optionsAmount
      const scaledPayout = createTokenAmount(collateralPayout, usdcDecimals)

      // Check that after expiry, the vault excess balance has updated as expected
      const vaultStateBeforeSettlement = await calculator.getExcessCollateral(vaultBefore[0], vaultBefore[1])
      assert.equal(vaultStateBeforeSettlement[0].toString(), scaledPayout)
      assert.equal(vaultStateBeforeSettlement[1], true)

      const actionArgs = [
        {
          actionType: ActionType.SettleVault,
          owner: accountOwner1,
          secondAddress: accountOwner1,
          asset: ZERO_ADDR,
          vaultId: vaultCounter,
          amount: '0',
          index: '0',
          data: ZERO_ADDR,
        },
      ]

      await controllerProxy.operate(actionArgs, { from: accountOwner1 })

      // keep track of balances after
      const ownerUsdcBalanceAfter = new BigNumber(await usdc.balanceOf(accountOwner1))
      const marginPoolUsdcBalanceAfter = new BigNumber(await usdc.balanceOf(marginPool.address))

      const ownerOtokenBalanceAfter = new BigNumber(await ethPut.balanceOf(accountOwner1))
      const oTokenSupplyAfter = new BigNumber(await ethPut.totalSupply())

      // check balances before and after changed as expected
      assert.equal(ownerUsdcBalanceBefore.plus(scaledPayout).toString(), ownerUsdcBalanceAfter.toString())
      assert.equal(marginPoolUsdcBalanceBefore.minus(scaledPayout).toString(), marginPoolUsdcBalanceAfter.toString())
      assert.equal(ownerOtokenBalanceBefore.toString(), ownerOtokenBalanceAfter.toString())
      assert.equal(oTokenSupplyBefore.toString(), oTokenSupplyAfter.toString())

      // Check that we end at a valid state
      const vaultAfter = await controllerProxy.getVaultWithDetails(accountOwner1, vaultCounter)
      const vaultStateAfter = await calculator.getExcessCollateral(vaultAfter[0], vaultAfter[1])
      assert.equal(vaultStateAfter[0].toString(), '0')
      assert.equal(vaultStateAfter[1], true)

      // Check the vault balances stored in the contract
      assert.equal(vaultAfter[0].shortOtokens.length, 0, 'Length of the short otoken array in the vault is incorrect')
      assert.equal(vaultAfter[0].collateralAssets.length, 0, 'Length of the collateral array in the vault is incorrect')
      assert.equal(vaultAfter[0].longOtokens.length, 0, 'Length of the long otoken array in the vault is incorrect')

      assert.equal(vaultAfter[0].shortAmounts.length, 0, 'Length of the short amounts array in the vault is incorrect')
      assert.equal(
        vaultAfter[0].collateralAmounts.length,
        0,
        'Length of the collateral amounts array in the vault is incorrect',
      )
      assert.equal(vaultAfter[0].longAmounts.length, 0, 'Length of the long amounts array in the vault is incorrect')
    })

    it('Buyer: redeem ITM put option after expiry', async () => {
      // owner sells their put option
      await ethPut.transfer(buyer, scaledOptionsAmount, { from: accountOwner1 })
      // oracle price decreases
      const strikePriceChange = Math.max(strikePrice - expirySpotPrice, 0)

      // Keep track of balances before
      const ownerUsdcBalanceBefore = new BigNumber(await usdc.balanceOf(buyer))
      const marginPoolUsdcBalanceBefore = new BigNumber(await usdc.balanceOf(marginPool.address))
      const ownerOtokenBalanceBefore = new BigNumber(await ethPut.balanceOf(buyer))
      const oTokenSupplyBefore = new BigNumber(await ethPut.totalSupply())

      const actionArgs = [
        {
          actionType: ActionType.Redeem,
          owner: buyer,
          secondAddress: buyer,
          asset: ethPut.address,
          vaultId: '0',
          amount: scaledOptionsAmount,
          index: '0',
          data: ZERO_ADDR,
        },
      ]

      await controllerProxy.operate(actionArgs, { from: buyer })

      // keep track of balances after
      const ownerUsdcBalanceAfter = new BigNumber(await usdc.balanceOf(buyer))
      const marginPoolUsdcBalanceAfter = new BigNumber(await usdc.balanceOf(marginPool.address))
      const ownerOtokenBalanceAfter = new BigNumber(await ethPut.balanceOf(buyer))
      const oTokenSupplyAfter = new BigNumber(await ethPut.totalSupply())

      const payout = strikePriceChange * optionsAmount
      const scaledPayout = createTokenAmount(payout, usdcDecimals)

      // check balances before and after changed as expected
      assert.equal(ownerUsdcBalanceBefore.plus(scaledPayout).toString(), ownerUsdcBalanceAfter.toString())
      assert.equal(marginPoolUsdcBalanceBefore.minus(scaledPayout).toString(), marginPoolUsdcBalanceAfter.toString())
      assert.equal(ownerOtokenBalanceBefore.minus(scaledOptionsAmount).toString(), ownerOtokenBalanceAfter.toString())
      assert.equal(oTokenSupplyBefore.minus(scaledOptionsAmount).toString(), oTokenSupplyAfter.toString())
    })
  })
})
