// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingCircleSeat} from "./SavingCircleSeat.sol";

contract SavingCircle is SavingCircleSeat {
    address[] public registeredUsers;
    address[] public usersWhoDidNotWin;

    // from original user to current owner
    mapping(address => address) public addressOwner;
    mapping(address => uint256) public seatTokenId;
    mapping(uint256 => address) public originalUserOfToken;

    // round numer to user to auction size of user
    mapping(uint256 => mapping(address => uint256)) roundAuctionSize;

    IERC20 public immutable installmentToken;
    IERC20 public immutable protocolToken;

    uint256 public immutable installmentSize;
    uint256 public immutable protocolTokenRewardPerInstallment;
    uint256 public immutable numRounds;
    uint256 public immutable startTime;
    uint256 public immutable timePerRound;
    uint256 public immutable numUsers;

    uint256 public nextRoundToPay = 0;

    error UnknownSeat(uint256 tokenId);
    error UnauthorizedSeatCaller();

    constructor(
        address _installmentToken,
        address _protocolToken,
        uint256 _installmentSize,
        uint256 _protocolTokenRewardPerInstallment,
        uint256 _numRounds,
        uint256 _startTime,
        uint256 _timePerRound,
        uint256 _numUsers
    ) SavingCircleSeat() {
        installmentToken = IERC20(_installmentToken);
        protocolToken = IERC20(_protocolToken);
        installmentSize = _installmentSize;
        protocolTokenRewardPerInstallment = _protocolTokenRewardPerInstallment;
        numRounds = _numRounds;
        startTime = _startTime;
        timePerRound = _timePerRound;
        numUsers = _numUsers;
    }

    event UserRegister(address a);

    function register() public {
        require(addressOwner[msg.sender] == address(0), "already registered");
        require(registeredUsers.length < numUsers, "circle is full");
        require(startTime > block.timestamp, "too late to join");

        uint256 tokenId = _mintSeat(msg.sender);
        seatTokenId[msg.sender] = tokenId;
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

        require(installmentToken.transferFrom(msg.sender, address(this), installmentSize), "installment pay failed");

        require(protocolToken.transfer(msg.sender, protocolTokenRewardPerInstallment));
        require(protocolToken.transferFrom(msg.sender, address(this), auctionSize), "installment pay failed");

        roundAuctionSize[round][originalUser] = auctionSize;

        emit UserDepositRound(round, auctionSize, originalUser);
    }

    function roundDeadline(uint256 round) public view returns (uint256) {
        return startTime + timePerRound * round;
    }

    function nextRound() public view returns (uint256) {
        if (block.timestamp < startTime) return 0;

        return 1 + ((block.timestamp - startTime) / timePerRound);
    }

    event RaffleWin(uint256 round, uint256 seed, address winner);

    function raffle(uint256 round, uint256 seed) internal {
        require(round == nextRoundToPay, "previous rounds were not settled yet");
        require(roundDeadline(round) <= block.timestamp, "too early to pay the round");

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

        emit RaffleWin(round, seed, winner);
    }

    function isCurrent(address user) public view returns (bool) {
        if (nextRound() == 0) return true;

        return roundAuctionSize[nextRound() - 1][user] > 0;
    }

    function updateAddressOwner(uint256 tokenId, address from, address to) external {
        if (msg.sender != address(this)) revert UnauthorizedSeatCaller();
        _setSeatOwnership(tokenId, from, to);
    }

    function _onSeatTransfer(address from, address to, uint256 tokenId) internal override {
        _setSeatOwnership(tokenId, from, to);
    }

    function _setSeatOwnership(uint256 tokenId, address from, address to) internal {
        require(to != address(0), "invalid new owner");

        address original = originalUserOfToken[tokenId];
        if (original == address(0)) {
            if (from != address(0)) revert UnknownSeat(tokenId);
            originalUserOfToken[tokenId] = to;
            original = to;
        }

        addressOwner[original] = to;
    }
}

