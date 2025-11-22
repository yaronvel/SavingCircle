// contracts/GameItem.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {SavingCircle} from "./SavingCircle.sol";

contract SavingCircleNft is SavingCircle, ERC721URIStorage {
    uint256 private _nextTokenId;
    mapping(uint256 => address) private _acceptedRecipient;
    mapping(address => uint256) public seatTokenId;
    mapping(uint256 => address) public originalUserOfToken;

    error RecipientNotAccepted(uint256 tokenId, address expected);
    error UnknownSeat(uint256 tokenId);

    event SeatMinted(uint256 indexed tokenId, address indexed to);
    event TransferAccepted(uint256 indexed tokenId, address indexed by);

    // Deploys the saving circle and wires in ERC721 metadata for the seat token.
    constructor(
        address _installmentToken,
        address _protocolToken,
        uint256 _installmentSize,
        uint256 _protocolTokenRewardPerInstallment,
        uint256 _numRounds,
        uint256 _startTime,
        uint256 _timePerRound,
        uint256 _numUsers,
        address _admin
    )
        SavingCircle(
            _installmentToken,
            _protocolToken,
            _installmentSize,
            _protocolTokenRewardPerInstallment,
            _numRounds,
            _startTime,
            _timePerRound,
            _numUsers,
            _admin
        )
        ERC721("SavingCircleSeat", "SCST")
    {}

    // Extends base registration by minting a seat NFT bound to the new user.
    function register() public override {
        super.register();
        uint256 tokenId = _mintSeat(msg.sender);
        seatTokenId[msg.sender] = tokenId;
        originalUserOfToken[tokenId] = msg.sender;
    }

    // Internal helper that mints a new seat token and emits the mint event.
    function _mintSeat(address to) internal returns (uint256 tokenId) {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        tokenId = uint256(uint160(address(to)));
        _safeMint(to, tokenId);
        emit SeatMinted(tokenId, to);
    }

    // Lets a prospective recipient opt in so a transfer can later be executed.
    function acceptTransfer(uint256 tokenId) external {
        ownerOf(tokenId); // reverts if token does not exist
        _acceptedRecipient[tokenId] = msg.sender;
        emit TransferAccepted(tokenId, msg.sender);
    }

    // Intercepts every ERC721 state change to enforce acceptance for user-initiated transfers.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (auth != address(0)) {
            _requireAcceptedRecipient(tokenId, to);
            delete _acceptedRecipient[tokenId];
        }

        address from = super._update(to, tokenId, auth);
        _syncSeatOwnership(tokenId, from, to);
        return from;
    }

    // Maintains the original-to-current owner mapping used by the SavingCircle logic.
    function _syncSeatOwnership(uint256 tokenId, address from, address to) internal {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));

        address original = originalUserOfToken[tokenId];
        if (original == address(0)) {
            if (from != address(0)) revert UnknownSeat(tokenId);
            originalUserOfToken[tokenId] = to;
            original = to;
        }

        addressOwner[original] = to;
    }

    function _requireAcceptedRecipient(uint256 tokenId, address to) internal view {
        if (_acceptedRecipient[tokenId] != to) revert RecipientNotAccepted(tokenId, _acceptedRecipient[tokenId]);
    }
}
