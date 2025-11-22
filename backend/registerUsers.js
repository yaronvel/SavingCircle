// We call register() on a freshly deployed SavingCircle using three accounts.

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { ethers } = require("ethers");
const SavingCircleNftArtifact = require("../out/SavingCircleNft.sol/SavingCircleNft.json");
const { abi: savingCircleAbi } = SavingCircleNftArtifact;

const ACCOUNT_LABELS = ["account_1", "account_2", "account_3"];
const circleDeploymentFile = path.join(__dirname, "deployments", "SavingCircle.json");

const getEnv = (key) => process.env[key] ?? process.env[key.toUpperCase()];

const getRpcProvider = () => {
    const rpcUrl = getEnv("RPC_URL");
    const alchemyKey = getEnv("ALCHEMY_API_KEY");
    if (rpcUrl) {
        return new ethers.JsonRpcProvider(rpcUrl);
    }
    if (alchemyKey) {
        return new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`);
    }
    throw new Error("Please set RPC_URL or ALCHEMY_API_KEY in your .env file.");
};

const loadCircleAddressFromFile = () => {
    if (!fs.existsSync(circleDeploymentFile)) {
        return null;
    }
    try {
        const data = JSON.parse(fs.readFileSync(circleDeploymentFile, "utf-8"));
        return data.address;
    } catch (err) {
        console.warn(`Warning: Unable to parse ${circleDeploymentFile}: ${err.message}`);
        return null;
    }
};

const getCircleAddress = () => {
    const cliAddress = process.argv[2];
    if (cliAddress) {
        return ethers.getAddress(cliAddress);
    }

    const envAddress = getEnv("SAVING_CIRCLE_ADDRESS");
    if (envAddress) {
        return ethers.getAddress(envAddress);
    }

    const fileAddress = loadCircleAddressFromFile();
    if (fileAddress) {
        console.log(`Loaded SavingCircle address ${fileAddress} from ${circleDeploymentFile}`);
        return ethers.getAddress(fileAddress);
    }

    throw new Error(
        "Provide the SavingCircle address via CLI (node registerUsers.js <address>), SAVING_CIRCLE_ADDRESS env var, or ensure backend/deployments/SavingCircle.json exists."
    );
};

const loadWalletForLabel = (label, provider) => {
    const addressValue = getEnv(label);
    const pkValue = getEnv(`${label}_pk`);
    if (!pkValue) {
        throw new Error(`Missing ${label}_pk in .env`);
    }
    const wallet = new ethers.Wallet(pkValue, provider);
    const walletAddress = wallet.address;
    if (addressValue) {
        const normalized = ethers.getAddress(addressValue);
        if (normalized !== walletAddress) {
            console.warn(`Warning: ${label} address (${normalized}) does not match derived wallet address (${walletAddress}). Using wallet.`);
        }
    }
    return { label, wallet };
};

const registerWithWallet = async ({ label, wallet }, contract) => {
    console.log(`Registering ${label} (${wallet.address})`);
    const tx = await contract.connect(wallet).register();
    console.log(`  tx submitted: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  confirmed in block ${receipt.blockNumber}`);
};

const main = async () => {
    const provider = getRpcProvider();
    const circleAddress = getCircleAddress();
    console.log(`Using SavingCircle at ${circleAddress}`);

    const circle = new ethers.Contract(circleAddress, savingCircleAbi, provider);

    for (const label of ACCOUNT_LABELS) {
        const walletInfo = loadWalletForLabel(label, provider);
        await registerWithWallet(walletInfo, circle);
    }

    console.log("All three accounts registered successfully.");
};

main().catch((error) => {
    console.error("Failed to register users:", error);
    process.exitCode = 1;
});

