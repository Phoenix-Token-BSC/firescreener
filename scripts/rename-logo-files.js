const fs = require('fs');
const path = require('path');

// Token registry mapping symbols to contract addresses
const TOKEN_REGISTRY = [
  { address: "0x885c99a787BE6b41cbf964174C771A9f7ec48e04", symbol: "pht", name: "Phoenix Token", chain: "bsc" },
  { address: "0x6Ec90334d89dBdc89E08A133271be3d104128Edb", symbol: "wkc", name: "WikiCat Coin", chain: "bsc" },
  { address: "0x57bfe2af99aeb7a3de3bc0c42c22353742bfd20d", symbol: "war", name: "Water Rabbit Token", chain: "bsc" },
  { address: "0xb1957BDbA889686EbdE631DF970ecE6A7571A1B6", symbol: "dtg", name: "Defi Tiger Token", chain: "bsc" },
  { address: "0xd086B849a71867731D74D6bB5Df4f640de900171", symbol: "yukan", name: "Yukan Token", chain: "bsc" },
  { address: "0x1ee8a2f28586e542af677eb15fd00430f98d8fd8", symbol: "btcdragon", name: "BTCDragon Token", chain: "bsc" },
  { address: "0xE53D384Cf33294C1882227ae4f90D64cF2a5dB70", symbol: "ocicat", name: "Ocicat Token", chain: "bsc" },
  { address: "0x551877C1A3378c3A4b697bE7f5f7111E88Ab4Af3", symbol: "nene", name: "Nene Token", chain: "bsc" },
  { address: "0xDA1060158F7D593667cCE0a15DB346BB3FfB3596", symbol: "twc", name: "TIWI CAT", chain: "bsc" },
  { address: "0x06Dc293c250e2fB2416A4276d291803fc74fb9B5", symbol: "tkc", name: "The Kingdom Coin", chain: "bsc" },
  { address: "0x48a510A3394C2A07506d10910EBEFf3E25b7a3f1", symbol: "durt", name: "Dutch Rabbit", chain: "bsc" },
  { address: "0xf00cD9366A13e725AB6764EE6FC8Bd21dA22786e", symbol: "twd", name: "The Word Token", chain: "bsc" },
  { address: "0xbD7909318b9Ca4ff140B840F69bB310a785d1095", symbol: "gtan", name: "Giant Token", chain: "bsc" },
  { address: "0xCbEaaD74dcB3a4227D0E6e67302402E06c119271", symbol: "zedek", name: "Zedek Token", chain: "bsc" },
  { address: "0xD000815DB567372C3C3d7070bEF9fB7a9532F9e8", symbol: "bengcat", name: "Bengal Cat Token", chain: "bsc" },
  { address: "0x47a9B109Cfb8f89D16e8B34036150eE112572435", symbol: "bcat", name: "Billicat Token", chain: "bsc" },
  { address: "0x9F1f27179fB25F11e1F8113Be830cfF5926C4605", symbol: "nct", name: "New Cat Token", chain: "bsc" },
  { address: "0xb6623B503d269f415B9B5c60CDDa3Aa4fE34Fd22", symbol: "kitsune", name: "Kitsune Token", chain: "bsc" },
  { address: "0xe252FCb1Aa2E0876E9B5f3eD1e15B9b4d11A0b00", symbol: "crystalstones", name: "Crystal Stones", chain: "bsc" },
  { address: "0x4b87F578d6FaBf381f43bd2197fBB2A877da6ef8", symbol: "bft", name: "The Big Five Token", chain: "bsc" },
  { address: "0x72928a49c4E88F382b0b6fF3E561F56Dd75485F9", symbol: "cross", name: "Cross Token", chain: "bsc" },
  { address: "0x56083560594E314b5cDd1680eC6a493bb851BBd8", symbol: "thc", name: "Transhuman Coin", chain: "bsc" },
  { address: "0xfB69e2d3d673A8DB9Fa74ffc036A8Cf641255769", symbol: "bbft", name: "Baby BFT", chain: "bsc" },
  { address: "0x51363f073b1e4920fda7aa9e9d84ba97ede1560e", symbol: "bob", name: "Build On BNB", chain: "bsc" },
  { address: "0xAfF713b62e642b25898e24d5Be6561f863582144", symbol: "surv", name: "Survarium", chain: "bsc" },
  { address: "0xCAAE2A2F939F51d97CdFa9A86e79e3F085b799f3", symbol: "tut", name: "Tutorial Token", chain: "bsc" },
  { address: "0x14a8d0AC8Fc456899F2DD33C3f4E32403A78126c", symbol: "puffcat", name: "Puff Cat", chain: "bsc" },
  { address: "0xeb2B7d5691878627eff20492cA7c9a71228d931D", symbol: "crepe", name: "Crepe", chain: "bsc" },
  { address: "0xdc3d92dd5a468edb7a7772452700cc93bb1826ad", symbol: "popielno", name: "Popielno", chain: "bsc" },
  { address: "0x6C0D4adAc8fb85CC336C669C08b44f2e1d492575", symbol: "spray", name: "Spray", chain: "bsc" },
  { address: "0x170f044f9c7a41ff83caccad6ccca1b941d75af7", symbol: "mbc", name: "Mamba Basketball Coin", chain: "bsc" },
  { address: "0x6844b2e9afb002d188a072a3ef0fbb068650f214", symbol: "mars", name: "Mars Token", chain: "bsc" },
  { address: "0x8cDC41236C567511f84C12Da10805cF50Dcdc27b", symbol: "sdc", name: "Side Chick", chain: "bsc" },
  { address: "0x41f52A42091A6B2146561bF05b722Ad1d0e46f8b", symbol: "kind", name: "Kind Cat Token", chain: "bsc" },
  { address: "0x456B1049bA12f906326891486B2BA93e46Ae0369", symbol: "shibc", name: "AI Shib CEO", chain: "bsc" },
  { address: "0xFeD56F9Cd29F44e7C61c396DAc95cb3ed33d3546", symbol: "pcat", name: "Phenomenal Cat", chain: "bsc" },
  { address: "0x2056d14A4116A7165cfeb7D79dB760a06b57DBCa", symbol: "egw", name: "Eagles Wings", chain: "bsc" },
  { address: "0xCa7930478492CDe4Be997FA898Cd1a6AfB8F41A1", symbol: "1000pdf", name: "1000PDF", chain: "bsc" },
  { address: "0xe9E3CDB871D315fEE80aF4c9FcD4886782694856", symbol: "aidove", name: "AI Dove", chain: "bsc" },
  { address: "0x360f2cf415d9be6e82a7252681ac116fb63d2fa2", symbol: "hmt", name: "HMT Token", chain: "bsc" },
  { address: "0x14A2db256Ef18c4f7165d5E48f65a528b4155100", symbol: "rbcat", name: "RB Cat", chain: "bsc" },
  { address: "0x32Eb603F30ba75052f608CFcbAC45e39B5eF9beC", symbol: "bbcat", name: "Baby Billicat", chain: "bsc" },
  { address: "0x8489c022a10a8d2a65eb5aF2b0E4aE0191e7916D", symbol: "cct", name: "Cat Cake Token", chain: "bsc" },
  { address: "0x38Aec84f305564cB2625430A294382Cf33e3c317", symbol: "talent", name: "Talent Token", chain: "bsc" },
  { address: "0x71fd83d49fAaD4612E9d35876A75a97a5aDd4Bc2", symbol: "persiancat", name: "Persian Cat Token", chain: "bsc" },
  { address: "0xC54CA14328d5b61E4BDc8A4d4b08b6B8D06BC372", symbol: "peso", name: "Peso", chain: "bsc" },
];

