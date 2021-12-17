require('dotenv').config()
const moment = require('moment')
const { Pool, Client } = require("pg");

const filelog = require('./log').filelog;

const xrpl = require("xrpl");

const PG_URL = process.env.DB_URL;
const PG_USERNAME = process.env.DB_USERNAME;
const PG_PASSWORD = process.env.DB_PASSWORD;
const PG_PORT = process.env.DB_PORT;
const PG_DBNAME = process.env.DB_NAME;


const credentials = {
    user: PG_USERNAME,
    host: PG_URL,
    database: PG_DBNAME,
    password: PG_PASSWORD,
    port: PG_PORT,
    ssl: { rejectUnauthorized: false }
};

async function run(){

    try {        
    
        const client = new Client(credentials);
        await client.connect()

        let rewardLatest = await client.query("SELECT * FROM rewards ORDER BY id DESC LIMIT 1");
        rewardLatest = rewardLatest.rows[0];
        console.log((rewardLatest));

        const  awardList = await client.query(`SELECT * FROM reward_transactions WHERE reward_id = ${rewardLatest['id']} and reward_xrp IS NOT NULL and xrp_source_address IS NOT NULL and xrp_destination_tag IS NOT NULL; `);
    
        const seed = process.env.SENDER_SEED;
        const remoteURL = process.env.REMOTE_URL;
        if (seed && remoteURL) {    
            
            const senderWallet =    xrpl.Wallet.fromSeed(seed);
            
            const XRPclient = new xrpl.Client(remoteURL);
            await XRPclient.connect();

            if (awardList.rows.length > 0) {
                for (let i=0; i< awardList.rows.length; i ++) {
                    //filelog.info(`XRP transaction: ${JSON.stringify(awardList.rows[i])}`);
                    let log = [];
                    // Prepare transaction -------------------------------------------------------
                    try {
                        
                        const prepared = await XRPclient.autofill({
                            "TransactionType": "Payment",
                            "Account": senderWallet.address,
                            "Amount": xrpl.xrpToDrops(Number(awardList.rows[i].reward_xrp)),
                            "Destination": awardList.rows[i].xrp_destination_address,
                            "DestinationTag": Number( awardList.rows[i].xrp_destination_tag)
                        })
                        const max_ledger = prepared.LastLedgerSequence
                        log.push(`Start xrp transfer`);                
                        log.push("Datetime : " + moment().format());                        
                        log.push("Transaction cost:", xrpl.dropsToXrp(prepared.Fee), "XRP")
                        log.push("Transaction expires after ledger:", max_ledger)
                        log.push("Sender X Address : " + senderWallet.address);    
                        log.push("Send Amount (XRP) : " + Number(awardList.rows[i].reward_xrp));  
                        log.push("Receiver X Address : " + awardList.rows[i].xrp_destination_address);
                        console.log(log);
                        // Sign prepared instructions ------------------------------------------------
                        const signed = senderWallet.sign(prepared)
                        log.push("Identifying hash:", signed.hash)                
                        log.push("Signed blob:", signed.tx_blob)                                                
                        // Submit signed blob --------------------------------------------------------
                        const tx = await XRPclient.submitAndWait(signed.tx_blob)
                        // Check transaction results -------------------------------------------------
                        log.push("Transaction result:", tx.result.meta.TransactionResult)
                        log.push("Balance changes:", JSON.stringify(xrpl.getBalanceChanges(tx.result.meta), null, 2))
                        log.push(`End xrp transfer`);
                        console.log("Transaction result:", tx.result.meta.TransactionResult)
                        filelog.info(log);
                    } catch (error) {
                        console.log("err", error)
                    }
                    
                }
            }
            // Disconnect when done (If you omit this, Node.js won't end the process)
            XRPclient.disconnect()
        }

        await client.end()

        console.log('All transaction completed !');
        
    } catch (error) { 
        console.log("err", error)               
    }  
}

run();