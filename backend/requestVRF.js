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

const wrapperAbi = ["function calculateRequestPriceNative(uint32,uint32) view returns (uint256)"];
const WRAPPER_ADDRESS = "0x195f15F2d49d693cE265b4fB0fdDbE15b1850Cc1";

const main = async () => {
    const { ALCHEMY_API_KEY, DEPLOYER_PRIVATE_KEY, SAVING_CIRCLE_ADDRESS, SAVING_CIRCLE_ROUND } = process.env;
    if (!SAVING_CIRCLE_ADDRESS) {
        throw new Error("SAVING_CIRCLE_ADDRESS env var is required");
    }
    const round = SAVING_CIRCLE_ROUND ? BigInt(SAVING_CIRCLE_ROUND) : 0n;
    const provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
    const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const directFundingConsumerAddress = loadDeploymentAddress();
    const signerAddress = await signer.getAddress();
    console.log(`Using signer ${signerAddress}`);
    const directFundingConsumer = new ethers.Contract(directFundingConsumerAddress, directFundingConsumerAbi, signer);
    const contractBalance = await provider.getBalance(directFundingConsumerAddress);
    console.log(`DirectFundingConsumer balance: ${ethers.formatEther(contractBalance)} ETH`);

    const numWords = await directFundingConsumer.numWords();
    const callbackGasLimit = await directFundingConsumer.callbackGasLimit();
    const wrapper = new ethers.Contract(WRAPPER_ADDRESS, wrapperAbi, provider);
    const feeData = await provider.getFeeData();
    const feeOverride = {};
    if (feeData.maxFeePerGas) {
        feeOverride.gasPrice = feeData.maxFeePerGas;
    } else if (feeData.gasPrice) {
        feeOverride.gasPrice = feeData.gasPrice;
    }
    const feeWei = await wrapper.calculateRequestPriceNative.staticCall(callbackGasLimit, numWords, feeOverride);
    console.log(
        `Wrapper native fee estimate: ${ethers.formatEther(feeWei)} ETH (gasLimit=${callbackGasLimit}, numWords=${numWords}, gasPrice=${feeOverride.gasPrice ?? 0})`
    );

    const gasEstimate =
        await directFundingConsumer.requestRandomWords.estimateGas(SAVING_CIRCLE_ADDRESS, round, true);
    console.log(`requestRandomWords gas estimate: ${gasEstimate}`);
    const gasLimit = gasEstimate * 2n;
    console.log(`Overriding gas limit to ${gasLimit}`);

    const requestTx =
        await directFundingConsumer.requestRandomWords(SAVING_CIRCLE_ADDRESS, round, true, { gasLimit });
    console.log("requestTx raw:", requestTx);
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