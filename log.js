/**
 * Configurations of logger.
 */
const winston = require('winston');
require('winston-daily-rotate-file');
 
const option =  {
   'name': 'log-file',
   'level': 'info',
   'filename': './logs/%DATE%-transaction.log',
   'json': true,
   'datePattern': 'Y-M-d',
   'prepend': true,
   'colorize': true,
};
 

const FileLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'transaction-xrp' },
  transports: [ 
    new (winston.transports.DailyRotateFile)(option)    
  ],
});

 
module.exports = {
    'filelog': FileLogger,     
};