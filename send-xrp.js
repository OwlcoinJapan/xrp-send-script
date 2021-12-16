require('dotenv').config()
const moment = require('moment')
const program = require('commander')

const xrpl = require("xrpl");

program.on('--help', function(){
  console.log('')
  console.log('Examples:')
  console.log('  node send-xrp.js -d rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh -t 105267367 -a 0.000001')
})
program
  .version('1.0.0')
  .option('-d, --destination <destination>', 'Destination xrp address', /^r[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{24,34}$/, false)  
  .option('-t, --tag [tag]', 'Destination tag', /^[0-9]{1,10}$/, null)
  .option('-a, --amount <amount>', 'Send amount. 1 = 1 XRP.', parseFloat, false)

program.parse(process.argv);
if(program.destination === false) program.help();
if(program.tag === false) program.help();
if(program.amount === false) program.help();

const receiverClassicAddress = program.destination;
const tag = program.tag;
const amount = program.amount;

async function send(){
  const senderWallet =    xrpl.Wallet.fromSeed(process.env.SENDER_SEED);
  const remoteURL = process.env.REMOTE_URL;
 
  const client = new xrpl.Client(remoteURL);
  await client.connect();
  // Prepare transaction -------------------------------------------------------
  const prepared = await client.autofill({
    "TransactionType": "Payment",
    "Account": senderWallet.address,
    "Amount": xrpl.xrpToDrops(amount),
    "Destination": receiverClassicAddress,
    "DestinationTag": Number(tag)
  })
  const max_ledger = prepared.LastLedgerSequence
  console.log("Datetime : " + moment().format());
  console.log("Prepared transaction instructions:", prepared)
  console.log("Transaction cost:", xrpl.dropsToXrp(prepared.Fee), "XRP")
  console.log("Transaction expires after ledger:", max_ledger)
  console.log("Sender X Address : " + senderWallet.address);    
  console.log("Send Amount (XRP) : " + amount);  
  console.log("Receiver X Address : " + receiverClassicAddress);
  
  // Sign prepared instructions ------------------------------------------------
  const signed = senderWallet.sign(prepared)
  console.log("Identifying hash:", signed.hash)
  console.log("Signed blob:", signed.tx_blob)
  // Submit signed blob --------------------------------------------------------
  const tx = await client.submitAndWait(signed.tx_blob)
  // Check transaction results -------------------------------------------------
  console.log("Transaction result:", tx.result.meta.TransactionResult)
  console.log("Balance changes:", JSON.stringify(xrpl.getBalanceChanges(tx.result.meta), null, 2))
  // Disconnect when done (If you omit this, Node.js won't end the process)
  client.disconnect()

}
send();
