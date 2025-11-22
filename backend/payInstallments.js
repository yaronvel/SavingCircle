// Pays a single SavingCircle installment for account_1..account_3 from .env.

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { ethers } = require("ethers");
const SavingCircleNftArtifact = require("../out/SavingCircleNft.sol/SavingCircleNft.json");
const { abi: savingCircleAbi } = SavingCircleNftArtifact;

const ERC20_ABI = [
    "function approve(address spender, uint256 value) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

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

const getCircleAddress = (overrideAddress) => {
    if (overrideAddress) {
        return ethers.getAddress(overrideAddress);
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
        "Provide the SavingCircle address via CLI (node payInstallments.js <round> <address>), SAVING_CIRCLE_ADDRESS env var, or ensure backend/deployments/SavingCircle.json exists."
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

const parseRoundNumber = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Round must be a non-negative integer, received "${value}"`);
    }
    return parsed;
};

const resolveRoundNumber = async (circle, cliRound) => {
    if (cliRound !== undefined) {
        return parseRoundNumber(cliRound);
    }
    const envRound = getEnv("ROUND") ?? getEnv("CIRCLE_ROUND");
    if (envRound !== undefined) {
        return parseRoundNumber(envRound);
    }
    const currentRound = Number(await circle.currRound());
    console.log(`ROUND not provided; defaulting to circle.currRound() = ${currentRound}`);
    return currentRound;
};

const parseAuctionSize = (value, label) => {
    try {
        const result = typeof value === "bigint" ? value : BigInt(value);
        if (result <= 0n) throw new Error();
        return result;
    } catch {
        throw new Error(`Invalid auction size for ${label}: "${value}"`);
    }
};

const resolveDefaultAuctionSize = (circle, envValue, protocolReward) => {
    if (envValue !== undefined) {
        return parseAuctionSize(envValue, "AUCTION_SIZE");
    }
    if (protocolReward > 0n) {
        return protocolReward;
    }
    return 1n;
};

const resolveAuctionSizeForLabel = (label, defaultAuctionSize) => {
    const specific = getEnv(`${label}_auction_size`) ?? getEnv(`${label}_AUCTION_SIZE`);
    if (specific !== undefined) {
        return parseAuctionSize(specific, `${label} auction size`);
    }
    return defaultAuctionSize;
};

const ensureSufficientBalance = async (token, walletAddress, amount, tokenLabel, accountLabel) => {
    const balance = await token.balanceOf(walletAddress);
    if (balance < amount) {
        throw new Error(
            `${accountLabel} has insufficient ${tokenLabel} balance. Required ${amount}, balance ${balance}`
        );
    }
};

const ensureAllowance = async (token, wallet, spender, amount, tokenLabel, accountLabel) => {
    const currentAllowance = await token.allowance(wallet.address, spender);
    if (currentAllowance >= amount) {
        return;
    }
    console.log(
        `  approving ${tokenLabel} for ${accountLabel} (needed ${amount}, allowance ${currentAllowance})`
    );
    const tx = await token.connect(wallet).approve(spender, amount);
    console.log(`    approve tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    await tx.wait();
};

const payInstallmentForAccount = async ({
    label,
    wallet,
    circle,
    circleAddress,
    roundNumber,
    installmentToken,
    protocolToken,
    installmentTokenSymbol,
    protocolTokenSymbol,
    installmentSize,
    auctionSize
}) => {
    console.log(`Paying round ${roundNumber} for ${label} (${wallet.address}) with auctionSize=${auctionSize}`);

    await ensureSufficientBalance(installmentToken, wallet.address, installmentSize, installmentTokenSymbol, label);
    await ensureSufficientBalance(protocolToken, wallet.address, auctionSize, protocolTokenSymbol, label);

    await ensureAllowance(installmentToken, wallet, circleAddress, installmentSize, installmentTokenSymbol, label);
    await ensureAllowance(protocolToken, wallet, circleAddress, auctionSize, protocolTokenSymbol, label);

    const tx = await circle
        .connect(wallet)
        .depositRound(roundNumber, auctionSize, wallet.address);
    console.log(`  deposit tx submitted: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  deposit confirmed in block ${receipt.blockNumber}`);
};

const main = async () => {
    const provider = getRpcProvider();
    const cliRound = process.argv[2];
    const cliCircleAddress = process.argv[3];

    const circleAddress = getCircleAddress(cliCircleAddress);
    console.log(`Using SavingCircle at ${circleAddress}`);

    const circle = new ethers.Contract(circleAddress, savingCircleAbi, provider);

    const installmentTokenAddress = await circle.installmentToken();
    const protocolTokenAddress = await circle.protocolToken();
    const installmentSize = await circle.installmentSize();
    const protocolReward = await circle.protocolTokenRewardPerInstallment();
    const maxAuction = await circle.maxProtocolTokenInAuction();

    const installmentToken = new ethers.Contract(installmentTokenAddress, ERC20_ABI, provider);
    const protocolToken = new ethers.Contract(protocolTokenAddress, ERC20_ABI, provider);
    const installmentTokenSymbol = await installmentToken.symbol().catch(() => "installment token");
    const protocolTokenSymbol = await protocolToken.symbol().catch(() => "protocol token");

    const roundNumber = await resolveRoundNumber(circle, cliRound);
    const defaultAuctionSize = resolveDefaultAuctionSize(circle, getEnv("AUCTION_SIZE"), protocolReward);

    console.log(
        `installmentSize=${installmentSize} ${installmentTokenSymbol}, defaultAuctionSize=${defaultAuctionSize} ${protocolTokenSymbol}, maxAuction=${maxAuction}`
    );

    if (defaultAuctionSize > maxAuction) {
        throw new Error(
            `Default auction size ${defaultAuctionSize} exceeds maxProtocolTokenInAuction ${maxAuction}`
        );
    }

    for (const label of ACCOUNT_LABELS) {
        const walletInfo = loadWalletForLabel(label, provider);
        const auctionSize = resolveAuctionSizeForLabel(label, defaultAuctionSize);
        if (auctionSize > maxAuction) {
            throw new Error(`${label} auction size ${auctionSize} exceeds maxProtocolTokenInAuction ${maxAuction}`);
        }
        await payInstallmentForAccount({
            label,
            wallet: walletInfo.wallet,
            circle,
            circleAddress,
            roundNumber,
            installmentToken,
            protocolToken,
            installmentTokenSymbol,
            protocolTokenSymbol,
            installmentSize,
            auctionSize
        });
    }

    console.log("All three accounts paid their installments.");
};

main().catch((error) => {
    console.error("Failed to pay installments:", error);
    process.exitCode = 1;
});


