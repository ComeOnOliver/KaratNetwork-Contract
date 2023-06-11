import {ethers, upgrades} from "hardhat";
import {expect} from "chai";
import {MerkleTree} from "merkletreejs";
import {keccak256, solidityKeccak256} from "ethers/lib/utils";
import {Signer} from "ethers";


describe("ValidatorNFT", function () {
    let validatorNFT: any;
    let owner: Signer;
    let minter: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let addr3: Signer;
    let merkleRoot: string;
    let users: any;
    let merkleTree: any;

    function generateMerkleTree(usersss, levels, mintPrices) {
        const elements = [];
        usersss.forEach(user => {
            levels.forEach(level => {
                mintPrices.forEach(mintprice => {
                    const hash = ethers.utils.solidityKeccak256([
                        "address", "uint256", "uint256"
                    ], [user, level, mintprice]);
                    elements.push(hash);
                });
            });
        });

        const merkleTree = new MerkleTree(elements, keccak256, {sort: true});

        return merkleTree;
    }

    beforeEach(async function () {
        const ValidatorNFT = await ethers.getContractFactory("ValidatorNFT");
        [
            owner,
            minter,
            addr1,
            addr2,
            addr3
        ] = await ethers.getSigners();
        users = ["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", "0x4c79B28335723E158b8F02b7E3191Aa570B2ED91", owner.address];

        merkleTree = generateMerkleTree(users, [
            2, 2, 1, 1
        ], [ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15"), ethers.utils.parseEther("1"), ethers.utils.parseEther("1")]);
        merkleRoot = merkleTree.getHexRoot();

        validatorNFT = await upgrades.deployProxy(ValidatorNFT, [
            "ValidatorNFT",
            "VNFT",
            "https://karatdao.com/validator/",
            merkleRoot,
            30,
            300
        ], {initializer: "initialize"});
    });

    describe("Deployment", function () {


        it("Should set the deployer as the contract owner", async function () {
            console.log("MerkleTREE Root: ", merkleRoot);
            expect(await validatorNFT.owner()).to.equal(owner.address);
        });
        it("Should set the initial stage to Close", async function () {
            expect(await validatorNFT.currentStage()).to.equal(0);
        });
        it("Should set the price[1] to 1 eth", async function () {
            expect(await validatorNFT.price(1)).to.equal(ethers.utils.parseEther("1"));
        });
        it("Should set the price[2] to 0.2 eth", async function () {
            expect(await validatorNFT.price(2)).to.equal(ethers.utils.parseEther("0.2"));
        });
        it("Should set the merkle root", async function () {
            expect(await validatorNFT.whitelistMerkleRoot()).to.equal(merkleRoot);
        });
        it("Should deploy the contract with valid parameters and verify successful deployment", async function () {
            expect(validatorNFT.address).to.be.properAddress;
        });
        it("Should initialize function with valid parameters and verify the initial state of the contract", async function () {
            expect(await validatorNFT.baseURI()).to.be.equal("https://karatdao.com/validator/");

        });

    });
    describe("Access Control", function () {
        it("Should only allow the contract owner to call createNewBatch()", async function () {
            await expect(validatorNFT.connect(addr1).createNewBatch(1, 10)).to.be.reverted;
        });

        it("Should only allow the contract owner to call setBaseURI()", async function () {
            await expect(validatorNFT.connect(addr1).updateBaseURI("https://newbaseuri.com/validator/")).to.be.reverted;
        });

        it("Should only allow the contract owner to call setPrice()", async function () {
            await expect(validatorNFT.connect(addr1).setPrice(1, ethers.utils.parseEther("0.5"))).to.be.reverted;
        });

        it("Should only allow the contract owner to call startPreSale()", async function () {
            await expect(validatorNFT.connect(addr1).startPreSale()).to.be.reverted;
        });

        it("Should only allow the contract owner to call startPublicSale()", async function () {
            await expect(validatorNFT.connect(addr1).startPublicSale()).to.be.reverted;
        });

        it("Should only allow the contract owner to call endSale()", async function () {
            await expect(validatorNFT.connect(addr1).endSale()).to.be.reverted;
        });

        it("Should only allow the contract owner to call setWhitelistMerkleRoot()", async function () {
            await expect(validatorNFT.connect(addr1).updateWhitelistMerkleRoot(merkleRoot)).to.be.reverted;
        });

        it("Should only allow the contract owner to call withdraw()", async function () {
            await expect(validatorNFT.connect(addr1).withdraw(ethers.utils.parseEther("1"))).to.be.reverted;
        });

        it("Should only allow the contract owner to call reserveValidator()", async function () {
            await expect(validatorNFT.connect(addr1).reserveValidator(users[0], 5, 1)).to.be.reverted;
        });

        it("Should only allow the contract owner to call setAuthorizedCaller()", async function () {
            await expect(validatorNFT.connect(addr1).setAuthorizedCaller(users[0], true)).to.be.reverted;
        });
        it("Should update baseURI", async function () {
            const newBaseURI = "https://example.com/validator/";
            await validatorNFT.connect(owner).updateBaseURI(newBaseURI);
            expect(await validatorNFT.baseURI()).to.equal(newBaseURI);
        });

        it("Should update price", async function () {
            const newPrice1 = 50;
            const newPrice2 = 500;
            await validatorNFT.connect(owner).setPrice(newPrice1, newPrice2);
            expect(await validatorNFT.price(1)).to.equal(newPrice1);
            expect(await validatorNFT.price(2)).to.equal(newPrice2);
        });
        it("Should update currentStage", async function () {
            await validatorNFT.connect(owner).startPreSale();
            expect(await validatorNFT.currentStage()).to.equal(1);
            await validatorNFT.connect(owner).startPublicSale();
            expect(await validatorNFT.currentStage()).to.equal(2);
            await validatorNFT.connect(owner).endSale();
            expect(await validatorNFT.currentStage()).to.equal(0);
        });

        it("Should update whitelistMerkleRoot", async function () {
            const newMerkleRoot = "0x0000000000000000000000000000000000000000000000000000000000000001";
            await validatorNFT.connect(owner).updateWhitelistMerkleRoot(newMerkleRoot);
            expect(await validatorNFT.whitelistMerkleRoot()).to.equal(newMerkleRoot);
        });

        it("Should create new batch and update validatorCounter", async function () {

            await validatorNFT.connect(owner).createNewBatch(1, 10);
            expect(await validatorNFT.mintBatch(1)).to.equal(1);
            await validatorNFT.connect(owner).createNewBatch(2, 5);
            expect(await validatorNFT.mintBatch(2)).to.equal(5);
        });
    });

    describe("Withdraw", function () {
        let ownerInitialBalance: any;
        let contractInitialBalance: any;
        let withdrawAmount: any;

        beforeEach(async function () {
            withdrawAmount = ethers.utils.parseEther("1");
            ownerInitialBalance = await ethers.provider.getBalance(await owner.getAddress());
            contractInitialBalance = await ethers.provider.getBalance(validatorNFT.address);

        });

        it("Should fail to call withdraw with a zero balance", async function () {
            await expect(validatorNFT.connect(owner).withdraw(0)).to.be.revertedWith("No Fund");
        });

        it("Should fail to call withdraw with an unauthorized account", async function () {
            await expect(validatorNFT.connect(addr1).withdraw(withdrawAmount)).to.be.reverted;
        });

        it("Should fail to call withdraw with an amount greater than the contract balance", async function () {
            const excessiveAmount = contractInitialBalance.add(ethers.utils.parseEther("1"));
            await expect(validatorNFT.connect(owner).withdraw(excessiveAmount)).to.be.revertedWith("No Fund");
        });

        it("Should successfully withdraw the specified amount", async function () {
            await validatorNFT.connect(owner).startPublicSale();
            await validatorNFT.connect(owner).mintValidatorPublic(owner.getAddress(), 1, {value: withdrawAmount});

            await validatorNFT.connect(owner).withdraw(withdrawAmount);
            const ownerFinalBalance = await ethers.provider.getBalance(await owner.getAddress());
            const contractFinalBalance = await ethers.provider.getBalance(validatorNFT.address);

            expect(ownerFinalBalance).to.be.within(ownerInitialBalance.add(withdrawAmount).sub(ethers.utils.parseEther("2.0")), ownerInitialBalance.add(withdrawAmount).add(ethers.utils.parseEther("2.0")));
            expect(contractFinalBalance).to.be.within(contractInitialBalance.sub(withdrawAmount).sub(ethers.utils.parseEther("2.0")), contractInitialBalance.sub(withdrawAmount).add(ethers.utils.parseEther("2.0")));

        });
        it("Should successfully withdraw the maximum possible amount (contract balance)", async function () {

            await validatorNFT.connect(owner).startPublicSale();
            await validatorNFT.connect(owner).mintValidatorPublic(owner.getAddress(), 1, {value: withdrawAmount});
            contractInitialBalance = await ethers.provider.getBalance(validatorNFT.address);

            await validatorNFT.connect(owner).withdraw(contractInitialBalance);
            const ownerFinalBalance = await ethers.provider.getBalance(await owner.getAddress());
            const contractFinalBalance = await ethers.provider.getBalance(validatorNFT.address);

            expect(ownerFinalBalance).to.be.closeTo(ownerInitialBalance.add(contractInitialBalance), ethers.utils.parseEther("2.0"));
            expect(contractFinalBalance).to.equal(0);
        });

    });

    describe("mintValidatorPrivate", function () {
        it("Should check for the correct stage (PreSale)", async function () { // Set stage to PreSale
            await validatorNFT.connect(owner).startPreSale();

            // Test if the function can be called during the PreSale stage
            await expect(validatorNFT.connect(owner).mintValidatorPrivate(1, 1, ethers.utils.parseEther("0.15"), [])).to.be.reverted;
        });
        it("Should revert with invalid stage (Closed or PubSale)", async function () { // Test if the function reverts during the Closed stage
            await expect(validatorNFT.connect(owner).mintValidatorPrivate(1, 1, ethers.utils.parseEther("0.15"), [])).to.be.reverted;

            // Set stage to PubSale
            await validatorNFT.connect(owner).startPublicSale();

            // Test if the function reverts during the PubSale stage
            await expect(validatorNFT.connect(owner).mintValidatorPrivate(1, 1, ethers.utils.parseEther("0.15"), [])).to.be.reverted;
        });

        it("Should check for valid tier input (1 or 2)", async function () { // Test if the function can be called with valid tier inputs
            await expect(validatorNFT.mintValidatorPrivate(1, 0, ethers.utils.parseEther("0.15"), [])).to.be.reverted;
            await expect(validatorNFT.mintValidatorPrivate(1, -80, ethers.utils.parseEther("0.15"), [])).to.be.reverted;
            await expect(validatorNFT.mintValidatorPrivate(1, 22, ethers.utils.parseEther("0.15"), [])).to.be.reverted;
        });
        it("Should validate the whitelist status using isWhiteList function", async function () { // Set stage to PreSale
            await validatorNFT.connect(owner).startPreSale();

            // Get a valid proof for the whitelist
            const proof = merkleTree.getHexProof(ethers.utils.solidityKeccak256([
                "address", "uint256", "uint256"
            ], [users[0], 2, ethers.utils.parseEther("0.15")]));

            // Test if the function can be called with valid proof
            await validatorNFT.connect(owner).mintValidatorPrivate(users[0], 2, ethers.utils.parseEther("0.15"), proof, {value: ethers.utils.parseEther("0.15")});

        });
        it("Should revert with invalid proof", async function () {
            await validatorNFT.connect(owner).startPreSale();
            await expect(validatorNFT.connect(owner).mintValidatorPrivate(users[0], 1, ethers.utils.parseEther("0.15"), "0x0000000000000000000000000000000000", {value: ethers.utils.parseEther("0.15")})).to.be.reverted;
        });

        it("Should revert with incorrect mint price", async function () {
            await validatorNFT.connect(owner).startPreSale();

            const proof = merkleTree.getHexProof(ethers.utils.solidityKeccak256(["address"], [users[0]]));
            await expect(validatorNFT.connect(addr1).mintValidatorPrivate(users[0], 1, ethers.utils.parseEther("0.15"), "0x0000000000000000000000000000000000", {value: ethers.utils.parseEther("0.10")})).to.be.revertedWith("");
        });
        it("Should successfully mint a validator NFT using the _mintValidator function", async function () {
            await validatorNFT.connect(owner).startPreSale();

            const proof = merkleTree.getHexProof(ethers.utils.solidityKeccak256([
                "address", "uint256", "uint256"
            ], [users[0], 2, ethers.utils.parseEther("0.15")]));
            console.log("Proof for: ", proof);
            await validatorNFT.connect(owner).mintValidatorPrivate(users[0], 2, ethers.utils.parseEther("0.15"), proof, {value: ethers.utils.parseEther("0.15")});

            // Check if the NFT was minted successfully
            expect(await validatorNFT.ownerOf(0)).to.equal(users[0]);
        });

    });

    describe("mintValidatorPublic", function () {
        beforeEach(async function () { // Make sure the contract is in the PublicSale stage for these tests
            await validatorNFT.connect(owner).startPublicSale();
        });
        it("Should check for the correct stage (PublicSale)", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice})).to.not.be.reverted;
        });

        it("Should revert with invalid stage (Closed or PreSale)", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await validatorNFT.connect(owner).endSale();

            await expect(validatorNFT.connect(addr1).mintValidatorPublic(users[0], tier, {value: mintPrice})).to.be.reverted;
        });

        it("Should check for valid tier input (1 or 2)", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice})).to.not.be.reverted;
        });

        it("Should revert with invalid tier (0 or -22 or 80)", async function () {
            const invalidTier = 80;
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], invalidTier, {value: 0})).to.be.reverted;
        });

        it("Should check for the correct mint price based on the tier", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice})).to.not.be.reverted;
        });

        it("Should revert with incorrect mint price", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice.sub(1)})).to.be.revertedWith("Amount Not Correct");
        });

        it("Should successfully mint a validator NFT using the _mintValidator function", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            const tokenIdBefore = await validatorNFT.tokenIdCounter();
            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
            const tokenIdAfter = await validatorNFT.tokenIdCounter();
            expect(tokenIdAfter).to.equal(tokenIdBefore.add(1));
        });
        it("Should mint a validator NFT when provided with valid inputs", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice})).to.not.be.reverted;
        });

        it("Should check for available batch minting slots", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            const maxMint = (await validatorNFT.mintBatch(tier)).toNumber();

            // Mint maxMint times

            await validatorNFT.connect(owner).mintValidatorPublicBatch(users[0], maxMint, tier, {value: ethers.utils.parseEther("30")});


            // Attempt to mint one more and expect it to be reverted
            await expect(validatorNFT.connect(owner).mintValidatorPublic(tier, {value: mintPrice})).to.be.reverted;
        });
        it("Should increment tokenIdCounter and validatorCounter[tier]", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);

            const tokenIdBefore = await validatorNFT.tokenIdCounter();
            const validatorCounterBefore = await validatorNFT.validatorCounter(tier);

            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});

            const tokenIdAfter = await validatorNFT.tokenIdCounter();
            const validatorCounterAfter = await validatorNFT.validatorCounter(tier);

            expect(tokenIdAfter).to.equal(tokenIdBefore.add(1));
            expect(validatorCounterAfter).to.equal(validatorCounterBefore.add(1));
        });

        it("Should call _safeMint to mint the token", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);


            await validatorNFT.connect(owner).mintValidatorPublic(users[1], tier, {value: mintPrice});

            const ownerOfToken = await validatorNFT.ownerOf(0);

            expect(ownerOfToken).to.equal(users[1]);
        });

        it("Should set the validatorMintLevel for the minted token", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);

            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});


            const mintLevel = await validatorNFT.validatorMintLevel(0);

            expect(mintLevel).to.equal(tier);
        });

        it("Should mint a validator NFT when there is only one slot available in the batch", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);

            // Fill up the batch slots except one
            for (let i = 0; i < (await validatorNFT.mintBatch(tier)) - 1; i++) {
                await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
            }
            // Mint the last slot in the batch
            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
            expect(await validatorNFT.ownerOf(29)).to.equal(users[0]);
        });

        it("Should revert when attempting to mint a validator NFT when the batch is full", async function () {
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);

            // Fill up the batch slots
            for (let i = 0; i < (await validatorNFT.mintBatch(tier)); i++) {
                await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
            }

            // Attempt to mint when the batch is full
            await expect(validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice})).to.be.revertedWith("Exceed batch amount");
        });

    });

    describe("reserveValidator", function () {

        it("Should revert when an unauthorized account attempts to call reserveValidator", async function () {
            const tier = 1;
            const amount = 10;
            await expect(validatorNFT.connect(addr1).reserveValidator(users[0], amount, tier)).to.be.reverted;
        });

        it("Should revert with invalid tier input", async function () {
            const tier = 0;
            const amount = 2;
            await expect(validatorNFT.connect(owner).reserveValidator(users[0], amount, tier)).to.be.revertedWith("Invalid Tier");
        });

        it("Should mint the specified amount of validator NFTs using the _mintValidator function", async function () {
            const tier = 1;
            const amount = 2;
            await validatorNFT.connect(owner).reserveValidator(owner.address, amount, tier);

            expect(await validatorNFT.ownerOf(0)).to.equal(owner.address);
            expect(await validatorNFT.ownerOf(1)).to.equal(owner.address);
        });

        it("Should mint the specified amount of validator NFTs in different Tier", async function () {
            const tier = 2;
            const amount = 3;
            await validatorNFT.connect(owner).reserveValidator(owner.address, amount, tier);

            await validatorNFT.connect(owner).reserveValidator(owner.address, amount, 2);
            expect(await validatorNFT.ownerOf(0)).to.equal(owner.address);
            expect(await validatorNFT.ownerOf(1)).to.equal(owner.address);
            expect(await validatorNFT.ownerOf(2)).to.equal(owner.address);
        });

    });
    describe("setAuthorizedCaller and setReferral functions", function () {

        it("Should revert when an unauthorized account attempts to call setAuthorizedCaller", async function () {
            await expect(validatorNFT.connect(addr1).setAuthorizedCaller(users[1], true)).to.be.reverted;
        });
        it("Should set the status to true for an authorized caller", async function () {

            await validatorNFT.connect(owner).setAuthorizedCaller(users[1], true);
            expect(await validatorNFT.authorizedCallers(users[1])).to.equal(true);
        });

        it("Should set the status to false for an unauthorized caller", async function () {

            await validatorNFT.connect(owner).setAuthorizedCaller(users[1], false);
            expect(await validatorNFT.authorizedCallers(users[1])).to.equal(false);
        });
        it("Should revert when an unauthorized account attempts to call setReferral", async function () {
            const validatorTokenId = 1;
            const userAddr = users[1];
            const lieutenantAddr = users[2];
            const userKaratScore = 100;
            await expect(validatorNFT.connect(addr1).setReferral(validatorTokenId, userAddr, lieutenantAddr, userKaratScore)).to.be.reverted;
        });

        // Add test cases for calling setReferral with invalid validatorTokenId, various combinations of userAddr and lieutenantAddr, and different userKaratScore values

        // it("Should update the state variables and emit the ReferralSet event when provided with valid inputs", async function () {
        // const validatorTokenId = 0;
        // const userAddr = users[1];
        // const lieutenantAddr = users[2];
        // const userKaratScore = 100;
        // const mintPrice = await validatorNFT.price(1);
        // await validatorNFT.connect(owner).startPublicSale();
        // await validatorNFT.connect(owner).mintValidatorPublic(owner.address, 1, { value: mintPrice });
        // await validatorNFT.connect(owner).setAuthorizedCaller(owner.address, true);

        // await expect(validatorNFT.connect(owner).setReferral(validatorTokenId, userAddr, lieutenantAddr, userKaratScore))
        //     .to.emit(validatorNFT, "ReferralSet")
        //     .withArgs(validatorTokenId, userAddr, lieutenantAddr, userKaratScore);
        // });
    });
    describe("tokenURI function", function () {

        it("Should revert when called with an invalid tokenId", async function () {
            const invalidTokenId = 9999;
            await expect(validatorNFT.tokenURI(invalidTokenId)).to.be.revertedWith("Token does not exist");
        });

        it("Should generate the correct token URI based on the validatorMintLevel and baseURI", async function () {
            const tokenId = 0;
            const mintPrice = await validatorNFT.price(1);
            await validatorNFT.connect(owner).startPublicSale();
            await validatorNFT.connect(owner).mintValidatorPublic(owner.address, 1, {value: mintPrice});

            const mintLevel = await validatorNFT.validatorMintLevel(tokenId);
            const baseURI = await validatorNFT.baseURI();
            const expectedTokenURI = `${baseURI}${tokenId}.json`;

            expect(await validatorNFT.tokenURI(tokenId)).to.equal(expectedTokenURI);
        });
    });

    describe("Upgradability", function () {


        let upgradedValidatorNFT;

        it("Should only allow the contract owner to call the upgradesTo function", async function () {
            const NewValidatorNFT = await ethers.getContractFactory("ValidatorNFTV2");
            const newValidatorNFTImpl = await NewValidatorNFT.deploy();

            await expect(validatorNFT.connect(addr1).upgradeTo(newValidatorNFTImpl.address)).to.be.reverted;
        });

        it("Should deploy a new implementation of the ValidatorNFT contract with additional or modified functions", async function () {
            const NewValidatorNFT = await ethers.getContractFactory("ValidatorNFTV2");
            const newValidatorNFTImpl = await NewValidatorNFT.deploy();

            await validatorNFT.connect(owner).upgradeTo(newValidatorNFTImpl.address);
            upgradedValidatorNFT = newValidatorNFTImpl;

            const result = await upgradedValidatorNFT.connect(owner).testV2();
            expect(result).to.equal("Upgrade Success!");
        });

        it("Test the upgradability of the ValidatorNFT contract while it's in different stages", async function () { // Set stage to PreSale
            await validatorNFT.connect(owner).startPreSale();
            const stageBeforeUpgrade = await validatorNFT.currentStage();

            // Upgrade the contract again
            const NewValidatorNFTV3 = await ethers.getContractFactory("ValidatorNFTV2");
            const newValidatorNFTImplV3 = await NewValidatorNFTV3.deploy();
            await validatorNFT.connect(owner).upgradeTo(newValidatorNFTImplV3.address);

            // Update the upgradedValidatorNFT reference to point to the new contract instance
            upgradedValidatorNFT = await ethers.getContractAt("ValidatorNFTV2", upgradedValidatorNFT.address);

            const stageAfterUpgrade = await validatorNFT.currentStage();
            expect(stageBeforeUpgrade).to.equal(stageAfterUpgrade);
        });
        it("Test the upgradability of the ValidatorNFT contract with different state variables", async function () { // Check tokenIdCounter before upgrade
            const tokenIdCounterBeforeUpgrade = await validatorNFT.tokenIdCounter();

            // Upgrade the contract again
            const NewValidatorNFTV4 = await ethers.getContractFactory("ValidatorNFTV2");
            const newValidatorNFTImplV4 = await NewValidatorNFTV4.deploy();
            await validatorNFT.connect(owner).upgradeTo(newValidatorNFTImplV4.address);
            const upgradedValidatorNFTV4 = await ethers.getContractAt("ValidatorNFTV2", upgradedValidatorNFT.address);

            // Check tokenIdCounter after upgrade
            const tokenIdCounterAfterUpgrade = await upgradedValidatorNFTV4.tokenIdCounter();
            expect(tokenIdCounterBeforeUpgrade).to.equal(tokenIdCounterAfterUpgrade);
        });


    });

    describe("Advanced Scenarios", function () {
        let newOwner;

        beforeEach(async function () {
            [newOwner] = await ethers.getSigners();
        });

        it("Transfer ownership from dev account to another address", async function () {
            await validatorNFT.connect(owner).transferOwnership(newOwner.address);

            const actualNewOwner = await validatorNFT.owner();
            expect(actualNewOwner).to.equal(newOwner.address);
        });

        it("New owner reserves 30 tier1, 10 tier2 NFTs", async function () {
            await validatorNFT.connect(owner).transferOwnership(newOwner.address);
            await validatorNFT.connect(newOwner).reserveValidator(newOwner.address, 30, 1);
            await validatorNFT.connect(newOwner).reserveValidator(newOwner.address, 10, 2);

            const tier1Count = await validatorNFT.validatorCounter(1);
            const tier2Count = await validatorNFT.validatorCounter(2);

            expect(tier1Count).to.equal(30);
            expect(tier2Count).to.equal(10);
        });

        it("Create new batch, reserve, and mint", async function () {
            await validatorNFT.connect(newOwner).startPublicSale();
            await validatorNFT.connect(owner).transferOwnership(newOwner.address);
            await validatorNFT.connect(newOwner).createNewBatch(10, 30);
            await validatorNFT.connect(newOwner).reserveValidator(newOwner.address, 5, 1);
            await validatorNFT.connect(newOwner).mintValidatorPublic(newOwner.address, 1, {value: ethers.utils.parseEther("1")});

            const tier1Count = await validatorNFT.validatorCounter(1);
            expect(tier1Count).to.equal(6);
        });

        it("Upgrade and mint using validatorNFT.upgradeTo", async function () {
            await validatorNFT.connect(owner).transferOwnership(newOwner.address);
            const NewValidatorNFTV2 = await ethers.getContractFactory("ValidatorNFTV2");
            const newValidatorNFTImpl = await NewValidatorNFTV2.deploy();
            await validatorNFT.connect(newOwner).upgradeTo(newValidatorNFTImpl.address);

            const upgradedValidatorNFT = await ethers.getContractAt("ValidatorNFTV2", validatorNFT.address);
            await validatorNFT.connect(newOwner).startPublicSale();
            await upgradedValidatorNFT.connect(newOwner).mintValidatorPublic(newOwner.address, 1, {value: ethers.utils.parseEther("1")});

            const tier1Count = await upgradedValidatorNFT.validatorCounter(1);
            expect(tier1Count).to.equal(1);
        });
    });

});
