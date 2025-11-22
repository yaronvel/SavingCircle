/**
 * Steps:
 * 1. deploy the DirectFundingConsumer contract
 * 2. Fund the contract with native ETH
 * 3. Request a VRF
 * 4. Wait for the VRF to be fulfilled
 * 5. Print the random words
 */

// Here we call the deployed DirectFundingConsumer contract to request a VRF
// We use ALCHEMY_API_KEY to get the provider
// load the .env file
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();
const DirectFundingConsumerArtifact = require("../out/DirectFundingConsumer.sol/DirectFundingConsumer.json");
const { abi: directFundingConsumerAbi } = DirectFundingConsumerArtifact;
const deploymentFilePath = path.join(__dirname, "deployments", "DirectFundingConsumer.json");

const loadDeploymentAddress = () => {
    if (!fs.existsSync(deploymentFilePath)) {
        throw new Error(`Deployment file not found at ${deploymentFilePath}. Please run deployAndFundContract.js first.`);
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentFilePath, "utf-8"));
    if (!deployment.address) {
        throw new Error(`No address field found in ${deploymentFilePath}`);
    }
    return deployment.address;
};
const { ethers } = require("ethers");

const main = async () => {
    const { ALCHEMY_API_KEY, DEPLOYER_PRIVATE_KEY } = process.env;
    const provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
    const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const directFundingConsumerAddress = loadDeploymentAddress();
    const directFundingConsumer = new ethers.Contract(directFundingConsumerAddress, directFundingConsumerAbi, signer);
    const contractBalance = await provider.getBalance(directFundingConsumerAddress);
    console.log(`DirectFundingConsumer balance: ${ethers.formatEther(contractBalance)} ETH`);

    const requestTx = await directFundingConsumer.requestRandomWords(true);
    console.log(`Request tx submitted: https://sepolia.etherscan.io/tx/${requestTx.hash}`);
    const receipt = await requestTx.wait();
    console.log(`Request confirmed in block ${receipt.blockNumber}`);
    const requestId = await directFundingConsumer.lastRequestId();
    console.log(`Request ID: ${requestId.toString()}`);

    let requestStatus;
    while (true) {
        requestStatus = await directFundingConsumer.getRequestStatus(requestId);
        if (requestStatus.fulfilled) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log("Request fulfilled:", requestStatus);
    console.log("Random words:", requestStatus.randomWords.map(word => word.toString()));

}

main();