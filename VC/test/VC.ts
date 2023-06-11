const {expect} = require('chai');
const {ethers, upgrades} = require('hardhat');
const Web3 = require("web3");
const web3 = new Web3("https://testnet.era.zksync.dev");


// JavaScript equivalent of Issuer struct in Solidity
class Issuer {

    constructor(id, ethereumAddress) {
        this.id = id;
        this.ethereumAddress = ethereumAddress;
    }
}

// JavaScript equivalent of CredentialSubject struct in Solidity
class CredentialSubject {
    constructor(ethereumAddress, _type, url) {
        this.ethereumAddress = ethereumAddress;
        this._type = _type;
        this.url = url;
    }
}

// JavaScript equivalent of VerifiableCredential struct in Solidity
class VerifiableCredential {
    constructor(issuer, credentialSubject, issuanTime) {
        this.issuer = issuer;
        this.credentialSubject = credentialSubject;
        this.issuanTime = issuanTime;
    }
}
let users: any;

async function generateUUID(to, vcType, url) {
    const packedData = ethers.utils.defaultAbiCoder.encode([
        "address", "string", "string"
    ], [to, vcType, url]);

    const uuidBytes = ethers.utils.solidityKeccak256(["bytes"], [packedData]);

    const uuid = ethers.BigNumber.from(uuidBytes).toString();

    return uuid;
}