// Create a mapping from symbol to address
const symbolToAddress = {};
TOKEN_REGISTRY.forEach(token => {
  symbolToAddress[token.symbol.toLowerCase()] = token.address.toLowerCase();
});

const logoDir = path.join(__dirname, '..', 'public', 'images', 'bsc', 'token-logos');

function renameLogoFiles() {
  
  if (!fs.existsSync(logoDir)) {
    console.error('❌ Logo directory not found:', logoDir);
    return;
  }

  const files = fs.readdirSync(logoDir);
  let renamedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  files.forEach(file => {
    // Skip non-image files and files that are already contract addresses
    if (file.startsWith('0x') || file.includes('.docx') || file === 'Untitled-1.png') {
    
      skippedCount++;
      return;
    }

    // Extract symbol from filename (remove extension)
    const fileExtension = path.extname(file);
    const symbol = path.basename(file, fileExtension).toLowerCase();
    
    // Find corresponding contract address
    const contractAddress = symbolToAddress[symbol];
    
    if (!contractAddress) {
      
      skippedCount++;
      return;
    }

    // Create new filename with contract address
    const oldPath = path.join(logoDir, file);
    const newFilename = `${contractAddress}${fileExtension}`;
    const newPath = path.join(logoDir, newFilename);

    try {
      // Check if target file already exists
      if (fs.existsSync(newPath)) {
        
        skippedCount++;
        return;
      }

      // Rename the file
      fs.renameSync(oldPath, newPath);
      
      renamedCount++;
    } catch (error) {
      console.error(`❌ Error renaming ${file}:`, error.message);
      errorCount++;
    }
  });

  // console.log('\n📊 Renaming Summary:');
  // console.log(`✅ Successfully renamed: ${renamedCount} files`);
  // console.log(`⏭️  Skipped: ${skippedCount} files`);
  // console.log(`❌ Errors: ${errorCount} files`);
  // console.log('\n🎉 Logo file renaming process completed!');
}

// Run the renaming process
renameLogoFiles();
