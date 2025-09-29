// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HelloWorld
 * @dev Simple test contract for Hardhat setup verification
 */
contract HelloWorld {
    string public message;
    
    constructor(string memory _message) {
        message = _message;
    }
    
    function setMessage(string memory _message) external {
        message = _message;
    }
    
    function getMessage() external view returns (string memory) {
        return message;
    }
}