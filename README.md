# 🌀 Saving Circles

> A fair and verifiable way to save money together, rebuilt for the internet.

Saving Circles brings the world's oldest financial tool, the rotating savings association, into a transparent and programmable onchain environment.

**People pool money over time. Each round, one member receives the full pot.**

No trust needed. No hidden rules. No coordinators.

Built with **Chainlink VRF** for fair selection and **NFT seats** for liquidity.

Saving together becomes simple, safe, and accessible.

---

## 📁 Project Structure

> This section is placed at the top so judges can quickly find what relates to their track.

### What is in this repository

```
SavingCircle-main/
├── src/                         
│   ├── SavingCircle.sol          # Core ROSCA logic
│   ├── SavingCircleNft.sol       # NFT seats with ownership sync
│   ├── SavingCircleSeat.sol      # Alternative NFT implementation
│   ├── SavingCircleFactory.sol   # Deploys new circles with parameters
│   └── DirectFundingConsumer.sol # Chainlink VRF integration
│
├── backend/
│   ├── createCircle.js           # Deploys a circle through the factory
│   ├── registerUsers.js          # Registers test users and mints seats
│   ├── payInstallments.js        # Automates installment + bid payments
│   ├── requestVRF.js             # Requests Chainlink VRF and triggers raffles
│   └── deployments/              # Deployment files for quick verification
│
├── test/
│   └── SavingCircle.t.sol        # Complete Foundry test suite
│
└── script/                       # Onchain deployment scripts
```

### Where each judge should look

#### 🔗 Chainlink Judges
- `DirectFundingConsumer.sol` - VRF consumer contract
- `SavingCircle.sol` (function `raffle`) - Winner selection logic
- `backend/requestVRF.js` - VRF request automation
- Test suite shows VRF driven state changes

#### 🔒 Protocol Labs Judges
- Fully onchain coordination logic in `SavingCircle.sol`
- NFT seat transfer system with acceptance pattern in `SavingCircleNft.sol`
- Potential extensions discussed in the Roadmap section

#### 💰 Circles Judges
- Mortgageable seat model in "Liquid ROSCA positions"
- Future trust graph extension in Roadmap and Bounties section

---

## 🌍 Why Saving Circles

Across Latin America, Africa, and Asia, millions rely on **ROSCAs**, **consórcios**, **tandas**, **ekubs**, **chamas**, and **susus** because saving money alone is hard.

Banks are slow, expensive, or simply not designed for many people's realities.

These systems work, but they come with serious limitations.

### Problems in traditional circles

- ❌ **Draws can be rigged** - No verifiable fairness
- ❌ **No proof that the process was fair** - Trust-based selection
- ❌ **If you want to leave, you lose everything** - No exit mechanism
- ❌ **Groups collapse when people stop paying** - Fragile coordination
- ❌ **Trust does not scale beyond neighbors or family** - Limited reach

### Saving Circles upgrades this model for the modern world

- ✅ **Transparent and verifiable rules** - All logic onchain
- ✅ **Fair and tamper proof randomness** - Chainlink VRF
- ✅ **Transferable seats that can be sold or mortgaged** - NFT-based liquidity
- ✅ **Automated rounds without human coordinators** - Smart contract execution
- ✅ **Global circles where trust is replaced by math** - Cryptographic guarantees

**Saving together becomes predictable, fair, and liquid.**

---

## 🔍 What Saving Circles Does

### ✔ Fair and weighted raffles

Every round, members deposit their installment.

They can add a small bid in the protocol token to increase their win probability.

**Chainlink VRF selects the winner with provable fairness.**

### ✔ Seats as NFTs

Participants receive an NFT that represents their position.

The NFT carries all future rights to winnings.

**It can be transferred or resold at any moment.**

### ✔ Liquid ROSCA positions

A seat NFT can be used as collateral.

Lenders can price the remaining rounds and expected probability of winning.

**A participant can mortgage their seat to unlock capital early.**

### ✔ Fully onchain

All rules live in a smart contract.

There is no coordinator.

There is no trusted party.

---

## 🔐 Feature Examples

### ✔ Fair raffle using Chainlink VRF

**Ana** is part of a circle to buy a laptop.

She wants reassurance that the draw is not rigged.

**Chainlink VRF provides a verifiable result she can audit anytime.**

Trust comes from cryptography, not from a person.

---

### ✔ NFT seat that you can sell

**Mauro** loses his job during round 3.

In a normal ROSCA he would be stuck or rejected.

**With Saving Circles he can sell his NFT seat to someone else.**

The new owner continues the payments and still has a chance to win.

**The group stays alive even when life changes.**

---

### ✔ Liquid position mortgage

**Luciana** needs funds for a medical bill.

She has contributed three rounds but has not won yet.

**She mortgages her seat to a small lender.**

If she wins, the repayment is automatic.

If she does not, the lender receives the NFT to recover value.

**This transforms a rigid and illiquid structure into a flexible financial instrument.**

---

## ⚙️ How It Works

### High Level Flow