describe('KaratVC', function () {
    let KaratVC: any,
        karatVC: any,
        owner: any,
        addr1: any,
        addr2,
        minter,
        other;

    beforeEach(async function () {
        KaratVC = await ethers.getContractFactory('VCRegistry');
        [
            owner,
            addr1,
            addr2,
            minter,
            other
        ] = await ethers.getSigners();
        users = ["0x2C4C74339AdA433159965E2881Bd16349bb092B2", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", "0x4c79B28335723E158b8F02b7E3191Aa570B2ED91", owner.address];

        karatVC = await upgrades.deployProxy(KaratVC, [
            "KaratVC", "KVC", "karatdao.com", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4"
        ], {initializer: 'initialize'});
        await karatVC.deployed();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            await karatVC.connect(owner).pause();
            expect(await karatVC.paused()).to.equal(true);
        });

        it("Should assign the authorized Issuer role to the owner", async function () {
            expect(await karatVC.authorizedIssuers(owner.address)).to.be.true;
        });
        it("Contract should be correctly initialized", async function () {
            const name = await karatVC.name();
            const symbol = await karatVC.symbol();
            const baseURI = await karatVC.baseURI();

            expect(name).to.equal("KaratVC");
            expect(symbol).to.equal("KVC");
            expect(baseURI).to.equal("karatdao.com");
        });
        it("Should fail when invalid parameters for _baseURI, name, and symbol, or claimerContractAddress are provided", async function () {

            await expect(upgrades.deployProxy(KaratVC, [
                "KaratVC", "KVC", "aaa", "123"
            ], {initializer: 'initialize'})).to.be.reverted;
        });

        it("Should be able to call the initialize function with valid parameters", async function () {
            let newKaratVC: any;
            newKaratVC = await upgrades.deployProxy(KaratVC, [
                "KaratVC", "KVC", "aaa", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4"
            ], {initializer: 'initialize'});
            await newKaratVC.deployed();
            const baseURI = await newKaratVC.baseURI();
            const name = await newKaratVC.name();
            const symbol = await newKaratVC.symbol();

            expect(baseURI).to.equal("aaa");
            expect(name).to.equal("KaratVC");
            expect(symbol).to.equal("KVC");
        });

    });

    describe("Pause and Unpause", function () {
        it("Should be able to pause", async function () {
            await karatVC.pause();
            expect(await karatVC.paused()).to.be.true;
        });

        it("Should be able to unpause", async function () {
            await karatVC.pause();
            await karatVC.unpause();
            expect(await karatVC.paused()).to.be.false;
        });

        it("Should not allow non-admin to pause", async function () {
            await expect(karatVC.connect(addr1).pause()).to.be.reverted;
        });

        it("Should not allow non-admin to unpause", async function () {
            await expect(karatVC.connect(addr1).unpause()).to.be.reverted;
        });
    });

    describe("BaseURI", function () {
        it("Should be able to update baseURI", async function () {
            await karatVC.updateBaseURI("newBaseURI");
            expect(await karatVC.baseURI()).to.equal("newBaseURI");
        });

        it("Should not allow non-admin to update baseURI", async function () {
            await expect(karatVC.connect(addr1).updateBaseURI("newBaseURI")).to.be.reverted;
        });
    });

    describe("Signature Check", function () {
        it("Test mint function with valid inputs and a valid signature", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            const chainId = await owner.getChainId();

            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            console.log("Sig: ", signature);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(users[0], vc, signature);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
        });
    });

    describe("Check TokenURI and UpdateURI", function () {
        beforeEach(async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(users[0], vc, signature);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);

        });

        it("Should get the correct tokenURI after minting", async function () {
            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            const uuid = await generateUUID(to, vcType, url);
            let uri = await karatVC.tokenURI(uuid);
            // Check the tokenURI
            expect(uri).to.equal(`karatdao.com${uuid}.json`);
        });

        it("Should reverted if no token", async function () { // Check the tokenURI
            await expect(karatVC.tokenURI(1)).to.be.revertedWith("Not Exist");
        });

    });

    describe("UUID Functions", function () {
        beforeEach(async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(users[0], vc, signature);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);

        });
        it("Should generate correct UUID", async function () {
            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            const uuid = await generateUUID(to, vcType, url);
            console.log('UUID:', uuid);

            const retrievedVC = await karatVC.getVC(to, uuid);
            expect(await retrievedVC.issuanTime).to.equal(1685990276);
        });

        it("Should revert if both incorrect UUID and address", async function () {
            let to = users[0]; // Sample Ethereum address
            let vcType = 'type11';
            let url = 'ceramic://url1';

            const uuid = await generateUUID(to, vcType, url);
            console.log('UUID:', uuid);

            const retrievedVC = await karatVC.getVC(to, uuid);
            expect(await retrievedVC.issuanTime).to.not.equal(1685990276);
        });
        it("Should revert if incorrect UUID or address", async function () {
            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url1';

            const uuid = await generateUUID(to, vcType, url);
            console.log('UUID:', uuid);

            const retrievedVC = await karatVC.getVC(to, uuid);
            expect(await retrievedVC.issuanTime).to.not.equal(1685990276);
        });
        it("Edge Case: Big uuid", async function () {
            let to = users[0]; // Sample Ethereum address

            const number = 15555096599258418303455752931417801513279174464066021457294066788628246771468;
            const number_of_digits = number.toString.length;
            const new_number = BigInt('9' * number_of_digits);
            const max_uuid = new_number;
            console.log('UUID:', max_uuid);

            const vc = await karatVC.getVC(to, max_uuid);
            expect(await vc.issuanTime).to.be.equal(0)
        });

        it("Edge Case: Address(0)", async function () {
            let to = '0x0000000000000000000000000000000000000000'; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url1';

            const uuid = await generateUUID(to, vcType, url);

            const retrievedVC = await karatVC.getVC(to, uuid);
            expect(await retrievedVC.issuanTime).to.be.equal(0);
        });

        it("Should revoke vc with authorized signer", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            const uuid = await generateUUID(to, vcType, url);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
            await karatVC.connect(signer11).revokeVC(users[0], uuid);
        });

        it("Should revoke vc with user itself", async function () {
            const PRIVATE_KEY1 = process.env.PRIVATE_KEY1 || "";
            const provider = ethers.provider;
            const signerNew = new ethers.Wallet(PRIVATE_KEY1, provider);

            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            const uuid = await generateUUID(to, vcType, url);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
            await karatVC.connect(signerNew).revokeVC(users[0], uuid);
        });

        it("Should revert revoke when neither authorzied signer or user", async function () {
            const PRIVATE_KEY1 = process.env.PRIVATE_KEY1 || "";
            const provider = ethers.provider;
            const signerNew = new ethers.Wallet(PRIVATE_KEY1, provider);

            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            const uuid = await generateUUID(to, vcType, url);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
            expect(await karatVC.connect(addr1).revokeVC(users[0], uuid)).to.be.revertedWith("No Access to Delete");
        });

        it("Should revert revoke vc when not valid VC", async function () {
            const PRIVATE_KEY1 = process.env.PRIVATE_KEY1 || "";
            const provider = ethers.provider;
            const signerNew = new ethers.Wallet(PRIVATE_KEY1, provider);

            let to = users[0]; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            expect(await karatVC.balanceOf(users[0])).to.be.equal(1);
            const uuid = await generateUUID(to, vcType, url);
            await karatVC.connect(signerNew).revokeVC(users[0], uuid);

            const a = await karatVC.VCRegistryTable(users[0], uuid);
            expect(await a.issuanTime).to.be.equal(0);
        });

    });

    describe("Register VC Functions", function () {

        it("Should reverted if address not match", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await expect(karatVC.connect(signer11).registerVC(users[1], vc, signature)).to.revertedWith("Address Not Match");

        });

        it("Should reverted if given invalid signature", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                0
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            let {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects

            await expect(karatVC.connect(signer11).registerVC(users[0], vc, signature)).to.revertedWith("Not Valid VC");

        });

        it("Should reverted if already registered", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(users[0], vc, signature);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
            await expect(karatVC.connect(signer11).registerVC(users[0], vc, signature)).to.revertedWith("This VC has been registered");

        });

        it("Check ifRegistered and VcRegsirtry Table Mapping has been successfully updated", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));
            const uuid = generateUUID(vc.credentialSubject.ethereumAddress, vc.credentialSubject._type, vc.credentialSubject.url);
            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(users[0], vc, signature);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
            expect(await karatVC.ifRegisteredVC(uuid)).to.be.equal(true);

            const a = await karatVC.VCRegistryTable(users[0], uuid);
            expect(await a.issuanTime).to.be.equal(1685990276);
        });

    });

    describe("Register VC Batch Function", function () {
        it("Should mint batch tokens correctly", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };


            const credentialSubject1 = {
                ethereumAddress: users[1],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const vc1 = {
                issuer: issuer,
                credentialSubject: credentialSubject1,
                issuanTime: 1685990276
            };
            // Define multiple vcs and addresses
            const addresses = [
                users[0], users[1]
            ]; // Replace with actual addresses
            const vcs = [vc, vc1]; // Replace with actual VCs
            const signatures = [];

            for (let i = 0; i < addresses.length; i++) {
                const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                    "string",
                    "address",
                    "address",
                    "string",
                    "string",
                    "uint256"
                ], [
                    vcs[i].issuer.id,
                    vcs[i].issuer.ethereumAddress,
                    vcs[i].credentialSubject.ethereumAddress,
                    vcs[i].credentialSubject._type,
                    vcs[i].credentialSubject.url,
                    vcs[i].issuanTime
                ]));
                const provider = ethers.provider;

                const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);
                const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);

                signatures.push(signature);
            }
            const provider = ethers.provider;

            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Call registerVCBatch function
            await karatVC.connect(signer11).registerVCBatch(addresses, vcs, signatures);

            // Check if all tokens are minted correctly
            for (let i = 0; i < addresses.length; i++) {
                expect(await karatVC.balanceOf(addresses[i])).to.equal(1);
            }
        });
    });

    describe("Should revert when try to transfer", function () {
        beforeEach(async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: owner.address,
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint256"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            const uuid = await generateUUID(vc.credentialSubject.ethereumAddress, vc.credentialSubject._type, vc.credentialSubject.url,);

            console.log("UUID: ", uuid);
            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(owner.address, vc, signature);
            expect(await karatVC.balanceOf(owner.address)).to.equal(1);

        });

        it("Should not allow token transfer", async function () {

            let to = owner.address; // Sample Ethereum address
            let vcType = 'type1';
            let url = 'ceramic://url';

            const uuid = await generateUUID(to, vcType, url);

            // Assume that owner has token with tokenId = 1
            const tokenId = uuid;

            await expect(karatVC.connect(owner).transferFrom(owner.address, users[1], tokenId)).to.be.revertedWith("Transfer are not allowed");
        });
    });

    describe("Should able to upgrade", function () {
        it("Contract can be upgraded using the UUPS pattern", async function () { // Deploy the new version of the contract

            const ClaimerNFTV2 = await ethers.getContractFactory("VCRegistryV2");
            const newClaimerNFTImpl = await ClaimerNFTV2.deploy();

            expect(await karatVC.connect(owner).upgradeTo(newClaimerNFTImpl.address)).to.not.reverted;

        });
        it("Contract vairables stay the same after UUPS pattern", async function () { // Deploy the new version of the contract

            const ClaimerNFTV2 = await ethers.getContractFactory("VCRegistryV2");
            const newClaimerNFTImpl = await ClaimerNFTV2.deploy();

            await karatVC.connect(owner).upgradeTo(newClaimerNFTImpl.address);

            const uri = await karatVC.baseURI();
            expect(uri).to.equal("karatdao.com");
        });
        it("should revert if called not by owner", async function () { // Deploy the new version of the contract

        });


    });

    describe("Should able to pause and unpause", function () {

      it("Contract can be paused only by owner", async function () { 
      });
      it("Contract can be unpaused only by owner", async function () { 
      });
      it("Should revert pause if not by owner", async function () { 
      });
      it("Should revert unpause if not by owner", async function () { 
      });

  });
});
