// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SavingCircleNft} from "./SavingCircleNft.sol";

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
            _admin,
            _maxProtocolTokenInAuction            
        );

        emit NewCircle(address(sc));

        return sc;
    }
}