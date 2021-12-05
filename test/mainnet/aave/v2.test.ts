import { expect } from "chai";
import hre from "hardhat";
import { abis } from "../../../scripts/constant/abis";
import { addresses } from "../../../scripts/constant/addresses";
import { deployAndEnableConnector } from "../../../scripts/deployAndEnableConnector";
import { getMasterSigner } from "../../../scripts/getMasterSigner";
import { buildDSAv2 } from "../../../scripts/buildDSAv2";
import { ConnectV2AaveV2 } from "../../artifacts/contracts/mainnet/connectors/aave/v2/main.sol/ConnectV2AaveV2.json";
import { parseEther } from "@ethersproject/units";
import { encodeSpells } from "../../../scripts/encodeSpells";
import { tokens } from "../../../scripts/constant/tokens";
import { constants } from "../../../scripts/constant/constant";
import { addLiquidity } from "../../../scripts/addLiquidity";
// const { ethers } = hre;

describe("Aave V2", function () {
  const connectorName = "AAVEV2-TEST-A";

  let wallet0: any, wallet1: any;
  let dsaWallet0: any;
  let instaConnectorsV2: any;
  let connector: any;
  let masterSigner: any;

  before(async () => {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: 12796965,
          },
        },
      ],
    });
    [wallet0, wallet1] = await ethers.getSigners();
    masterSigner = await getMasterSigner();
    instaConnectorsV2 = await ethers.getContractAt(
      abis.core.connectorsV2,
      addresses.core.connectorsV2
    );
    connector = await deployAndEnableConnector({
      connectorName,
      contractArtifact: ConnectV2AaveV2,
      signer: masterSigner,
      connectors: instaConnectorsV2,
    });
    console.log("Connector address", connector.address);
  });

  it("should have contracts deployed", async () => {
    expect(!!instaConnectorsV2.address).to.be.true;
    expect(!!connector.address).to.be.true;
    expect(!!masterSigner.address).to.be.true;
  });

  describe("DSA wallet setup", function () {
    it("Should build DSA v2", async function () {
      dsaWallet0 = await buildDSAv2(wallet0.address);
      expect(!!dsaWallet0.address).to.be.true;
    });

    it("Deposit ETH into DSA wallet", async function () {
      await wallet0.sendTransaction({
        to: dsaWallet0.address,
        value: parseEther("10"),
      });
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(
        parseEther("10")
      );
    });
  });

  describe("Main", function () {
    it("should deposit ETH in Aave V2", async function () {
      const amt = parseEther("1");
      const spells = [
        {
          connector: connectorName,
          method: "deposit",
          args: [tokens.eth.address, amt, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);

      await tx.wait();

      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.eq(
        parseEther("9")
      );
    });

    it("Should borrow and payback DAI from Aave V2", async function () {
      const amt = parseEther("100"); // 100 DAI
      const setId = "83478237";
      const spells = [
        {
          connector: connectorName,
          method: "borrow",
          args: [tokens.dai.address, amt, 2, 0, setId],
        },
        {
          connector: connectorName,
          method: "payback",
          args: [tokens.dai.address, amt, 2, setId, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.lte(
        ethers.utils.parseEther("9")
      );
    });

    it("Should borrow and payback half DAI from Aave V2", async function () {
      const amt = parseEther("100"); // 100 DAI
      // const setId = "83478237";
      await addLiquidity("dai", dsaWallet0.address, parseEther("1"));
      let spells = [
        {
          connector: connectorName,
          method: "borrow",
          args: [tokens.dai.address, amt, 2, 0, 0],
        },
        {
          connector: connectorName,
          method: "payback",
          args: [tokens.dai.address, amt.div(2), 2, 0, 0],
        },
      ];

      let tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.lte(
        ethers.utils.parseEther("9")
      );

      spells = [
        {
          connector: connectorName,
          method: "payback",
          args: [tokens.dai.address, constants.max_value, 2, 0, 0],
        },
      ];

      tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.lte(
        ethers.utils.parseEther("9")
      );
    });

    it("Should deposit all ETH in Aave V2", async function () {
      const spells = [
        {
          connector: connectorName,
          method: "deposit",
          args: [tokens.eth.address, constants.max_value, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.lte(
        ethers.utils.parseEther("0")
      );
    });

    it("Should withdraw all ETH from Aave V2", async function () {
      const spells = [
        {
          connector: connectorName,
          method: "withdraw",
          args: [tokens.eth.address, constants.max_value, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(
        ethers.utils.parseEther("10")
      );
    });

    it("should deposit and withdraw", async () => {
      const amt = parseEther("1"); // 1 eth
      const setId = "834782373";
      const spells = [
        {
          connector: connectorName,
          method: "deposit",
          args: [tokens.eth.address, amt, 0, setId],
        },
        {
          connector: connectorName,
          method: "withdraw",
          args: [tokens.eth.address, amt, setId, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(
        ethers.utils.parseEther("10")
      );
    });
  });
});