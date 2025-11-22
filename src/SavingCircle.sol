// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SavingCircle {
    address[] public registeredUsers;
    address[] public usersWhoDidNotWin;

    // from original user to current owner
    mapping(address => address) public addressOwner;

    // round numer to user to auction size of user
    mapping(uint => mapping(address => uint)) public roundAuctionSize;

    IERC20 immutable public installmentToken;
    IERC20 immutable public protocolToken;

    uint immutable public installmentSize;
    uint immutable public protocolTokenRewardPerInstallment;
    uint immutable public numRounds;
    uint immutable public startTime;
    uint immutable public timePerRound;
    uint immutable public numUsers;

    uint public nextRoundToPay = 0;

    constructor(
        address _installmentToken,
        address _protocolToken,
        uint _installmentSize,
        uint _protocolTokenRewardPerInstallment,
        uint _numRounds,
        uint _startTime,
        uint _timePerRound,
        uint _numUsers
    )
    {
        installmentToken = IERC20(_installmentToken);
        protocolToken = IERC20(_protocolToken);
        installmentSize = _installmentSize;
        protocolTokenRewardPerInstallment = _protocolTokenRewardPerInstallment;
        numRounds = _numRounds;
        startTime = _startTime;
        timePerRound = _timePerRound;
        numUsers = _numUsers;

        require(numUsers == numRounds, "numUsers != numRounds is currently not supported");
    }

    event UserRegister(address a);
    function register() public {
        require(addressOwner[msg.sender] == address(0), "already registered");
        require(registeredUsers.length < numUsers, "circle is full");
        require(startTime > block.timestamp, "too late to join");

        addressOwner[msg.sender] = msg.sender;
        registeredUsers.push(msg.sender);
        usersWhoDidNotWin.push(msg.sender);

        emit UserRegister(msg.sender);
    }

    event UserDepositRound(uint round, uint auctionSize, address originalUser);
    function depositRound(uint round, uint auctionSize, address originalUser) public {
        require(addressOwner[originalUser] == msg.sender, "not owner");
        require(roundAuctionSize[round][originalUser] == 0, "already paid");
        require(auctionSize > 0, "auction size 0 not allowed");
        require(round < numRounds, "round number too high");
        require(roundDeadline(round) >= block.timestamp, "too late to pay");
        require(isCurrent(originalUser), "user is bad");
        require(numUsers == registeredUsers.length, "not enough registered");

        require(installmentToken.transferFrom(msg.sender, address(this), installmentSize), "installment pay failed");

        require(protocolToken.transfer(msg.sender, protocolTokenRewardPerInstallment));
        require(protocolToken.transferFrom(msg.sender, address(this), auctionSize), "installment pay failed");

        roundAuctionSize[round][originalUser] = auctionSize;

        emit UserDepositRound(round, auctionSize, originalUser);
    }

    function roundDeadline(uint round) public view returns(uint) {
        return startTime + timePerRound * round;
    }

    function nextRound() public view returns(uint) {
        if(block.timestamp < startTime) return 0;

        return 1 + ((block.timestamp - startTime) / timePerRound);
    }

    event RaffleWin(uint round, uint seed, address winner);
    function raffle(uint round, uint seed) internal {
        require(round == nextRoundToPay, "previous rounds were not settled yet");
        require(roundDeadline(round) <= block.timestamp, "too early to pay the round");

        // select the winner

        uint totalAuctionForRound = 0;
        for(uint i = 0 ; i < usersWhoDidNotWin.length ; i++) {
            totalAuctionForRound += roundAuctionSize[round][usersWhoDidNotWin[i]];
        }

        uint winThreshold = seed % totalAuctionForRound;
        uint weightSoFar = 0;
        uint winnerIndex = 0;
        for(winnerIndex = 0 ; winnerIndex < usersWhoDidNotWin.length ; winnerIndex++) {
            weightSoFar += roundAuctionSize[round][usersWhoDidNotWin[winnerIndex]];
            if(weightSoFar >= winThreshold) break;
        }

        // pay minimum between balance and installment * num rounds
        uint rewardSize = installmentSize * numRounds;
        uint availBalance = installmentToken.balanceOf(address(this));

        if(availBalance < rewardSize) rewardSize = availBalance;
        address winner = addressOwner[usersWhoDidNotWin[winnerIndex]];

        require(installmentToken.transfer(winner, rewardSize), "reward payment failed");

        // remove from array
        usersWhoDidNotWin[winnerIndex] = usersWhoDidNotWin[usersWhoDidNotWin.length - 1];
        usersWhoDidNotWin.pop();

        emit RaffleWin(round, seed, winner);        
    }

    function isCurrent(address user) public view returns(bool) {
        if(nextRound() == 0) return true;

        return roundAuctionSize[nextRound() - 1][user] > 0;        
    }
}

