// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/console.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SavingCircleNft} from "../src/SavingCircleNft.sol";

contract MyToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        _mint(msg.sender, 1e18 * 1e18);
    }    
}

contract SavingCircleTest is Test {
    SavingCircleNft sc;
    MyToken usdc;
    MyToken scToken;

    address user1 = address(0x111);
    address user2 = address(0x222);
    address user3 = address(0x333);

    address owner2 = address(0x444);
    address nonOwner = address(0x555);

    function setUp() public {
        usdc = new MyToken("USDC", "USDC");
        scToken = new MyToken("SC", "SC");

        sc = new SavingCircleNft(
            address(usdc),
            address(scToken),
            100,
            10,
            3,
            block.timestamp + 10,
            666,
            3,
            address(this),
            1e6);

        sc.setRaffleOwner(address(this));


        address[5] memory users;
        users[0] = user1; users[1] = user2; users[2] = user3; users[3] = owner2; users[4] = nonOwner;

        for(uint i = 0 ; i < 5 ; i++) {
            usdc.transfer(users[i], 1e24);
            scToken.transfer(users[i], 1e24);

            vm.startPrank(users[i]);
            usdc.approve(address(sc), 1e24);
            scToken.approve(address(sc), 1e24);            
            vm.stopPrank();

        }

        scToken.transfer(address(sc), 1e18);
    }

    function register() internal {
        vm.startPrank(user1);
        sc.register();
        vm.stopPrank();

        vm.startPrank(user2);
        sc.register();
        vm.stopPrank();

        vm.startPrank(user3);
        sc.register();
        vm.stopPrank();
    }

    function testRegister() public {
        register();

        assertEq(sc.registeredUsers(0), user1, "unexpected user1");
        assertEq(sc.usersWhoDidNotWin(0), user1, "unexpected user1");

        assertEq(sc.registeredUsers(1), user2, "unexpected user2");
        assertEq(sc.usersWhoDidNotWin(1), user2, "unexpected user2");

        assertEq(sc.registeredUsers(2), user3, "unexpected user3");
        assertEq(sc.usersWhoDidNotWin(2), user3, "unexpected user3");                
    }

    function testNft() public {
        register();

        uint tokenId = uint256(uint160(address(user1)));

        vm.startPrank(owner2);
        sc.acceptTransfer(tokenId);
        vm.stopPrank();

        vm.startPrank(user1);
        sc.safeTransferFrom(user1, owner2, tokenId);
        vm.stopPrank();

        assertEq(sc.ownerOf(tokenId), owner2);
    }

    function testSimpleDeposit() public {
        register();

        // do deposits
        vm.startPrank(user1);
        sc.depositRound(0, 5, user1);
        vm.stopPrank();

        vm.startPrank(user2);
        sc.depositRound(0, 10, user2);
        vm.stopPrank();

        vm.startPrank(user3);
        sc.depositRound(0, 15, user3);
        vm.stopPrank();


        assertEq(sc.roundAuctionSize(0, user1), 5, "unexpected auction size");
        assertEq(sc.roundAuctionSize(0, user2), 10, "unexpected auction size");
        assertEq(sc.roundAuctionSize(0, user3), 15, "unexpected auction size");


        assertEq(scToken.balanceOf(user1), 1e24 - 5 + 10, "unexpected sc token balance");
        assertEq(scToken.balanceOf(user2), 1e24 - 10 + 10, "unexpected sc token balance");
        assertEq(scToken.balanceOf(user3), 1e24 - 15 + 10, "unexpected sc token balance");        

        uint round0EndTime = sc.startTime() + sc.timePerRound();
        vm.warp(round0EndTime + 1);

        // user 2 is expected to win
        sc.raffle(0, 8);

        assertEq(usdc.balanceOf(user2), 1e24 - 100 + 300, "unexpected usdc balance for winner");

        assertEq(sc.usersWhoDidNotWin(0), user1, "unexpected user1");
        assertEq(sc.usersWhoDidNotWin(1), user3, "unexpected user1");



        // do deposits
        vm.startPrank(user1);
        sc.depositRound(1, 15, user1);
        vm.stopPrank();

        vm.startPrank(user2);
        sc.depositRound(1, 1, user2);
        vm.stopPrank();

        vm.startPrank(user3);
        sc.depositRound(1, 5, user3);
        vm.stopPrank();

        assertEq(sc.roundAuctionSize(1, user1), 15, "unexpected auction1 size");
        assertEq(sc.roundAuctionSize(1, user2), 1, "unexpected auction1 size");
        assertEq(sc.roundAuctionSize(1, user3), 5, "unexpected auction1 size");

        uint round1EndTime = sc.startTime() + 2 * sc.timePerRound();
        vm.warp(round1EndTime + 1);

        // user 1 is expected to win
        sc.raffle(1, 8);

        assertEq(usdc.balanceOf(user1), 1e24 - 200 + 300, "unexpected usdc balance for winner of round 1");

        assertEq(sc.usersWhoDidNotWin(0), user3, "unexpected user1");

        // do deposits
        vm.startPrank(user1);
        sc.depositRound(2, 1, user1);
        vm.stopPrank();

        vm.startPrank(user2);
        sc.depositRound(2, 1, user2);
        vm.stopPrank();

        vm.startPrank(user3);
        sc.depositRound(2, 1, user3);
        vm.stopPrank();

        uint round2EndTime = sc.startTime() + 3 * sc.timePerRound();
        vm.warp(round2EndTime + 1);

        // user 1 is expected to win
        sc.raffle(2, 88);

        assertEq(usdc.balanceOf(user3), 1e24 - 300 + 300, "unexpected usdc balance for winner of round 1");        
    }    

}