1. **Factory deploys a new circle** - Configurable parameters (users, rounds, timing)
2. **Participants register and receive an NFT seat** - One seat per participant
3. **Each round includes:**
   - Installment payment (stablecoin)
   - Optional bid (protocol token)
4. **Chainlink VRF provides randomness** - Verifiable and tamper-proof
5. **Contract selects winner using weighted randomness** - Higher bids = higher probability
6. **Winner claims the full pot** - All pooled installments
7. **Winner is removed from future rounds** - Ensures everyone wins once
8. **All participants win exactly once** - Fair distribution

### Technology Breakdown

- **`SavingCircle.sol`** - Handles deposits, bids, rounds, and payouts
- **`SavingCircleNft.sol`** - Mints seat NFTs and syncs real owners
- **`DirectFundingConsumer.sol`** - Connects Chainlink VRF to onchain raffles
- **Backend scripts** - Automate circle creation, payments, and raffles
- **Foundry tests** - Validate the entire lifecycle

---

## 🧭 Roadmap

Saving Circles has long term potential as a global cooperative finance primitive.

### Planned Improvements

- 🏦 Mortgageable positions backed by pooled lenders  
- 🤖 Automated round progression using CRE workflows  
- 🔗 Circles CRC integration for trust based credit boosts  
- ⭐ Reputation system using Circles trust scores  
- 🔐 Private circles using zero knowledge identity  
- 💰 Yield vaults for idle installments  
- 🌐 Cross chain circles using CCIP  
- 📱 API support for wallets and digital banks  
- ⚙️ Flexible installment structures  

---

## 🏆 Hackathon Bounties

> This section is separate from the Roadmap to ensure clarity for judges.

### 🔗 Chainlink Track

#### Connect the World with Chainlink

Saving Circles uses **Chainlink VRF** to select winners and update contract state.

The randomness is verifiable and cannot be manipulated.

#### Best Workflow With Chainlink CRE

**Planned integration.**

A CRE workflow will automate round progression by:

- Monitoring deadlines
- Verifying payments
- Triggering VRF requests
- Triggering payouts

**The workflow acts as a coordinator without trust.**

---

### 🔒 Protocol Labs Tracks

#### Secure, Sovereign Systems

Saving Circles removes the need for a trusted ROSCA coordinator entirely.

**The system is censorship resistant and tamper proof.**

#### Decentralized Economies, Incentives and Governance

Millions of people already use ROSCAs offline.

Saving Circles turns this global practice into an open incentive system:

- Weighted but fair selection
- Transferable and mortgageable seats
- Token based participation rewards

#### AI and Autonomous Infrastructure

A CRE workflow could connect to an AI agent that monitors circle health and assists users.

---

### 💰 Circles Track (Optional Future Submission)

Saving Circles can use the **Circles trust graph** to underwrite seat mortgages.

**Trust relationships become a credit scoring system for ROSCA lending.**

---

## 🌐 Deployments

### Sepolia Testnet

- **Factory**: `0x2c28AC6AA2F17e8DFa3E2561338c6357EAD53c32`
- **Sample Circle**: `0xCa3B006D7150453BE95CB7a5946c67749FD1757d`
- **VRF Consumer**: `0x9aB7e0EC6ceD707b2B8eBb06b9697a085bD201B4`

### Test Tokens (Sepolia)

- **Installment Token** (Fake USDC): `0x61d8485717c7DDa1a1A6723EF511c0814ddDb738`
- **Protocol Token** (Fake SCT): `0x400A417fEDEef43Fc5b8be0D8cD6DF687847Ee8D`

### Chainlink VRF (Sepolia)

- **VRF Wrapper**: `0x195f15F2d49d693cE265b4fB0fdDbE15b1850Cc1`
- **LINK Token**: `0x779877A7B0D9E8603169DdbD7836e478b4624789`

---

---

## 🔗 Links

- [Frontend Demo](https://savingcircles.vercel.app/) - Frontend Demo
- [Frontend Repo](https://github.com/1uizeth/front-savingcircles/) - Complete Frontend UI Repo

---

## 🧠 Team

Contributors from the Buenos Aires builder crew



---

## 🙏 Acknowledgments

Built during **ETHGlobal Buenos Aires 2025** for communities who save together and support each other.


---

**Saving together, built for the internet.** 🌐


---

## 🚀 Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- pnpm (or npm)

### Setup

```bash
# Install Foundry dependencies
forge install

# Install Node.js dependencies
cd backend && pnpm install

# Set up environment variables
cp .env.example .env
# Fill in your RPC_URL, ALCHEMY_API_KEY, and private keys
```

### Build & Test

```bash
# Build contracts
forge build

# Run tests
forge test

# Run with verbose output
forge test -vvv
```

### Deploy & Run

```bash
# Deploy a new circle
node backend/createCircle.js

# Register users
node backend/registerUsers.js

# Pay installments (automated)
node backend/payInstallments.js

# Request VRF for winner selection
export SAVING_CIRCLE_ADDRESS=0x...
export SAVING_CIRCLE_ROUND=0
node backend/requestVRF.js
```
