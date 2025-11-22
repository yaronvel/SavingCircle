// contracts/GameItem.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

interface ISavingCircle {
    function updateAddressOwner(uint256 tokenId, address from, address to) external;
}

contract SavingCircleSeat is ERC721URIStorage {
    uint256 private _nextTokenId;
    mapping(uint256 => address) private _pendingRecipient;
    ISavingCircle private immutable _savingCircle;

    error NotAuthorized(address operator, uint256 tokenId);

    event SeatMinted(uint256 indexed tokenId, address indexed to);
    event TransferInitiated(uint256 indexed tokenId, address indexed from, address indexed to);
    event TransferAccepted(uint256 indexed tokenId, address indexed from, address indexed to);
    event TransferCancelled(uint256 indexed tokenId, address indexed by);

    error TransferAlreadyPending(uint256 tokenId, address currentPending);
    error TransferNotPending(uint256 tokenId);
    error NotPendingRecipient(uint256 tokenId, address expected);
    error DirectTransferNotAllowed();
    error Unauthorized();
    error InvalidSavingCircle();

    modifier onlySavingCircle() {
        if (msg.sender != address(_savingCircle)) revert Unauthorized();
        _;
    }

    constructor(address savingCircle_) ERC721("SavingCircleSeat", "SCST") {
        if (savingCircle_ == address(0)) revert InvalidSavingCircle();
        _savingCircle = ISavingCircle(savingCircle_);
    }

    function mintSeat(address to) external onlySavingCircle returns (uint256 tokenId) {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit SeatMinted(tokenId, to);
    }

    function initiateTransfer(uint256 tokenId, address to) external {
        _requireAuthorized(msg.sender, tokenId);
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));

        address currentPending = _pendingRecipient[tokenId];
        if (currentPending != address(0)) revert TransferAlreadyPending(tokenId, currentPending);

        _pendingRecipient[tokenId] = to;
        emit TransferInitiated(tokenId, ownerOf(tokenId), to);
    }

    function cancelTransfer(uint256 tokenId) external {
        _requireAuthorized(msg.sender, tokenId);
        if (_pendingRecipient[tokenId] == address(0)) revert TransferNotPending(tokenId);

        delete _pendingRecipient[tokenId];
        emit TransferCancelled(tokenId, msg.sender);
    }

    function acceptTransfer(uint256 tokenId) external {
        address pending = _pendingRecipient[tokenId];
        if (pending == address(0)) revert TransferNotPending(tokenId);
        if (pending != msg.sender) revert NotPendingRecipient(tokenId, pending);

        address from = ownerOf(tokenId);
        delete _pendingRecipient[tokenId];
        _transfer(from, msg.sender, tokenId);
        emit TransferAccepted(tokenId, from, msg.sender);
    }

    function pendingRecipient(uint256 tokenId) external view returns (address) {
        return _pendingRecipient[tokenId];
    }

    function _requireAuthorized(address operator, uint256 tokenId) internal view {
        address owner = ownerOf(tokenId);
        if (!_isAuthorized(owner, operator, tokenId)) revert NotAuthorized(operator, tokenId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (auth != address(0)) revert DirectTransferNotAllowed();
        address from = super._update(to, tokenId, auth);
        _savingCircle.updateAddressOwner(tokenId, from, to);
        return from;
    }
}
