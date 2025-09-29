import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";

/**
 * Deploy script for RUN DAO smart contracts
 * Deploys QuestFactory, EscrowVault, and MedalNFT contracts
 */
async function main() {
  console.log("🚀 Starting RUN DAO contract deployment...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  // DAO Treasury address (replace with actual address)
  const daoTreasury = deployer.address; // Temporary: using deployer as treasury
  const protocolFeeRecipient = deployer.address; // Temporary: using deployer as protocol fee recipient
  
  console.log("\n📋 Deployment Configuration:");
  console.log("- DAO Treasury:", daoTreasury);
  console.log("- Protocol Fee Recipient:", protocolFeeRecipient);
  
  try {
    // 1. Deploy EscrowVault first
    console.log("\n1️⃣ Deploying EscrowVault...");
    const EscrowVaultFactory: ContractFactory = await ethers.getContractFactory("EscrowVault");
    const escrowVault: Contract = await EscrowVaultFactory.deploy(protocolFeeRecipient);
    await escrowVault.waitForDeployment();
    const escrowVaultAddress = await escrowVault.getAddress();
    console.log("✅ EscrowVault deployed to:", escrowVaultAddress);
    
    // 2. Deploy QuestFactory
    console.log("\n2️⃣ Deploying QuestFactory...");
    const QuestFactoryFactory: ContractFactory = await ethers.getContractFactory("QuestFactory");
    const questFactory: Contract = await QuestFactoryFactory.deploy(daoTreasury);
    await questFactory.waitForDeployment();
    const questFactoryAddress = await questFactory.getAddress();
    console.log("✅ QuestFactory deployed to:", questFactoryAddress);
    
    // 3. Deploy MedalNFT
    console.log("\n3️⃣ Deploying MedalNFT...");
    const MedalNFTFactory: ContractFactory = await ethers.getContractFactory("MedalNFT");
    const medalNFT: Contract = await MedalNFTFactory.deploy();
    await medalNFT.waitForDeployment();
    const medalNFTAddress = await medalNFT.getAddress();
    console.log("✅ MedalNFT deployed to:", medalNFTAddress);
    
    // 4. Configure contract relationships
    console.log("\n4️⃣ Configuring contract relationships...");
    
    // Set EscrowVault in QuestFactory
    console.log("- Setting EscrowVault address in QuestFactory...");
    const setEscrowTx = await questFactory.setEscrowVault(escrowVaultAddress);
    await setEscrowTx.wait();
    console.log("✅ EscrowVault address set in QuestFactory");
    
    // Authorize QuestFactory in EscrowVault
    console.log("- Authorizing QuestFactory in EscrowVault...");
    const authorizeTx = await escrowVault.setAuthorizedContract(questFactoryAddress, true);
    await authorizeTx.wait();
    console.log("✅ QuestFactory authorized in EscrowVault");
    
    // Authorize QuestFactory in MedalNFT
    console.log("- Authorizing QuestFactory in MedalNFT...");
    const authorizeMedalTx = await medalNFT.setAuthorizedMinter(questFactoryAddress, true);
    await authorizeMedalTx.wait();
    console.log("✅ QuestFactory authorized in MedalNFT");
    
    // 5. Set up supported tokens (example with mock USDC)
    console.log("\n5️⃣ Setting up supported tokens...");
    
    // For testnet, we'll need to deploy a mock USDC token or use existing testnet tokens
    // For now, we'll enable ETH (address(0)) as a supported token
    const enableETHTx = await questFactory.setSupportedToken(ethers.ZeroAddress, true);
    await enableETHTx.wait();
    console.log("✅ ETH enabled as supported token");
    
    // 6. Display deployment summary
    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📄 Contract Addresses:");
    console.log("┌─────────────────┬──────────────────────────────────────────────┐");
    console.log("│ Contract        │ Address                                      │");
    console.log("├─────────────────┼──────────────────────────────────────────────┤");
    console.log(`│ EscrowVault     │ ${escrowVaultAddress} │`);
    console.log(`│ QuestFactory    │ ${questFactoryAddress} │`);
    console.log(`│ MedalNFT        │ ${medalNFTAddress} │`);
    console.log("└─────────────────┴──────────────────────────────────────────────┘");
    
    console.log("\n🔧 Next Steps:");
    console.log("1. Update wrangler.jsonc with contract addresses");
    console.log("2. Update frontend to interact with deployed contracts");
    console.log("3. Verify contracts on Polygon zkEVM explorer");
    console.log("4. Set up proper DAO treasury and protocol fee addresses");
    console.log("5. Deploy and configure supported stablecoin tokens");
    
    // 7. Save deployment info to file
    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        EscrowVault: escrowVaultAddress,
        QuestFactory: questFactoryAddress,
        MedalNFT: medalNFTAddress
      },
      configuration: {
        daoTreasury,
        protocolFeeRecipient,
        supportedTokens: ["ETH (address(0))"]
      }
    };
    
    console.log("\n💾 Deployment info:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Error handling
main()
  .then(() => {
    console.log("\n✅ Deployment script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
  });