// Import required packages
const web3 = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const axios = require('axios');
const winston = require('winston');
require('dotenv').config();

// Set up logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bot.log' })
    ]
});

// Set up the connection to Solana's network
const connection = new web3.Connection(web3.clusterApiUrl('devnet')); // Use 'mainnet-beta' for live trading

// Load wallet keys from environment variables
const tradingWalletSecretKey = process.env.TRADING_WALLET_SECRET_KEY;
const tradingWallet = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(tradingWalletSecretKey)));

const withdrawalWalletSecretKey = process.env.WITHDRAWAL_WALLET_SECRET_KEY;
const withdrawalWallet = web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(withdrawalWalletSecretKey)));

// Raydium's program ID and token address (placeholders)
const raydiumProgramId = new web3.PublicKey('RaydiumProgramIDHere');
const tokenToTrade = new web3.PublicKey('TokenAddressHere');

// Function to check wallet balance
async function checkBalance(wallet) {
    try {
        const balance = await connection.getBalance(wallet.publicKey);
        logger.info(`Balance for ${wallet.publicKey.toBase58()}: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
        return balance / web3.LAMPORTS_PER_SOL;
    } catch (error) {
        logger.error('Error checking balance:', error);
        throw error;
    }
}

// Function to fetch current token price
async function fetchCurrentPrice() {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        return response.data.solana.usd; // Assuming the token being traded is SOL
    } catch (error) {
        logger.error('Error fetching price:', error);
        throw error;
    }
}

// Function to transfer excess funds to withdrawal wallet
async function transferExcessFunds() {
    try {
        const tradingBalance = await checkBalance(tradingWallet);
        const excessAmount = tradingBalance - 500; // Keep $500 in trading wallet

        if (excessAmount > 0) {
            const lamports = excessAmount * web3.LAMPORTS_PER_SOL;
            const transaction = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: tradingWallet.publicKey,
                    toPubkey: withdrawalWallet.publicKey,
                    lamports: lamports
                })
            );

            transaction.sign(tradingWallet);
            const signature = await web3.sendAndConfirmTransaction(connection, transaction, [tradingWallet]);
            logger.info(`Transferred ${excessAmount} SOL to withdrawal wallet. Transaction: ${signature}`);
        } else {
            logger.info('No excess funds to transfer.');
        }
    } catch (error) {
        logger.error('Error transferring excess funds:', error);
    }
}

// Basic trading logic
function simpleTradeLogic(currentPrice, lastKnownPrice) {
    if (currentPrice > lastKnownPrice * 1.05) {
        return "buy";
    } else if (currentPrice < lastKnownPrice * 0.97) {
        return "sell";
    } else {
        return "hold";
    }
}

// Simulate trade execution
async function executeTrade(action, amount) {
    try {
        if (action === "buy") {
            logger.info(`Buying ${amount} tokens of ${tokenToTrade.toBase58()}`);
            // Add Raydium buy transaction logic here
        } else if (action === "sell") {
            logger.info(`Selling ${amount} tokens of ${tokenToTrade.toBase58()}`);
            // Add Raydium sell transaction logic here
        } else {
            logger.info("Holding position.");
        }
    } catch (error) {
        logger.error(`Error executing trade (${action}):`, error);
    }
}

// Main trading loop
async function tradingLoop() {
    let lastKnownPrice = await fetchCurrentPrice();
    logger.info(`Starting trading loop with initial price: $${lastKnownPrice}`);

    while (true) {
        try {
            const currentPrice = await fetchCurrentPrice();
            logger.info(`Current price: $${currentPrice}`);

            const action = simpleTradeLogic(currentPrice, lastKnownPrice);
            logger.info(`Trade action: ${action}`);

            if (action !== "hold") {
                const amountToTrade = 1; // Example trade amount
                await executeTrade(action, amountToTrade);
                lastKnownPrice = currentPrice;
            }

            await transferExcessFunds();
        } catch (error) {
            logger.error('Error in trading loop:', error);
        }

        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
    }
}

// Start the bot
(async () => {
    try {
        const balance = await checkBalance(tradingWallet);
        if (balance > 0) {
            logger.info('Starting the trading bot...');
            await tradingLoop();
        } else {
            logger.error('Insufficient funds in the trading wallet.');
        }
    } catch (error) {
        logger.error('Error starting trading bot:', error);
    }
})();
