// Pays every SavingCircle installment for account_1..account_3, one round at a time.

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
        "Provide the SavingCircle address via CLI (node payInstallments.js <address>), SAVING_CIRCLE_ADDRESS env var, or ensure backend/deployments/SavingCircle.json exists."
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchLatestTimestamp = async (provider) => {
    const block = await provider.getBlock("latest");
    if (!block) {
        throw new Error("Unable to fetch latest block from provider.");
    }
    return Number(block.timestamp);
};

const waitForTimestamp = async ({ provider, targetTimestamp, label, pollIntervalSeconds }) => {
    while (true) {
        const now = await fetchLatestTimestamp(provider);
        if (now >= targetTimestamp) {
            return;
        }
        const waitSeconds = Math.min(targetTimestamp - now, pollIntervalSeconds);
        console.log(
            `${label}: waiting ${waitSeconds}s (chain ts=${now}, target=${targetTimestamp})`
        );
        await sleep(waitSeconds * 1000);
    }
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
    auctionSize,
    startTime,
    timePerRound,
    provider
}) => {
    const alreadyPaid = await circle.roundAuctionSize(roundNumber, wallet.address);
    if (alreadyPaid > 0n) {
        console.log(`  ${label} already paid round ${roundNumber}, skipping`);
        return;
    }

    const roundDeadline = startTime + timePerRound * (roundNumber + 1);
    const chainNow = await fetchLatestTimestamp(provider);
    if (chainNow >= roundDeadline) {
        console.warn(
            `  Skipping ${label} for round ${roundNumber}: missed deadline (${chainNow} >= ${roundDeadline})`
        );
        return;
    }

    console.log(`  Paying round ${roundNumber} for ${label} (${wallet.address}) with auctionSize=${auctionSize}`);

    await ensureSufficientBalance(installmentToken, wallet.address, installmentSize, installmentTokenSymbol, label);
    await ensureSufficientBalance(protocolToken, wallet.address, auctionSize, protocolTokenSymbol, label);

    await ensureAllowance(installmentToken, wallet, circleAddress, installmentSize, installmentTokenSymbol, label);
    await ensureAllowance(protocolToken, wallet, circleAddress, auctionSize, protocolTokenSymbol, label);

    const tx = await circle
        .connect(wallet)
        .depositRound(roundNumber, auctionSize, wallet.address);
    console.log(`    deposit tx submitted: https://sepolia.etherscan.io/tx/${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`    deposit confirmed in block ${receipt.blockNumber}`);
};

const main = async () => {
    const provider = getRpcProvider();
    const cliCircleAddress = process.argv[2];

    const circleAddress = getCircleAddress(cliCircleAddress);
    console.log(`Using SavingCircle at ${circleAddress}`);

    const circle = new ethers.Contract(circleAddress, savingCircleAbi, provider);

    const [
        installmentTokenAddress,
        protocolTokenAddress,
        installmentSize,
        protocolReward,
        maxAuction,
        startTime,
        timePerRound,
        numRounds
    ] = await Promise.all([
        circle.installmentToken(),
        circle.protocolToken(),
        circle.installmentSize(),
        circle.protocolTokenRewardPerInstallment(),
        circle.maxProtocolTokenInAuction(),
        circle.startTime(),
        circle.timePerRound(),
        circle.numRounds()
    ]);

    const installmentToken = new ethers.Contract(installmentTokenAddress, ERC20_ABI, provider);
    const protocolToken = new ethers.Contract(protocolTokenAddress, ERC20_ABI, provider);
    const installmentTokenSymbol = await installmentToken.symbol().catch(() => "installment token");
    const protocolTokenSymbol = await protocolToken.symbol().catch(() => "protocol token");

    const defaultAuctionSize = resolveDefaultAuctionSize(circle, getEnv("AUCTION_SIZE"), protocolReward);

    console.log(
        `installmentSize=${installmentSize} ${installmentTokenSymbol}, defaultAuctionSize=${defaultAuctionSize} ${protocolTokenSymbol}, maxAuction=${maxAuction}`
    );

    if (defaultAuctionSize > maxAuction) {
        throw new Error(
            `Default auction size ${defaultAuctionSize} exceeds maxProtocolTokenInAuction ${maxAuction}`
        );
    }

    const startTimeSeconds = Number(startTime);
    const timePerRoundSeconds = Number(timePerRound);
    const numRoundsCount = Number(numRounds);
    const pollIntervalSeconds = Number(getEnv("ROUND_POLL_INTERVAL_SECONDS") ?? 30);

    const accountInfos = ACCOUNT_LABELS.map((label) => {
        const walletInfo = loadWalletForLabel(label, provider);
        const auctionSize = resolveAuctionSizeForLabel(label, defaultAuctionSize);
        if (auctionSize > maxAuction) {
            throw new Error(`${label} auction size ${auctionSize} exceeds maxProtocolTokenInAuction ${maxAuction}`);
        }
        return {
            label,
            wallet: walletInfo.wallet,
            auctionSize
        };
    });

    console.log(
        `startTime=${startTimeSeconds}, timePerRound=${timePerRoundSeconds}s, numRounds=${numRoundsCount}, pollInterval=${pollIntervalSeconds}s`
    );

    for (let round = 0; round < numRoundsCount; round++) {
        const roundStart = startTimeSeconds + timePerRoundSeconds * round;
        console.log(`\n=== Round ${round} payments ===`);
        await waitForTimestamp({
            provider,
            targetTimestamp: roundStart,
            label: `Round ${round}`,
            pollIntervalSeconds
        });

        const roundTasks = accountInfos.map((info) =>
            payInstallmentForAccount({
                label: info.label,
                wallet: info.wallet,
                circle,
                circleAddress,
                roundNumber: round,
                installmentToken,
                protocolToken,
                installmentTokenSymbol,
                protocolTokenSymbol,
                installmentSize,
                auctionSize: info.auctionSize,
                startTime: startTimeSeconds,
                timePerRound: timePerRoundSeconds,
                provider
            })
        );
        await Promise.all(roundTasks);

        console.log(`Completed round ${round} for all accounts.`);
    }

    console.log("All rounds completed for all accounts.");
};

main().catch((error) => {
    console.error("Failed to pay installments:", error);
    process.exitCode = 1;
});


