const fs = require("fs");
const path = require("path");
const csv = require("fast-csv");
const { toBech32, fromBech32 } = require("@cosmjs/encoding");

const {
  app_state: {
    auth: { accounts },
    bank: { balances },
  },
} = require("./draft_genesis.json");

// consts
const preSeedAddress = "elys13647xwfw6swdkexzn90xjym4erk3qwh3vq9y4k";
const seedAddress = "elys1gefdqpj2m24aunhadazufqd6ex5ts9uydg58dt";
const protocolRevenueAddress = "elys1uqznyaahdmp3ay8zex5cwf729ggdhc45dtys4f";
const strategicReserveAddress = "elys1vsyrn23dr4rj7lhlntlcmne55jk2tfjvvykv9d";
const communityFundAddress = "elys1lz79efsyznuya8qu2ygzrm2gx7h4tk6q4sgyxr";
const airdropAddress = "elys1wk7jwkqt2h9cnpkst85j9n454e4y8znlgk842n";
const kolAddress = "elys1ykrphaysp9u5m8379f3d7pr9k7t0xq757lr9vj";
const teamAddress = "elys1a9qavmjnjqrw9h8dj9adlfg9taz0xum7t60jw5";
const publicAddress = "elys1akmdyat0d33net2rgqnpm28xhydkhgraptmhey";
const privateAddress = "elys1zxgwtsut7xn90ulzhtfljsms94y8sy2k05qn34";
const advisorAddress = "elys1nkk8r3s4c9pvy492ryr23skml56uh8n776xqzh";

const bankBalancesMap = balances.reduce((acc, balance) => {
  acc[balance.address] = balance.coins;
  return acc;
}, {});

//

validateAuthModule();
validateBankModule();
// Multi sig accounts for pre seed, seed, private, advisors

//

// ContinuousVestingAccounts
const preSeed = accounts.filter(
  (account) => account.test_account === "pre-seed"
);
const privateRound = accounts.filter(
  (account) => account.test_account === "private-round"
);
const advisors = accounts.filter(
  (account) => account.test_account === "advisors"
);

// Periodic Vesting accounts
const communityFund = accounts.filter(
  (account) => account.test_account === "cf"
);
const strategic = accounts.filter(
  (account) => account.test_account === "strategic"
);
const team = accounts.filter((account) => account.test_account === "team");

generateCsv(preSeed, "pre_seed.csv", "cosmos");
generateCsv(privateRound, "private_round.csv", "cosmos");
generateCsv(advisors, "advisors.csv", "cosmos");
generateCsv(strategic, "strategic.csv");
generateCsv(communityFund, "community_fund.csv");
generateCsv(team, "team.csv");

// Utilities

// Adds all the accounts into a csv file
function generateCsv(accounts, fileName, accountPrefix = "elys") {
  const writeStream = fs.createWriteStream(path.join(__dirname, fileName));
  const csvStream = csv.format({ headers: true }); // Create a CSV stream
  // Pipe the CSV stream to the file write stream
  csvStream.pipe(writeStream);

  // Write the header
  csvStream.write([
    "given address",
    "elys address",
    "vesting amount",
    "bank",
    "account type",
    "vest start time",
    "vest end time",
  ]);

  // Adds account data to the CSV stream
  accounts.forEach((account) => {
    const start_time = account.start_time;
    const type = account["@type"];
    const { base_account, original_vesting, end_time } =
      account.base_vesting_account;
    const bankCoins = bankBalancesMap[base_account.address];

    if (bankCoins.length > 1) {
      throw new Error(`account ${base_account.address} has more than one coin`);
    }
    if (bankCoins[0].denom !== "uelys") {
      throw new Error(`Invalid denom for ${base_account.address}`);
    }

    if (original_vesting?.length > 1) {
      throw new Error(
        `account ${base_account.address} has more than one vesting coin`
      );
    }

    const formattedAddress = formatAddress(base_account.address, accountPrefix);
    csvStream.write([
      formattedAddress,
      base_account.address,
      original_vesting[0].amount / 1_000_000,
      bankCoins[0].amount / 1_000_000,
      type,
      new Date(start_time * 1000).toUTCString(),
      new Date(end_time * 1000).toUTCString(),
    ]);
  });

  // Calculate the total amount of coins in the accounts
  // const totalAmount = accounts.reduce((acc, account) => {
  //   const baseAccount = account.base_vesting_account.base_account;
  //   const coins = bankBalancesMap[baseAccount.address];
  //   return acc + parseInt(coins[0].amount);
  // }, 0);

  // console.log("Total amount in ", fileName, totalAmount / 1_000_000);

  // End the CSV stream
  csvStream.end();

  writeStream.on("finish", () => {
    console.log(`${fileName} file successfully created!`);
  });
}

function validateAuthModule() {
  // Validates that accounts are unique in auth module
  const unique = new Set();
  accounts.forEach((account) => {
    switch (account["@type"]) {
      case "/cosmos.auth.v1beta1.BaseAccount": {
        const address = account.address;
        if (unique.has(address)) {
          throw new Error(`Duplicate address found: ${address}`);
        }
        unique.add(address);
        break;
      }
      case "/cosmos.vesting.v1beta1.ContinuousVestingAccount":
      case "/cosmos.vesting.v1beta1.PeriodicVestingAccount":
        const address = account.base_vesting_account.base_account.address;
        if (unique.has(account.base_vesting_account.base_account.address)) {
          throw new Error(
            `Duplicate address found: ${address}. Category: ${account.test_account}`
          );
        }
        unique.add(address);
        break;
      default: {
        throw new Error(`Account type not handled: ${account["@type"]}`);
      }
    }
  });
}

function validateBankModule() {
  // Validates that accounts are unique in bank module
  const uniqueBank = new Set();
  balances.forEach((account) => {
    const address = account.address;
    if (uniqueBank.has(address)) {
      throw new Error(`Duplicate address found in bank: ${address}`);
    }
    uniqueBank.add(address);
  });
}

function formatAddress(address, prefix) {
  return toBech32(prefix, fromBech32(address).data);
}
