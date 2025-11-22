// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SavingCircle is Ownable {
    address[] public registeredUsers;
    address[] public usersWhoDidNotWin;

    // from original user to current owner
    mapping(address => address) public addressOwner;

    // round numer to user to auction size of user
    mapping(uint256 => mapping(address => uint256)) public roundAuctionSize;

    mapping(uint256 => bool) roundPlayed;

    IERC20 public immutable installmentToken;
    IERC20 public immutable protocolToken;

    uint256 public immutable installmentSize;
    uint256 public immutable protocolTokenRewardPerInstallment;
    uint256 public immutable numRounds;
    uint256 public immutable startTime;
    uint256 public immutable timePerRound;
    uint256 public immutable numUsers;

    uint256 public nextRoundToPay = 0;

    address public raffleOwner = address(0);

    uint256 public immutable maxProtocolTokenInAuction;

    constructor(
        address _installmentToken,
        address _protocolToken,
        uint256 _installmentSize,
        uint256 _protocolTokenRewardPerInstallment,
        uint256 _numRounds,
        uint256 _startTime,
        uint256 _timePerRound,
        uint256 _numUsers,
        address _admin,
        uint256 _maxProtocolTokenInAuction
    ) Ownable(_admin) {
        installmentToken = IERC20(_installmentToken);
        protocolToken = IERC20(_protocolToken);
        installmentSize = _installmentSize;
        protocolTokenRewardPerInstallment = _protocolTokenRewardPerInstallment;
        numRounds = _numRounds;
        startTime = _startTime;
        timePerRound = _timePerRound;
        numUsers = _numUsers;
        maxProtocolTokenInAuction = _maxProtocolTokenInAuction;

        require(numUsers == numRounds, "numUsers != numRounds is currently not supported");
    }

    event RaffleOwnerSet(address a);

    function setRaffleOwner(address a) public onlyOwner {
        raffleOwner = a;

        emit RaffleOwnerSet(a);
    }

    event UserRegister(address a);

    function register() public virtual {
        require(addressOwner[msg.sender] == address(0), "already registered");
        require(registeredUsers.length < numUsers, "circle is full");
        require(startTime > block.timestamp, "too late to join");

        addressOwner[msg.sender] = msg.sender;
        registeredUsers.push(msg.sender);
        usersWhoDidNotWin.push(msg.sender);

        emit UserRegister(msg.sender);
    }

    event UserDepositRound(uint256 round, uint256 auctionSize, address originalUser);

    function depositRound(uint256 round, uint256 auctionSize, address originalUser) public {
        require(addressOwner[originalUser] == msg.sender, "not owner");
        require(roundAuctionSize[round][originalUser] == 0, "already paid");
        require(auctionSize > 0, "auction size 0 not allowed");
        require(round < numRounds, "round number too high");
        require(roundDeadline(round) >= block.timestamp, "too late to pay");
        require(isCurrent(originalUser), "user is bad");
        require(numUsers == registeredUsers.length, "not enough registered");
        require(auctionSize <= maxProtocolTokenInAuction, "auction exceeds max");

        require(installmentToken.transferFrom(msg.sender, address(this), installmentSize), "installment pay failed");

        require(protocolToken.transfer(msg.sender, protocolTokenRewardPerInstallment));
        require(protocolToken.transferFrom(msg.sender, address(this), auctionSize), "installment pay failed");

        roundAuctionSize[round][originalUser] = auctionSize;

        emit UserDepositRound(round, auctionSize, originalUser);
    }

    function roundDeadline(uint256 round) public view returns (uint256) {
        return startTime + timePerRound * (round + 1);
    }

    function currRound() public view returns (uint256) {
        if (block.timestamp < startTime) return 0;

        return ((block.timestamp - startTime) / timePerRound);
    }

    event RaffleWin(uint256 round, uint256 seed, address winner);

    function raffle(uint256 round, uint256 seed) public {
        require(msg.sender == raffleOwner, "not raffle owner");
        require(round == nextRoundToPay, "previous rounds were not settled yet");
        require(roundDeadline(round) <= block.timestamp, "too early to pay the round");
        require(!roundPlayed[round], "round already played");

        // select the winner

        uint256 totalAuctionForRound = 0;
        for (uint256 i = 0; i < usersWhoDidNotWin.length; i++) {
            totalAuctionForRound += roundAuctionSize[round][usersWhoDidNotWin[i]];
        }

        uint256 winThreshold = seed % totalAuctionForRound;
        uint256 weightSoFar = 0;
        uint256 winnerIndex = 0;
        for (winnerIndex = 0; winnerIndex < usersWhoDidNotWin.length; winnerIndex++) {
            weightSoFar += roundAuctionSize[round][usersWhoDidNotWin[winnerIndex]];
            if (weightSoFar >= winThreshold) break;
        }

        // pay minimum between balance and installment * num rounds
        uint256 rewardSize = installmentSize * numRounds;
        uint256 availBalance = installmentToken.balanceOf(address(this));

        if (availBalance < rewardSize) rewardSize = availBalance;
        address winner = addressOwner[usersWhoDidNotWin[winnerIndex]];

        require(installmentToken.transfer(winner, rewardSize), "reward payment failed");

        // remove from array
        usersWhoDidNotWin[winnerIndex] = usersWhoDidNotWin[usersWhoDidNotWin.length - 1];
        usersWhoDidNotWin.pop();

        roundPlayed[round] = true;

        nextRoundToPay++;

        emit RaffleWin(round, seed, winner);
    }

    function isCurrent(address user) public view returns (bool) {
        if (currRound() == 0) return true;

        return roundAuctionSize[currRound() - 1][user] > 0;
    }
}

