// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SavingCircleNft} from "./SavingCircleNft.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SavingCircleFactory {

    event NewCircle(address sc);
    function createCircle(
        address _installmentToken,
        address _protocolToken,
        uint _installmentSize,
        uint _protocolTokenRewardPerInstallment,
        uint _numRounds,
        uint _startTime,
        uint _timePerRound,
        uint _numUsers,
        address _admin,
        uint _maxProtocolTokenInAuction
    )
        public
        returns(SavingCircleNft)
    {
        SavingCircleNft sc = new SavingCircleNft(
            _installmentToken,
            _protocolToken,
            _installmentSize,
            _protocolTokenRewardPerInstallment,
            _numRounds,
            _startTime,
            _timePerRound,
            _numUsers,
            address(this),
            _maxProtocolTokenInAuction            
        );

        sc.setRaffleOwner(_admin);

        require(
            IERC20(_protocolToken).transferFrom(msg.sender, address(sc), _protocolTokenRewardPerInstallment * _numUsers * _numRounds),
            "sct transfer failed"
        );

        emit NewCircle(address(sc));

        return sc;
    }
}