// contracts/GameItem.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {SavingCircle} from "./SavingCircle.sol";

contract SavingCircleSeat is SavingCircle, ERC721URIStorage {
    uint256 private _nextTokenId;
    mapping(uint256 => address) private _acceptedRecipient;
    mapping(address => uint256) public seatTokenId;

    error NotAuthorized(address operator, uint256 tokenId);
    error RecipientNotAccepted(uint256 tokenId, address expected);
    error DirectTransferNotAllowed();

    event SeatMinted(uint256 indexed tokenId, address indexed to);
    event TransferAccepted(uint256 indexed tokenId, address indexed by);
    event TransferExecuted(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor(
        address _installmentToken,
        address _protocolToken,
        uint256 _installmentSize,
        uint256 _protocolTokenRewardPerInstallment,
        uint256 _numRounds,
        uint256 _startTime,
        uint256 _timePerRound,
        uint256 _numUsers
    )
        SavingCircle(
            _installmentToken,
            _protocolToken,
            _installmentSize,
            _protocolTokenRewardPerInstallment,
            _numRounds,
            _startTime,
            _timePerRound,
            _numUsers
        )
        ERC721("SavingCircleSeat", "SCST")
    {}

    function acceptTransfer(uint256 tokenId) external {
        ownerOf(tokenId); // reverts if token does not exist
        _acceptedRecipient[tokenId] = msg.sender;
        emit TransferAccepted(tokenId, msg.sender);
    }

    function executeTransfer(uint256 tokenId, address to) external {
        _requireAuthorized(msg.sender, tokenId);
        if (_acceptedRecipient[tokenId] != to) revert RecipientNotAccepted(tokenId, _acceptedRecipient[tokenId]);

        delete _acceptedRecipient[tokenId];
        address from = ownerOf(tokenId);
        _transfer(from, to, tokenId);
        emit TransferExecuted(tokenId, from, to);
    }

    function acceptedRecipient(uint256 tokenId) external view returns (address) {
        return _acceptedRecipient[tokenId];
    }

    function _requireAuthorized(address operator, uint256 tokenId) internal view {
        address owner = ownerOf(tokenId);
        if (!_isAuthorized(owner, operator, tokenId)) revert NotAuthorized(operator, tokenId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (auth != address(0)) revert DirectTransferNotAllowed();
        address from = super._update(to, tokenId, auth);
        _setSeatOwnership(tokenId, from, to);
        return from;
    }

    function register() public override {
        super.register();
        uint256 tokenId = _mintSeat(msg.sender);
        seatTokenId[msg.sender] = tokenId;
    }

    function _mintSeat(address to) internal returns (uint256 tokenId) {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit SeatMinted(tokenId, to);
    }
}
