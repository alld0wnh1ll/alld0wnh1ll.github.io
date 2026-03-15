const path = require("path");
const fs = require("fs");

const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts", "game");

function loadAbi(contractName) {
  const mapping = {
    GameController: "GameController.sol/GameController.json",
    PriceOracle: "PriceOracle.sol/PriceOracle.json",
    InspectionRegistry: "InspectionRegistry.sol/InspectionRegistry.json",
    CarLot: "CarLot.sol/CarLot.json",
    Bank: "Bank.sol/Bank.json",
    Mixer: "Mixer.sol/Mixer.json",
    Marketplace: "Marketplace.sol/Marketplace.json",
    InsuranceDesk: "InsuranceDesk.sol/InsuranceDesk.json",
    TokenFactory: "TokenFactory.sol/TokenFactory.json",
    StudentToken: "StudentToken.sol/StudentToken.json",
    TimelockEscrow: "TimelockEscrow.sol/TimelockEscrow.json",
  };
  const rel = mapping[contractName];
  if (!rel) return null;
  const p = path.join(artifactsDir, rel);
  if (!fs.existsSync(p)) return null;
  const art = JSON.parse(fs.readFileSync(p, "utf8"));
  return art.abi;
}

function getContractNameByAddress(addr, config) {
  const a = (addr || "").toLowerCase();
  const map = {
    [config.gameController?.toLowerCase()]: "GameController",
    [config.priceOracle?.toLowerCase()]: "PriceOracle",
    [config.inspectionRegistry?.toLowerCase()]: "InspectionRegistry",
    [config.carLot?.toLowerCase()]: "CarLot",
    [config.bank?.toLowerCase()]: "Bank",
    [config.mixer?.toLowerCase()]: "Mixer",
    [config.marketplace?.toLowerCase()]: "Marketplace",
    [config.insuranceDesk?.toLowerCase()]: "InsuranceDesk",
    [config.tokenFactory?.toLowerCase()]: "TokenFactory",
  };
  return map[a] || null;
}

function decodeLog(log, config) {
  const contractName = getContractNameByAddress(log.address, config);
  if (!contractName) return null;

  const abi = loadAbi(contractName);
  if (!abi) return null;

  const { Interface } = require("ethers");
  const iface = new Interface(abi);
  try {
    const parsed = iface.parseLog({
      topics: log.topics,
      data: log.data,
    });
    return { contractName, eventName: parsed.name, args: parsed.args };
  } catch {
    return null;
  }
}

module.exports = { loadAbi, getContractNameByAddress, decodeLog };
