const yargs = require('yargs')

const OTCWrapper = artifacts.require('OTCWrapper.sol')
const Whitelist = artifacts.require('Whitelist.sol')
const MarginCalculator = artifacts.require('MarginCalculator.sol')
const Oracle = artifacts.require('Oracle.sol')
const MarginRequirements = artifacts.require('MarginRequirements.sol')

// Call Example
// npx truffle exec scripts/addNewToken.js --network mainnet --asset 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984 --collateralAsset 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --strikeAsset 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --pricerAddress 0x95ceF11d1F6621a2CC326cf92a560aCDACb3d66d

module.exports = async function(callback) {
  try {
    const options = yargs
      .usage(
        'Usage: --network <network> --asset <asset>',
      )
      .option('network', {describe: 'Network name', type: 'string', demandOption: true})
      .option('asset', {describe: 'Asset address', type: 'string', demandOption: true})
      .option('collateralAsset', {describe: 'Asset address', type: 'string', demandOption: true})
      .option('strikeAsset', {describe: 'Asset address', type: 'string', demandOption: true})
      .option('pricerAddress', {describe: 'Asset address', type: 'string', demandOption: true}).argv

    console.log(`Making setup tx on ${options.network} 🍕`)
    console.log(`newUnderlyingAddress ${options.asset} 🍕`)
    console.log(`collateralAsset ${options.collateralAsset} 🍕`)
    console.log(`strikeAsset ${options.strikeAsset} 🍕`)
    console.log(`pricerAddress ${options.pricerAddress} 🍕`)
    
    const newUnderlyingAddress = options.asset;
    const collateralAsset = options.collateralAsset;
    const strikeAsset = options.strikeAsset;
    const pricerAddress = options.pricerAddress;

    // Contract mainnet addresses
    let otcWrapperProxy = await OTCWrapper.at('0x5feDa53467125c7789C30376f91082B1FCAe4989');
    let whitelist = await Whitelist.at('0xb7FeF6d81a09A15A986F804Dc71A1d05b7fa08f3');
    let calculator = await MarginCalculator.at('0x5cd207745EEB2eb27F563bb2ADE645d1593f07F1');
    let oracle = await Oracle.at('0xC69C49BAc000e6310Aa055aF5593E0EBf603332e');
    let marginRequirements = await MarginRequirements.at('0xc272F964A74AB7d2b4fD4bA27F6cc27887b833a7');

    // MM addresses
    const Genesis = "0x57bfaa4781E2f5aD8955fe01E2bB2e5c40F6c354";
    const Ampersan = "0xa0b4ed5ccfc91ef092636aa33807962fc3ace05c";
    const Orbit = "0x54c39a7FA0D8CAa251Bad55c7abeFA43BC8ba749"
    const GSR = "0x4337941A2Fe5d22e3f70850b69931D97044Dc176";
    const Galaxy = "0x00785c534822928073063bFaeBe6C5b3100AB06D";  

    // Setup txs - OTC Wrapper
    const tx1 = await otcWrapperProxy.setFee(newUnderlyingAddress, 1000);
    const tx2 = await otcWrapperProxy.setMaxDeviation(newUnderlyingAddress, 200);
    const tx3 = await otcWrapperProxy.setMinMaxNotional(newUnderlyingAddress, 10000000000, 1000000000000);
    console.log(``)
    console.log(`setFee - Transaction hash: ${tx1.transactionHash}`)
    console.log(`setMaxDeviation- Transaction hash: ${tx2.transactionHash}`)
    console.log(`setMinMaxNotional - Transaction hash: ${tx3.transactionHash}`)

    // Setup txs - Whitelist
    const tx4 = await whitelist.whitelistProduct(newUnderlyingAddress, strikeAsset, collateralAsset, true);
    const tx5 = await whitelist.whitelistProduct(newUnderlyingAddress, strikeAsset, collateralAsset, false);
    const tx6 = await whitelist.whitelistNakedCollateral(collateralAsset, newUnderlyingAddress, true);
    const tx7 = await whitelist.whitelistNakedCollateral(collateralAsset, newUnderlyingAddress, false);
    console.log(``)
    console.log(`whitelistProduct - true - Transaction hash: ${tx4.transactionHash}`)
    console.log(`whitelistProduct - false - Transaction hash: ${tx5.transactionHash}`)
    console.log(`whitelistNakedCollateral - true - Transaction hash: ${tx6.transactionHash}`)
    console.log(`whitelistNakedCollateral - false - Transaction hash: ${tx7.transactionHash}`)

    // Setup txs - MarginCalculator
    const tx8 = await calculator.setSpotShock(newUnderlyingAddress, strikeAsset, collateralAsset, true, "100000000000000000000000000000000000000");
    const tx9 = await calculator.setSpotShock(newUnderlyingAddress, strikeAsset, collateralAsset, false, "100000000000000000000000000000000000000");
    const tx10 = await calculator.setUpperBoundValues(newUnderlyingAddress, strikeAsset, collateralAsset, true, [2532681063], [1]);
    const tx11 = await calculator.setUpperBoundValues(newUnderlyingAddress, strikeAsset, collateralAsset, false, [2532681063], [1]);
    console.log(``)
    console.log(`setSpotShock - true - Transaction hash: ${tx8.transactionHash}`)
    console.log(`setSpotShock - false - Transaction hash: ${tx9.transactionHash}`)    
    console.log(`setUpperBoundValues - true - Transaction hash: ${tx10.transactionHash}`)
    console.log(`setUpperBoundValues - false - Transaction hash: ${tx11.transactionHash}`)  

    // Setup txs - Oracle
    const tx12 = await oracle.setAssetPricer(newUnderlyingAddress, pricerAddress);
    const tx13 = await oracle.setDisputePeriod(pricerAddress, 1500); // 25 minutes = 1500 seconds
    console.log(``)
    console.log(`setAssetPricer - Transaction hash: ${tx12.transactionHash}`)
    console.log(`setDisputePeriod - Transaction hash: ${tx13.transactionHash}`)

    // Setup txs - MarginRequirements
    // Genesis
    const tx14 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, true, Genesis, 3000);
    const tx15 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, false, Genesis, 3000);
    // Ampersan
    const tx16 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, true, Ampersan, 3000);
    const tx17 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, false, Ampersan, 3000);
    // Orbit
    const tx18 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, true, Orbit, 2000);
    const tx19 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, false, Orbit, 2000);
    // GSR
    const tx20 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, true, GSR, 3000);
    const tx21 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, false, GSR, 3000);
    // Galaxy
    const tx22 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, true, Galaxy, 3000);
    const tx23 = await marginRequirements.setInitialMargin(newUnderlyingAddress, collateralAsset, false, Galaxy, 3000);
    console.log(``)
    console.log(`setInitialMargin - Genesis - true Transaction hash: ${tx14.transactionHash}`)
    console.log(`setInitialMargin - Genesis - false Transaction hash: ${tx15.transactionHash}`)
    console.log(`setInitialMargin - Ampersan - true Transaction hash: ${tx16.transactionHash}`)
    console.log(`setInitialMargin - Ampersan - false Transaction hash: ${tx17.transactionHash}`)
    console.log(`setInitialMargin - Orbit - true Transaction hash: ${tx18.transactionHash}`)
    console.log(`setInitialMargin - Orbit - false Transaction hash: ${tx19.transactionHash}`)
    console.log(`setInitialMargin - GSR - true Transaction hash: ${tx20.transactionHash}`)
    console.log(`setInitialMargin - GSR - false Transaction hash: ${tx21.transactionHash}`)
    console.log(`setInitialMargin - Galaxy - true Transaction hash: ${tx22.transactionHash}`)
    console.log(`setInitialMargin - Galaxy - false Transaction hash: ${tx23.transactionHash}`)

    callback()
  } catch (err) {
    callback(err)
  }
}
