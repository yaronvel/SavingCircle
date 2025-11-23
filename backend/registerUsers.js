// We call register() on a freshly deployed SavingCircle using three accounts.

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { ethers } = require("ethers");
const SavingCircleNftArtifact = require("../out/SavingCircleNft.sol/SavingCircleNft.json");
const { abi: savingCircleAbi } = SavingCircleNftArtifact;

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

const INSTALLMENT_SEED_AMOUNT = 100n; // whole-token amount provided to each participant
const PROTOCOL_TOKEN_SEED_AMOUNT = 100n; // whole-token amount of protocol token per participant

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

const getDeployerWallet = (provider) => {
    const pk = getEnv("DEPLOYER_PRIVATE_KEY") ?? getEnv("deployer_private_key");
    if (!pk) {
        throw new Error("Missing DEPLOYER_PRIVATE_KEY in .env for funding installment tokens.");
    }
    return new ethers.Wallet(pk, provider);
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

const seedInstallmentTokens = async ({ label, wallet }, ctx) => {
    const { deployerWallet, installmentToken, installmentSeedAmount, installmentTokenSymbol } = ctx;
    console.log(
        `Funding ${label} (${wallet.address}) with ${INSTALLMENT_SEED_AMOUNT} ${installmentTokenSymbol} (${installmentSeedAmount} base units)`
    );
    const tx = await installmentToken.connect(deployerWallet).transfer(wallet.address, installmentSeedAmount);
    console.log(`  funding tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  funding confirmed in block ${receipt.blockNumber}`);
};

const seedProtocolTokens = async ({ label, wallet }, ctx) => {
    const { deployerWallet, protocolToken, protocolSeedAmount, protocolTokenSymbol } = ctx;
    console.log(
        `Funding ${label} (${wallet.address}) with ${PROTOCOL_TOKEN_SEED_AMOUNT} ${protocolTokenSymbol} (${protocolSeedAmount} base units)`
    );
    const tx = await protocolToken.connect(deployerWallet).transfer(wallet.address, protocolSeedAmount);
    console.log(`  protocol funding tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  protocol funding confirmed in block ${receipt.blockNumber}`);
};

const approveInstallmentSpend = async ({ label, wallet }, ctx) => {
    const { installmentToken, circleAddress, installmentSeedAmount, installmentTokenSymbol } = ctx;
    console.log(
        `Approving SavingCircle (${circleAddress}) to spend ${INSTALLMENT_SEED_AMOUNT} ${installmentTokenSymbol} for ${label}`
    );
    const tx = await installmentToken.connect(wallet).approve(circleAddress, installmentSeedAmount);
    console.log(`  approve tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  approve confirmed in block ${receipt.blockNumber}`);
};

const approveProtocolSpend = async ({ label, wallet }, ctx) => {
    const { protocolToken, circleAddress, protocolTokenSymbol } = ctx;
    console.log(`Approving SavingCircle (${circleAddress}) to spend unlimited ${protocolTokenSymbol} for ${label}`);
    const tx = await protocolToken.connect(wallet).approve(circleAddress, ethers.MaxUint256);
    console.log(`  protocol approve tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  protocol approve confirmed in block ${receipt.blockNumber}`);
};

const registerWithWallet = async ({ label, wallet }, contract) => {
    console.log(`Registering ${label} (${wallet.address})`);
    const tx = await contract.connect(wallet).register();
    console.log(`  register tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  register confirmed in block ${receipt.blockNumber}`);
};

const main = async () => {
    const provider = getRpcProvider();
    const circleAddress = getCircleAddress();
    console.log(`Using SavingCircle at ${circleAddress}`);

    const circle = new ethers.Contract(circleAddress, savingCircleAbi, provider);
    const installmentTokenAddress = await circle.installmentToken();
    const protocolTokenAddress = await circle.protocolToken();
    const installmentToken = new ethers.Contract(installmentTokenAddress, ERC20_ABI, provider);
    const protocolToken = new ethers.Contract(protocolTokenAddress, ERC20_ABI, provider);
    const decimals = await installmentToken.decimals().catch(() => 18);
    const protocolDecimals = await protocolToken.decimals().catch(() => 18);
    const installmentTokenSymbol = await installmentToken.symbol().catch(() => "installment token");
    const protocolTokenSymbol = await protocolToken.symbol().catch(() => "protocol token");
    const installmentSeedAmount = INSTALLMENT_SEED_AMOUNT * 10n ** BigInt(decimals);
    const protocolSeedAmount = PROTOCOL_TOKEN_SEED_AMOUNT * 10n ** BigInt(protocolDecimals);
    const deployerWallet = getDeployerWallet(provider);
    console.log(
        `Using deployer ${await deployerWallet.getAddress()} to fund ${INSTALLMENT_SEED_AMOUNT} ${installmentTokenSymbol} and ${PROTOCOL_TOKEN_SEED_AMOUNT} ${protocolTokenSymbol} per account`
    );

    for (const label of ACCOUNT_LABELS) {
        const walletInfo = loadWalletForLabel(label, provider);
        await seedInstallmentTokens(walletInfo, {
            deployerWallet,
            installmentToken,
            installmentSeedAmount,
            installmentTokenSymbol
        });
        await seedProtocolTokens(walletInfo, {
            deployerWallet,
            protocolToken,
            protocolSeedAmount,
            protocolTokenSymbol
        });
        await approveInstallmentSpend(walletInfo, {
            installmentToken,
            circleAddress,
            installmentSeedAmount,
            installmentTokenSymbol
        });
        await approveProtocolSpend(walletInfo, {
            protocolToken,
            circleAddress,
            protocolTokenSymbol
        });
        await registerWithWallet(walletInfo, circle);
    }

    console.log("All three accounts registered successfully.");
};

main().catch((error) => {
    console.error("Failed to register users:", error);
    process.exitCode = 1;
});

