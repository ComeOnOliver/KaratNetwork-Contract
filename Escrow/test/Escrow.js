const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Escrow", function () {
  let Escrow, escrow, TestToken, testToken, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners(); // Move this line up to initialize owner first

    TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(10000);
    await testToken.deployed();


    Escrow = await ethers.getContractFactory("Escrow");
    escrow = await upgrades.deployProxy(Escrow, [], { initializer: "initialize" });
    await escrow.deployed();
  });

  describe("Test Deployment", function () {

    it("Should deploy the upgradable contract correctly", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.isAuthorizedToken(ethers.constants.AddressZero)).to.equal(true);
    });
    
    it("Should deploy the Escrow contract", async function () {
      expect(escrow.address).to.exist;
    });
    
    it("Should revert if depositing an unauthorized token", async function () {
      await expect(escrow.connect(addr1).depositERC20(testToken.address, ethers.utils.parseUnits("10", 18))).to.be.revertedWith("Invalid token");
    });

    it("Should revert when trying to remove an authorized token with an out of bounds index", async function () {
      await expect(escrow.isAuthorizedToken(testToken.address)).to.be.revertedWith("");
    });

    it("Should Users deploy and initialize Escrow contract correctly", async function () {
        // Check that the owner is set
        const contractOwner = await escrow.owner();
        expect(contractOwner).to.equal(owner.address);
    
        // Check that the native token (ETH) is authorized
        const nativeTokenAuthorized = await escrow.isAuthorizedToken(ethers.constants.AddressZero);
        expect(nativeTokenAuthorized).to.equal(true);
      });
  });

  describe("Test Authorized Token Functions", function () {
    
    it("Should revert when a non-owner tries to add an authorized token", async function () {
      await expect(escrow.connect(addr1).setToken(testToken.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should revert when a non-owner tries to remove an authorized token", async function () {
      await expect(escrow.connect(addr1).setToken(testToken.address, false)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should add an authorized token", async function () {
      await escrow.setToken(testToken.address, true);
      expect(await escrow.isAuthorizedToken(testToken.address)).to.equal(true);
    });
    it("Should remove an authorized token", async function () {
      await escrow.setToken(testToken.address, true);
      expect(await escrow.isAuthorizedToken(testToken.address)).to.equal(true);
  
      await escrow.setToken(testToken.address, false);
      expect(await escrow.isAuthorizedToken(testToken.address)).to.equal(false);
    });
    it("Should revert when trying to deposit a validator ERC20 token that is not authorized", async function () {
      const TestToken2 = await ethers.getContractFactory("TestToken");
      const token2 = await TestToken2.deploy(ethers.utils.parseEther("1000"));
      await token2.deployed();
      await token2.transfer(addr1.address, ethers.utils.parseEther("100"));
  
      await expect(escrow.connect(addr1).depositValidatorERC20(token2.address, ethers.utils.parseEther("10"))).to.be.revertedWith("Invalid token");
    });

    it("Should return true if token is authorized", async function () {
      await escrow.setToken(testToken.address, true);
      const isTokenAuthorized = await escrow.isAuthorizedToken(testToken.address);
      expect(isTokenAuthorized).to.equal(true);
    });
    it("Should return false if token is not authorized", async function () {
      const randomToken = await ethers.getContractFactory("TestToken");
      const unAuthorizedToken = await randomToken.deploy(ethers.utils.parseEther("1000"));
      await unAuthorizedToken.deployed();
  
      const isTokenAuthorized = await escrow.isAuthorizedToken(unAuthorizedToken.address);
      expect(isTokenAuthorized).to.equal(false);
    });

    it("Should revert depositERC20 with an unauthorized token", async function () {
      const randomToken = await ethers.getContractFactory("TestToken");
      const unAuthorizedToken = await randomToken.deploy(ethers.utils.parseEther("1000"));
      await unAuthorizedToken.deployed();

      await unAuthorizedToken.transfer(addr1.address, ethers.utils.parseEther("100"));
      await unAuthorizedToken.connect(addr1).approve(escrow.address, ethers.utils.parseEther("10"));

      await expect(escrow.connect(addr1).depositERC20(unAuthorizedToken.address, ethers.utils.parseEther("10"))).to.be.revertedWith("Invalid token");
    });
    it("Should revert depositValidatorERC20 with an unauthorized token", async function () {
      const randomToken = await ethers.getContractFactory("TestToken");
      const unAuthorizedToken = await randomToken.deploy(ethers.utils.parseEther("1000"));
      await unAuthorizedToken.deployed();

      await unAuthorizedToken.transfer(addr1.address, ethers.utils.parseEther("100"));
      await unAuthorizedToken.connect(addr1).approve(escrow.address, ethers.utils.parseEther("10"));

      await expect(escrow.connect(addr1).depositValidatorERC20(unAuthorizedToken.address, ethers.utils.parseEther("10"))).to.be.revertedWith("Invalid token");
    });
    it("Should revert withdraw with an unauthorized token", async function () {
      const randomToken = await ethers.getContractFactory("TestToken");
      const unAuthorizedToken = await randomToken.deploy(ethers.utils.parseEther("1000"));
      await unAuthorizedToken.deployed();

      await expect(escrow.connect(owner).withdraw(unAuthorizedToken.address, ethers.utils.parseEther("10"))).to.be.revertedWith("Invalid token");
    });

  });

  describe("Test Functions of Deposit and withdraw", function () {
    it("Should revert when trying to deposit an unauthorized token", async function () {
      await testToken.transfer(addr1.address, ethers.utils.parseEther("100"));
      await testToken.connect(addr1).approve(escrow.address, ethers.utils.parseEther("100"));
  
      await expect(
        escrow.connect(addr1).depositERC20(testToken.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Invalid token");
    });

    it("Should non-owner deposit ERC20 tokens correctly", async function () {
      await escrow.setToken(testToken.address, true);
      await testToken.connect(owner).transfer(addr1.address, ethers.utils.parseEther("100"));
      await testToken.connect(addr1).approve(escrow.address, ethers.utils.parseEther("100"));
      await escrow.connect(addr1).depositERC20(testToken.address, ethers.utils.parseEther("10"));
  
      expect(await escrow.claimerBalance(addr1.address, testToken.address)).to.equal(ethers.utils.parseEther("10"));
    });

    it("Should non-owner deposit native tokens correctly", async function () {
      await escrow.connect(addr1).depositNativeToken({value: ethers.utils.parseEther("1")});
  
      expect(await escrow.claimerNativeBalance(addr1.address)).to.equal(ethers.utils.parseEther("1"));
    });

    it("Should Owner deposit and withdraw test tokens", async function () {
    const totalAmount = ethers.utils.parseUnits("10000", 18);

    const depositAmount = ethers.utils.parseUnits("5000", 18);

    await escrow.setToken(testToken.address, true);
    await testToken.connect(owner).approve(escrow.address, totalAmount);
    await escrow.connect(owner).depositERC20(testToken.address, depositAmount);
    await escrow.connect(owner).depositERC20(testToken.address, depositAmount);

    const userBalance = await escrow.claimerBalance(owner.address, testToken.address);
    expect(userBalance).to.equal(totalAmount);

    await escrow.withdraw(testToken.address, depositAmount);
    const ownerBalance = await testToken.balanceOf(owner.address);
    expect(ownerBalance).to.equal(depositAmount);
  });

  it("Should Owner deposit Native Token and withdraw tokens", async function () {
    const totalAmount = ethers.utils.parseUnits("10000", 18);
    const depositAmount = ethers.utils.parseUnits("5000", 18);

    await escrow.setToken(testToken.address, true);
    await testToken.connect(owner).approve(escrow.address, totalAmount);
    
    await escrow.connect(owner).depositNativeToken({ value: depositAmount });

    const userBalance = await escrow.claimerNativeBalance(owner.address);
    expect(userBalance).to.equal(depositAmount);

    await escrow.withdraw(ethers.constants.AddressZero, depositAmount);
    const ownerBalance = await testToken.balanceOf(owner.address);
    expect(ownerBalance).to.be.closeTo(totalAmount, 500000);
  });

  it("Should deposit validator ERC20 tokens correctly", async function () {
    await escrow.setToken(testToken.address, true);
  
    await testToken.transfer(addr1.address, ethers.utils.parseEther("100"));
    await testToken.connect(addr1).approve(escrow.address, ethers.utils.parseEther("10"));
    await escrow.connect(addr1).depositValidatorERC20(testToken.address, ethers.utils.parseEther("10"));

    expect(await escrow.validatorBalance(addr1.address, testToken.address)).to.equal(ethers.utils.parseEther("10"));
  });

  it("Should deposit validator native tokens correctly", async function () {
    await escrow.connect(addr1).depositValidatorNativeToken({value: ethers.utils.parseEther("1")});

    expect(await escrow.validatorNativeBalance(addr1.address)).to.equal(ethers.utils.parseEther("1"));
  });

  it("Should revert when trying to deposit ERC20 tokens without allowance", async function () {
    await escrow.setToken(testToken.address, true);
    await testToken.transfer(addr1.address, ethers.utils.parseEther("100"));

    await expect(escrow.connect(addr1).depositERC20(testToken.address, ethers.utils.parseEther("10"))).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("Should revert when trying to deposit validator ERC20 tokens without allowance", async function () {
    await escrow.setToken(testToken.address, true);
    await testToken.transfer(addr1.address, ethers.utils.parseEther("100"));

    await expect(escrow.connect(addr1).depositValidatorERC20(testToken.address, ethers.utils.parseEther("10"))).to.be.revertedWith("ERC20: insufficient allowance");
  });

  });

  describe("Test Functions of Withdraw", function () {
    beforeEach(async function () {
      // Add token to the authorized token list
      await escrow.connect(owner).setToken(testToken.address, true);
      await testToken.connect(owner).approve(escrow.address, ethers.utils.parseEther("1000"));
      await escrow.connect(owner).depositERC20(testToken.address, ethers.utils.parseEther("1000"));
      await testToken.connect(owner).mint(addr1.address, ethers.utils.parseEther("100"));
    });

    it("Should revert when trying to withdraw an unauthorized token", async function () {
      const TestToken2 = await ethers.getContractFactory("TestToken");
      const token2 = await TestToken2.deploy(ethers.utils.parseEther("1000"));
      await token2.deployed();
  
      await expect(escrow.withdraw(token2.address, ethers.utils.parseEther("10"))).to.be.revertedWith("Invalid token");
    });
    it("Should allow owner to withdraw ERC20 tokens", async function () {
      // Deposit ERC20 tokens before withdrawing
      await testToken.connect(addr1).approve(escrow.address, ethers.utils.parseEther("1"));
      await escrow.connect(addr1).depositERC20(testToken.address, ethers.utils.parseEther("1"));


      const initialOwnerBalance = await testToken.balanceOf(owner.address);
      await escrow.connect(owner).withdraw(testToken.address, ethers.utils.parseEther("1"));

      const finalOwnerBalance = await testToken.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(ethers.utils.parseEther("1")));
    });
    
    it("Should allow owner to withdraw native tokens", async function () {
      // Deposit native tokens before withdrawing
      await escrow.connect(addr1).depositNativeToken({value: ethers.utils.parseEther("1")});

      const initialOwnerBalance = await owner.getBalance();
      await escrow.connect(owner).withdraw(ethers.constants.AddressZero, ethers.utils.parseEther("1"));

      const finalOwnerBalance = await owner.getBalance();
      expect(finalOwnerBalance).to.gt(initialOwnerBalance);
    });

    it("Should revert if non-owner tries to withdraw ERC20 tokens", async function () {
      await expect(escrow.connect(addr1).withdraw(testToken.address, ethers.utils.parseEther("1"))).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if non-owner tries to withdraw native tokens", async function () {
      await expect(escrow.connect(addr1).withdraw(ethers.constants.AddressZero, ethers.utils.parseEther("1"))).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if owner tries to withdraw an unauthorized token", async function () {
      const unauthorizedToken = await TestToken.connect(owner).deploy("100");
      await expect(escrow.connect(owner).withdraw(unauthorizedToken.address, ethers.utils.parseEther("1"))).to.be.revertedWith("Invalid token");
    });

  });

  describe("Upgrade", function () {
    it("Should upgrade the contract and maintain state", async function () {
      const EscrowV2 = await ethers.getContractFactory("EscrowV2");
      const escrowV2 = await upgrades.upgradeProxy(escrow.address, EscrowV2);

      // Check if the state was maintained after upgrade
      const isUpgraded = await escrowV2.testv2();
      expect(isUpgraded).to.equal(true);
    });
  });

});
