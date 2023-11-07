import { getAddress } from "@zetachain/protocol-contracts";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const main = async (args: any, hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name !== "zeta_testnet") {
    throw new Error(
      '🚨 Please use the "zeta_testnet" network to deploy to ZetaChain.'
    );
  }

  const [signer] = await hre.ethers.getSigners();
  if (signer === undefined) {
    throw new Error(
      `Wallet not found. Please, run "npx hardhat account --save" or set PRIVATE_KEY env variable (for example, in a .env file)`
    );
  }

  // const systemContract = getAddress("systemContract", "zeta_testnet");
  
  const validatorNFTParams = [
    
    "Karat Validator",
    "KAV",
    "https://api.karatdao.com/nft/validator/",
    "0x1311cd1e3f1c0557dfb74dd5b266d3519d5049a6fe0724c53d42f6c089b53bb7",
    30,
    300,
];

  // Get contract factories
  const [MyERC1967Proxy, ValidatorNFT] = await Promise.all([
    hre.ethers.getContractFactory("MyERC1967Proxy"),
    hre.ethers.getContractFactory('ValidatorNFT')
  ]);

  // Deploy the implementation and wait for it to be mined
  const implementation = await ValidatorNFT.deploy();
  await implementation.deployed();

  console.log(`Implementation1 deployed to: ${implementation.address}`)
  // Encode the initialization data for the proxy
  const validatorNFTInitData = ValidatorNFT.interface.encodeFunctionData('initialize', validatorNFTParams);

  // Deploy the proxy with the implementation address and initialization data
  const validatorNFTProxy = await MyERC1967Proxy.deploy(implementation.address, validatorNFTInitData, {
    gasLimit: 5000000,
  });

  await implementation.connect(signer).initialize(validatorNFTParams[0],validatorNFTParams[1],validatorNFTParams[2],validatorNFTParams[3],validatorNFTParams[4],validatorNFTParams[5] );
  console.log(`initialized;`);
  if (args.json) {
    console.log(JSON.stringify(validatorNFTProxy));
  } else {
    console.log(`🔑 Using account: ${signer.address}

🚀 Successfully deployed contract on ZetaChain.
📜 Contract address: ${validatorNFTProxy.address}
🌍 Explorer: https://athens3.explorer.zetachain.com/address/${validatorNFTProxy.address}
`);
  }
  console.log(`Claimer initialized;`);

    // Parameters for the UserNFT contract constructor
    const userNFTParams = [
        'Karat Claimer',
        'KAC',
        validatorNFTProxy.address, // ValidatorNFT proxy contract address
        'https://api.karatdao.com/nft/claimer/',
        1500, // maxInitialKaratScore
    ];
    const ClaimerNFT = await hre.ethers.getContractFactory('ClaimerNFT')

    // Deploy the implementation and wait for it to be mined
    const implementation2 = await ClaimerNFT.deploy();
    await implementation2.deployed();
    console.log(`Implementation2 deployed to: ${implementation2.address}`)

    // Encode the initialization data for the proxy
    const claimerNFTInitData = ClaimerNFT.interface.encodeFunctionData('initialize', userNFTParams);
  
    // Deploy the proxy with the implementation address and initialization data
    const claimerNFTProxy = await MyERC1967Proxy.deploy(implementation2.address, claimerNFTInitData, {
      gasLimit: 5000000,
    });
  

    if (args.json) {
      console.log(JSON.stringify(claimerNFTProxy));
    } else {
      console.log(`🔑 Using account: ${signer.address}
  
  🚀 Successfully deployed contract on ZetaChain.
  📜 Contract address: ${claimerNFTProxy.address}
  🌍 Explorer: https://athens3.explorer.zetachain.com/address/${claimerNFTProxy.address}
  `);
    }
    await implementation2.connect(signer).initialize(userNFTParams[0],userNFTParams[1],userNFTParams[2],userNFTParams[3],userNFTParams[4]);
    console.log(`Claimer initialized;`);

};

task("deploy", "Deploy the contract", main).addFlag(
  "json",
  "Output in JSON"
);