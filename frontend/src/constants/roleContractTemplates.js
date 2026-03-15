/**
 * Role-specific contract boilerplates and deploy scripts.
 * Students use these to build and deploy their role contract, then register in the web UI.
 */

export const ROLE_CONTRACT_TEMPLATES = {
  'Detective': {
    name: 'CarInvestigatorRole',
    filePath: 'contracts/student/roles/CarInvestigatorRole.sol',
    deployCmd: 'ROLE=Detective npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Search the chain: read mechanic reports and original car history. Buyers pay you (off-chain) to report. You can submit honest or bribed reports via submitReport(carSale, passed).',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICarSale {
    function submitInvestigatorReport(bool passed) external;
}

contract CarInvestigatorRole {
    address public investigator;

    constructor() {
        investigator = msg.sender;
    }

    /// @notice Submit report for a CarSale. You read trueCondition off-chain, then submit.
    ///         You can submit the truth or lie (bribed). Contract cannot verify.
    function submitReport(address carSale, bool passed) external {
        require(msg.sender == investigator, "Only investigator");
        require(carSale != address(0), "Invalid CarSale address");
        ICarSale(carSale).submitInvestigatorReport(passed);
    }
}`,
    deployHint: 'ROLE=Detective npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Deploy CarInvestigatorRole', 'Share contract address with instructor', 'Instructor calls setInvestigator(yourContractAddress) on each CarSale', 'After mechanic inspects: read getTrueCondition() off-chain, then submitReport(carSale, true/false)—honest or bribed']
  },
  'Car Seller': {
    name: null,
    filePath: null,
    deployCmd: null,
    description: 'No contract to deploy. Share your wallet address with the instructor—they set it as seller in CarSale. You receive proceeds directly to your wallet when the sale completes.',
    template: null,
    deployHint: 'No deploy—share your wallet address',
    buildSteps: ['Share your wallet address with the instructor', 'Instructor sets setSeller(yourAddress) on CarSale', 'Wait for buyer and mechanic to complete the flow', 'Receive ETH to your wallet when sale completes']
  },
  'Car Buyer': {
    name: 'CarBuyerRole',
    filePath: 'contracts/student/roles/CarBuyerRole.sol',
    deployCmd: 'ROLE=CarBuyer CARSALE_ADDRESS=0xYourCarSaleAddr npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Fund contract, then: payDeposit → requestInspection → completePurchase (or requestRefund).',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICarSale {
    function payDeposit() external payable;
    function requestInspection() external;
    function completePurchase() external payable;
    function requestRefund() external;
    function depositAmount() external view returns (uint256);
    function salePrice() external view returns (uint256);
}

contract CarBuyerRole {
    address public buyer;
    ICarSale public carSale;
    
    constructor(address _carSale) {
        buyer = msg.sender;
        carSale = ICarSale(_carSale);
    }
    
    receive() external payable {}
    
    function payDeposit() external {
        require(msg.sender == buyer);
        carSale.payDeposit{value: carSale.depositAmount()}();
    }
    
    function requestInspection() external {
        require(msg.sender == buyer);
        carSale.requestInspection();
    }
    
    function completePurchase() external {
        require(msg.sender == buyer);
        uint256 remaining = carSale.salePrice() - carSale.depositAmount();
        carSale.completePurchase{value: remaining}();
    }
    
    function requestRefund() external {
        require(msg.sender == buyer);
        carSale.requestRefund();
    }
}`,
    deployHint: 'ROLE=CarBuyer CARSALE_ADDRESS=0x... npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Get CarSale address: instructor deploys in Live → Contract Lab → Deploy → Car Sale, then shares it', 'Deploy: ROLE=CarBuyer CARSALE_ADDRESS=0x... npx hardhat run scripts/deploy-role.js --network localhost', 'Send 2+ ETH to your contract', 'Call payDeposit() → requestInspection() → completePurchase()']
  },
  'Mechanic': {
    name: 'MechanicRole',
    filePath: 'contracts/student/roles/MechanicRole.sol',
    deployCmd: 'ROLE=Mechanic CARSALE_ADDRESS=0xYourCarSaleAddr npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Call mechanicInspect(true) or mechanicInspect(false) on CarSale. Report honestly.',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICarSale {
    function mechanicInspect(bool passed) external;
}

contract MechanicRole {
    address public mechanic;
    ICarSale public carSale;
    
    constructor(address _carSale) {
        mechanic = msg.sender;
        carSale = ICarSale(_carSale);
    }
    
    function mechanicInspect(bool passed) external {
        require(msg.sender == mechanic);
        carSale.mechanicInspect(passed);
    }
}`,
    deployHint: 'ROLE=Mechanic CARSALE_ADDRESS=0x... npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Get CarSale address: instructor deploys in Live → Contract Lab → Deploy → Car Sale, then shares it', 'Deploy MechanicRole with CarSale address', 'Admin sets you as mechanic in CarSale', 'Call mechanicInspect(true) or mechanicInspect(false)']
  },
  'Escrow Agent': {
    name: 'EscrowAgentRole',
    filePath: 'contracts/student/roles/EscrowAgentRole.sol',
    deployCmd: 'ROLE=EscrowAgent npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Hold funds until conditions are met. Release to designated address.',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EscrowAgentRole {
    address public agent;
    
    constructor() { agent = msg.sender; }
    
    receive() external payable {}
    
    function releaseTo(address payable to, uint256 amount) external {
        require(msg.sender == agent);
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}`,
    deployHint: 'ROLE=EscrowAgent npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Deploy EscrowAgentRole', 'Register in web UI']
  },
  'Victim': {
    name: 'VictimRole',
    filePath: 'contracts/student/roles/VictimRole.sol',
    deployCmd: 'ROLE=Victim npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Pay ransom through RansomPayment contract. Your payment creates an on-chain trail.',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRansomPayment {
    function payRansom() external payable;
}

contract VictimRole {
    address public victim;
    
    constructor() { victim = msg.sender; }
    
    receive() external payable {}
    
    function payRansomOnBehalf(address ransomContract) external payable {
        require(msg.sender == victim);
        IRansomPayment(ransomContract).payRansom{value: msg.value}();
    }
}`,
    deployHint: 'ROLE=Victim npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Deploy VictimRole', 'Get RansomPayment address from instructor', 'Call payRansomOnBehalf(ransomAddr) with ETH']
  },
  'Attacker': {
    name: 'AttackerRole',
    filePath: 'contracts/student/roles/AttackerRole.sol',
    deployCmd: 'ROLE=Attacker npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Receive ransom payments. Instructor sets your address in RansomPayment.',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AttackerRole {
    address public attacker;
    
    constructor() { attacker = msg.sender; }
    
    receive() external payable {}
    
    function withdraw() external {
        require(msg.sender == attacker);
        (bool ok, ) = payable(attacker).call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }
}`,
    deployHint: 'ROLE=Attacker npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Deploy AttackerRole', 'Share address with instructor', 'Instructor sets you in RansomPayment.setAttacker()', 'Receive payments from victims']
  },
  'Investigator': {
    name: 'InvestigatorRole',
    filePath: 'contracts/student/roles/InvestigatorRole.sol',
    deployCmd: 'ROLE=Investigator npx hardhat run scripts/deploy-role.js --network localhost',
    description: 'Trace the ransom flow. Submit findings to scenario contract for bounty.',
    template: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract InvestigatorRole {
    address public investigator;
    address public submittedAddress;
    
    constructor() { investigator = msg.sender; }
    
    function submitFinding(address _found) external {
        require(msg.sender == investigator);
        submittedAddress = _found;
    }
}`,
    deployHint: 'ROLE=Investigator npx hardhat run scripts/deploy-role.js --network localhost',
    buildSteps: ['Deploy InvestigatorRole', 'Use block explorer + Playground to trace', 'Submit correct address for bounty', 'Register this contract when done']
  },
  'Admin': { name: 'Admin', filePath: 'contracts/student/', deployCmd: 'Contract Builder → House Sale', template: '// Deploy via Contract Builder', deployHint: 'Contract Builder (CLI option 9)', buildSteps: ['Use Contract Builder'] },
  'Seller': { name: 'Seller', filePath: 'contracts/student/', deployCmd: 'Contract Builder → House Sale', template: '// Deploy via Contract Builder', deployHint: 'Contract Builder', buildSteps: ['Contract Builder → House Sale'] },
  'Buyer': { name: 'Buyer', filePath: 'contracts/student/', deployCmd: 'Contract Builder', template: '// Deploy via Contract Builder', deployHint: 'Contract Builder', buildSteps: ['Contract Builder'] },
  'Organizer': { name: 'Organizer', filePath: 'contracts/student/', deployCmd: 'Contract Builder → Event Tickets', template: '// Contract Builder → Event Tickets', deployHint: 'Contract Builder', buildSteps: ['Contract Builder → Event Tickets'] },
  'Creator': { name: 'Creator', filePath: 'contracts/student/', deployCmd: 'Contract Builder → Crowdfunding', template: '// Contract Builder → Crowdfunding', deployHint: 'Contract Builder', buildSteps: ['Contract Builder → Crowdfunding'] },
  'Contributor': { name: 'Contributor', filePath: 'contracts/student/', deployCmd: 'Interact with Creator contract', template: '// Interact with Creator\'s contract', deployHint: 'Register address you use', buildSteps: ['Contribute via Creator\'s contract'] },
  'Voter': { name: 'Voter', filePath: 'contracts/student/', deployCmd: 'Interact with voting contract', template: '// Interact with voting contract', deployHint: 'Register any contract', buildSteps: ['Vote via voting contract'] }
};
