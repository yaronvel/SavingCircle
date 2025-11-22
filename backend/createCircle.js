// We use the factory from src/SavingCircleFactory to create a new circle on Sepolia

const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const SavingCircleFactoryArtifact = require("../out/SavingCircleFactory.sol/SavingCircleFactory.json");
const { abi: savingCircleFactoryAbi } = SavingCircleFactoryArtifact;

const deployedFactoryAddress = "0x2c28AC6AA2F17e8DFa3E2561338c6357EAD53c32";
const deploymentsDir = path.join(__dirname, "deployments");
const circleDeploymentFile = path.join(deploymentsDir, "SavingCircle.json");

/**
 * Optionally pre-fill the 10 constructor arguments (see `argumentNames` below).
 * Leaving this empty means you must supply all args via CLI or CIRCLE_ARGS.
 *
 * You can either:
 *   1. Provide an ordered array that matches `argumentNames`, or
 *   2. Provide an object keyed by the argument name without the leading underscore
 *      (e.g. `installmentToken`, `protocolToken`, ...).
 */

// start time slightly in the future so users can register before it locks
const startTime = Math.floor(Date.now() / 1000) + 30; // 30s buffer

const constructorArguments = [
    "0x61d8485717c7DDa1a1A6723EF511c0814ddDb738", // _installmentToken (fake USDC on Sepolia)
    "0x400A417fEDEef43Fc5b8be0D8cD6DF687847Ee8D", // _protocolToken (fake SCT)
    100n, // _installmentSize
    10n, // _protocolTokenRewardPerInstallment
    3n, // _numRounds
    BigInt(startTime), // _startTime (epoch seconds)
    60n, // _timePerRound (seconds)
    3n, // _numUsers
    "0xfCF94DD41B2B5d6C887a30273F995d01bacA1A45", // _admin
    1_000_000_000n // _maxProtocolTokenInAuction
];

const argumentNames = [
    "_installmentToken",
    "_protocolToken",
    "_installmentSize",
    "_protocolTokenRewardPerInstallment",
    "_numRounds",
    "_startTime",
    "_timePerRound",
    "_numUsers",
    "_admin",
    "_maxProtocolTokenInAuction"
];

const addressArgumentIndexes = new Set([0, 1, 8]);

const getRpcProvider = () => {
    const { RPC_URL, ALCHEMY_API_KEY } = process.env;
    if (RPC_URL) {
        return new ethers.JsonRpcProvider(RPC_URL);
    }
    if (ALCHEMY_API_KEY) {
        return new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
    }
    throw new Error("Please set RPC_URL or ALCHEMY_API_KEY in your .env file.");
};

const getDeployer = (provider) => {
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.deployer_private_key;
    if (!deployerPrivateKey) {
        throw new Error("Please set DEPLOYER_PRIVATE_KEY (or deployer_private_key) in your .env file.");
    }
    return new ethers.Wallet(deployerPrivateKey, provider);
};

const coerceArgValue = (value, index) => {
    const label = argumentNames[index];
    if (value === undefined || value === null || value === "") {
        throw new Error(`Missing value for ${label}`);
    }

    if (addressArgumentIndexes.has(index)) {
        return ethers.getAddress(value);
    }

    try {
        return typeof value === "bigint" ? value : BigInt(value);
    } catch {
        throw new Error(`Unable to parse numeric argument ${label} from value "${value}"`);
    }
};

const buildArgsFromObject = (obj) => {
    return argumentNames.map((name) => {
        const trimmed = name.startsWith("_") ? name.slice(1) : name;
        const value = obj[trimmed] ?? obj[name];
        if (value === undefined) {
            throw new Error(`Missing "${trimmed}" in constructorArguments object`);
        }
        return value;
    });
};

const parseCircleArguments = () => {
    const cliArgs = process.argv.slice(2);
    let rawArgs;

    if (cliArgs.length > 0) {
        rawArgs = cliArgs;
    } else if (Array.isArray(constructorArguments) && constructorArguments.length > 0) {
        rawArgs = constructorArguments;
    } else if (
        constructorArguments &&
        typeof constructorArguments === "object" &&
        Object.keys(constructorArguments).length > 0
    ) {
        rawArgs = buildArgsFromObject(constructorArguments);
    } else if (process.env.CIRCLE_ARGS) {
        try {
            rawArgs = JSON.parse(process.env.CIRCLE_ARGS);
            if (!Array.isArray(rawArgs)) {
                throw new Error("CIRCLE_ARGS must be a JSON array of 10 values.");
            }
        } catch (err) {
            throw new Error(`Failed to parse CIRCLE_ARGS env var as JSON: ${err.message}`);
        }
    } else {
        throw new Error(
            "No circle arguments supplied. Pass 10 CLI args, set CIRCLE_ARGS (JSON array), or fill `constructorArguments`."
        );
    }

    if (rawArgs.length !== argumentNames.length) {
        throw new Error(
            `Expected ${argumentNames.length} arguments (${argumentNames.join(
                ", "
            )}), but received ${rawArgs.length}.`
        );
    }

    return rawArgs.map((arg, index) => coerceArgValue(arg, index));
};

const logArguments = (args) => {
    console.log("createCircle arguments:");
    args.forEach((arg, index) => {
        const label = argumentNames[index];
        const isAddress = addressArgumentIndexes.has(index);
        console.log(`  - ${label}: ${isAddress ? arg : arg.toString()}`);
    });
};

const serializeArg = (value, index) => {
    if (addressArgumentIndexes.has(index)) {
        return value;
    }
    return value.toString();
};

const persistDeployment = async (circleAddress, args, txHash) => {
    const payload = {
        address: circleAddress,
        factory: deployedFactoryAddress,
        txHash,
        createdAt: new Date().toISOString(),
        args: argumentNames.reduce((acc, name, idx) => {
            acc[name] = serializeArg(args[idx], idx);
            return acc;
        }, {})
    };
    fs.mkdirSync(deploymentsDir, { recursive: true });
    fs.writeFileSync(circleDeploymentFile, JSON.stringify(payload, null, 2));
    console.log(`Deployment info written to ${circleDeploymentFile}`);
};

const main = async () => {
    const provider = getRpcProvider();
    const deployer = getDeployer(provider);
    const circleArgs = parseCircleArguments();
    logArguments(circleArgs);

    const factory = new ethers.Contract(deployedFactoryAddress, savingCircleFactoryAbi, deployer);
    const deployerAddress = await deployer.getAddress();
    console.log(`Using deployer ${deployerAddress} to call createCircle on ${deployedFactoryAddress}`);

    const tx = await factory.createCircle(...circleArgs);
    console.log(`Transaction submitted: https://sepolia.etherscan.io/tx/${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    const event = receipt.logs
        .map((log) => {
            try {
                return factory.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((parsed) => parsed && parsed.name === "NewCircle");

    const circleAddress = event?.args?.sc;
    if (!circleAddress) {
        console.warn("NewCircle event not found in receipt logs. Check the transaction details for the deployed address.");
        return;
    }
    console.log(`New SavingCircle deployed at: ${circleAddress}`);
    await persistDeployment(circleAddress, circleArgs, tx.hash);
};

main().catch((error) => {
    console.error("Failed to create circle:", error);
    process.exitCode = 1;
});
