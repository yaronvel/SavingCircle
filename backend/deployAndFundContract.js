// Here we deploy the DirectFundingConsumer contract and fund it with native ETH
// We use ALCHEMY_API_KEY to get the provider
// We use DEPLOYER_PRIVATE_KEY to deploy and fund the contract
// load the .env file
const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const path = require("path");
const DirectFundingConsumerArtifact = require("../out/DirectFundingConsumer.sol/DirectFundingConsumer.json");
const { abi: directFundingConsumerAbi, bytecode: directFundingConsumerBytecode } = DirectFundingConsumerArtifact;
const deploymentsDir = path.join(__dirname, "deployments");
const deploymentFilePath = path.join(deploymentsDir, "DirectFundingConsumer.json");
const { ethers } = require("ethers");

const main = async () => {
    const { ALCHEMY_API_KEY } = process.env;
    const provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const deployer = new ethers.Wallet(deployerPrivateKey, provider);
    const directFundingConsumerFactory = new ethers.ContractFactory(directFundingConsumerAbi, directFundingConsumerBytecode, deployer);
    const directFundingConsumer = await directFundingConsumerFactory.deploy();
    const deploymentTx = directFundingConsumer.deploymentTransaction();
    console.log(`Deployment submitted: https://sepolia.etherscan.io/tx/${deploymentTx.hash}`);
    await directFundingConsumer.waitForDeployment();
    const deployedAddress = directFundingConsumer.target;
    console.log("DirectFundingConsumer contract deployed to:", deployedAddress);
    // fund the contract with native ETH
    const fundingAmount = ethers.parseEther("0.5");
    const fundingTx = await deployer.sendTransaction({
        to: deployedAddress,
        value: fundingAmount,
    });
    await fundingTx.wait();
    console.log("Contract funded with native ETH");
    const network = await provider.getNetwork();
    fs.mkdirSync(deploymentsDir, { recursive: true });
    fs.writeFileSync(
        deploymentFilePath,
        JSON.stringify(
            {
                address: deployedAddress,
                chainId: network.chainId.toString(),
                networkName: network.name,
                deployedAt: new Date().toISOString()
            },
            null,
            2
        )
    );
    console.log(`Deployment info written to ${deploymentFilePath}`);
}

main();