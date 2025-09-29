import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Test suite for QuestFactory contract
 */
describe("QuestFactory", function () {
  let questFactory: Contract;
  let escrowVault: Contract;
  let medalNFT: Contract;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let treasury: SignerWithAddress;
  
  // Quest parameters for testing
  const questParams = {
    title: "Test Quest",
    description: "A test running quest",
    startTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    endTime: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days from now
    distanceKm: 5000, // 5 km (in meters)
    timesPerWeek: 3,
    stakeAmount: ethers.parseEther("10"), // 10 ETH
    maxSlots: 10
  };
  
  beforeEach(async function () {
    // Get signers
    [owner, alice, bob, treasury] = await ethers.getSigners();
    
    // Deploy EscrowVault
    const EscrowVaultFactory: ContractFactory = await ethers.getContractFactory("EscrowVault");
    escrowVault = await EscrowVaultFactory.deploy(treasury.address);
    await escrowVault.waitForDeployment();
    
    // Deploy QuestFactory
    const QuestFactoryFactory: ContractFactory = await ethers.getContractFactory("QuestFactory");
    questFactory = await QuestFactoryFactory.deploy(treasury.address);
    await questFactory.waitForDeployment();
    
    // Deploy MedalNFT
    const MedalNFTFactory: ContractFactory = await ethers.getContractFactory("MedalNFT");
    medalNFT = await MedalNFTFactory.deploy();
    await medalNFT.waitForDeployment();
    
    // Configure relationships
    await questFactory.setEscrowVault(await escrowVault.getAddress());
    await escrowVault.setAuthorizedContract(await questFactory.getAddress(), true);
    await medalNFT.setAuthorizedMinter(await questFactory.getAddress(), true);
    
    // Enable ETH as supported token
    await questFactory.setSupportedToken(ethers.ZeroAddress, true);
  });
  
  describe("Quest Creation", function () {
    it("Should create a quest with valid parameters", async function () {
      const tx = await questFactory.createQuest(
        questParams.title,
        questParams.description,
        questParams.startTime,
        questParams.endTime,
        questParams.distanceKm,
        questParams.timesPerWeek,
        ethers.ZeroAddress, // ETH
        questParams.stakeAmount,
        questParams.maxSlots
      );
      
      await expect(tx)
        .to.emit(questFactory, "QuestCreated")
        .withArgs(1, owner.address, questParams.title, questParams.stakeAmount, ethers.ZeroAddress);
      
      const quest = await questFactory.getQuest(1);
      expect(quest.title).to.equal(questParams.title);
      expect(quest.creator).to.equal(owner.address);
      expect(quest.stakeAmount).to.equal(questParams.stakeAmount);
    });
    
    it("Should reject quest creation with invalid parameters", async function () {
      // Invalid start time (in the past)
      await expect(
        questFactory.createQuest(
          questParams.title,
          questParams.description,
          Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          questParams.endTime,
          questParams.distanceKm,
          questParams.timesPerWeek,
          ethers.ZeroAddress,
          questParams.stakeAmount,
          questParams.maxSlots
        )
      ).to.be.revertedWith("Start time must be in future");
      
      // Zero stake amount
      await expect(
        questFactory.createQuest(
          questParams.title,
          questParams.description,
          questParams.startTime,
          questParams.endTime,
          questParams.distanceKm,
          questParams.timesPerWeek,
          ethers.ZeroAddress,
          0,
          questParams.maxSlots
        )
      ).to.be.revertedWith("Stake amount must be positive");
    });
  });
  
  describe("Quest Participation", function () {
    let questId: number;
    
    beforeEach(async function () {
      // Create a quest first
      await questFactory.createQuest(
        questParams.title,
        questParams.description,
        questParams.startTime,
        questParams.endTime,
        questParams.distanceKm,
        questParams.timesPerWeek,
        ethers.ZeroAddress,
        questParams.stakeAmount,
        questParams.maxSlots
      );
      questId = 1;
    });
    
    it("Should allow user to join quest with proper stake", async function () {
      const tx = await questFactory.connect(alice).joinQuest(questId, {
        value: questParams.stakeAmount
      });
      
      await expect(tx)
        .to.emit(questFactory, "QuestJoined")
        .withArgs(questId, alice.address, questParams.stakeAmount);
      
      const participants = await questFactory.getQuestParticipants(questId);
      expect(participants).to.include(alice.address);
    });
    
    it("Should reject joining with insufficient stake", async function () {
      await expect(
        questFactory.connect(alice).joinQuest(questId, {
          value: ethers.parseEther("5") // Less than required
        })
      ).to.be.reverted;
    });
    
    it("Should reject double joining", async function () {
      // Join once
      await questFactory.connect(alice).joinQuest(questId, {
        value: questParams.stakeAmount
      });
      
      // Try to join again
      await expect(
        questFactory.connect(alice).joinQuest(questId, {
          value: questParams.stakeAmount
        })
      ).to.be.revertedWith("Already joined");
    });
  });
  
  describe("Quest Completion", function () {
    let questId: number;
    
    beforeEach(async function () {
      // Create quest
      await questFactory.createQuest(
        questParams.title,
        questParams.description,
        Math.floor(Date.now() / 1000) + 60, // 1 minute from now
        Math.floor(Date.now() / 1000) + 120, // 2 minutes from now
        questParams.distanceKm,
        questParams.timesPerWeek,
        ethers.ZeroAddress,
        questParams.stakeAmount,
        questParams.maxSlots
      );
      questId = 1;
      
      // Alice and Bob join
      await questFactory.connect(alice).joinQuest(questId, {
        value: questParams.stakeAmount
      });
      await questFactory.connect(bob).joinQuest(questId, {
        value: questParams.stakeAmount
      });
      
      // Wait for quest to end
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);
    });
    
    it("Should complete quest and distribute rewards", async function () {
      const winners = [alice.address];
      
      const tx = await questFactory.completeQuest(questId, winners);
      
      await expect(tx)
        .to.emit(questFactory, "QuestCompleted")
        .withArgs(questId, winners, [bob.address], questParams.stakeAmount * 2n);
      
      const quest = await questFactory.getQuest(questId);
      expect(quest.status).to.equal(3); // Completed status
    });
    
    it("Should reject completion before quest ends", async function () {
      // Create new quest that hasn't ended
      await questFactory.createQuest(
        "Future Quest",
        "A quest in the future",
        Math.floor(Date.now() / 1000) + 3600,
        Math.floor(Date.now() / 1000) + 7200,
        questParams.distanceKm,
        questParams.timesPerWeek,
        ethers.ZeroAddress,
        questParams.stakeAmount,
        questParams.maxSlots
      );
      
      await expect(
        questFactory.completeQuest(2, [alice.address])
      ).to.be.revertedWith("Quest not ended yet");
    });
  });
  
  describe("Quest Cancellation", function () {
    let questId: number;
    
    beforeEach(async function () {
      await questFactory.createQuest(
        questParams.title,
        questParams.description,
        questParams.startTime,
        questParams.endTime,
        questParams.distanceKm,
        questParams.timesPerWeek,
        ethers.ZeroAddress,
        questParams.stakeAmount,
        questParams.maxSlots
      );
      questId = 1;
    });
    
    it("Should allow creator to cancel quest before start", async function () {
      const tx = await questFactory.cancelQuest(questId);
      
      const quest = await questFactory.getQuest(questId);
      expect(quest.status).to.equal(4); // Cancelled status
    });
    
    it("Should reject cancellation by non-creator", async function () {
      await expect(
        questFactory.connect(alice).cancelQuest(questId)
      ).to.be.revertedWith("Not authorized");
    });
  });
});