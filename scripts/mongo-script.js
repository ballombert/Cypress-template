const MongoClient = require('mongodb').MongoClient;
const yargs = require('yargs');
var fs = require('fs');
var path = require('path');
var bson = require('bson');
const { Signale } = require('signale');
const { ok } = require('assert');

const mongoCollectionsName = [
    'AuthorizedChargers',
    'Capabilities',
    'ChargersTransactions',
    'ChargingProfiles',
    'Configurations',
    'DefaultConfigurations',
    'Firmwares',
    'FirmwareUpdates',
    'MonitoringData',
    'Networks',
    'ParameterMapping',
    'PriceModels',
    'RoutesAuth'
];

const options = {
    disabled: false,
    interactive: false,
    logLevel: 'info',
    scope: '',
    secrets: [],
    stream: process.stdout,
    types: {
        remind: {
            badge: '**',
            color: 'yellow',
            label: 'reminder',
            logLevel: 'info'
        },
        database: {
            badge: '🗃️',
            color: 'yellow',
            label: '',
            logLevel: 'info'
        },
        collection: {
            badge: '\t🗂️',
            color: 'yellow',
            label: '',
            logLevel: 'info'
        }
    }
};
const signale = new Signale(options);

async function list(args) {
    const client = new MongoClient(args.url);
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        signale.success('Connection on mongo db successful');
        // Make the appropriate DB calls
        await listDatabases(client);
        //await deleteDatabase(client, "Test")
        //await sleep(1000);
    } catch (e) {
        signale.fatal(e);
    } finally {
        await client.close();
        signale.success('Connection close successfully');
    }
}

async function initialize(args) {
    signale.info("Mongo URL:" + args.url);
    const client = new MongoClient(args.url);
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        signale.success('Connection on mongo db successful');
        // Make the appropriate DB calls
        await cleanDatabase(client, args.databaseName)
        for (const directoryPath of args.directoryPath) {
            await initDataSet(client, args.databaseName, directoryPath)
        }
        //await sleep(1000);
    } catch (e) {
        signale.fatal(e);
    } finally {
        await client.close();
        signale.success('Connection close successfully');
    }
}

async function cleanDatabase(client, databaseName) {

    var db = await client.db(databaseName);
    const query = {};

    for await (const collectioName of mongoCollectionsName) {
        signale.info('Delete all documents in collection: ' + collectioName + ' on database ' + databaseName);
        var collection = db.collection(collectioName);
        
        for await (const doc of db.collection(collectioName).find(query)) {
            signale.info('Delete document: ' + doc._id + ' in collection ' + collectioName );
            // retry 5 times to delete the document
            let nbretry = 0;                    
            let result = null;
            do {
                try {
                    result = await collection.deleteOne({ _id: doc._id });                    
                }
                catch (error) {
                    nbretry++;
                    if(nbretry=5)
                        signale.fatal(error);                    
                    await sleep(500);
                }
            } while ( (result == null || result.deletedCount <1) && nbretry < 5);        
        }        
    }
}

async function listDatabases(client) {
    var databasesList = await client.db().admin().listDatabases();
    signale.info("List of database :")
    for (const db of databasesList.databases) {
        signale.database(`${db.name}`);
        var listcollection = await client.db(db.name).listCollections().toArray();
        //signale.collection(listcollection);
        for (const col of listcollection) {
            signale.collection(`${col.name}`);
        }
    };
};

async function initDataSet(client, databaseName, directoryPath) {
    var db = client.db(databaseName);
    signale.info("Insert dataset from " + directoryPath);
    await InsertRecursive(db, directoryPath);
}

async function InsertRecursive(db, directoryPath) {
    var dirFiles = fs.readdirSync(directoryPath);
    for (const dirOrFile of dirFiles) {
        // Check file type
        var currentPath = path.join(directoryPath, dirOrFile);
        if (fs.statSync(currentPath).isDirectory()) {
            await InsertRecursive(db, currentPath);
        } else {
            if (dirOrFile.endsWith('.json')) {
                signale.info("Read file " + currentPath);
                var data = fs.readFileSync(currentPath);
                try {                    
                    var jsonDoc = convertDataToBinary(data);
                    var collectionName = dirOrFile.split('.');
                    signale.info("Insert into " + collectionName[0] + "\n" + data);
                    do {
                        try {
                            result = await db.collection(collectionName[0]).insertMany(bson.EJSON.parse(jsonDoc));
                            break;                                                        
                        }
                        catch (error) {
                            nbretry++;
                            if(nbretry=5)
                                signale.fatal(error);                    
                            await sleep(1000);
                        }
                    } while ( nbretry < 5);                            
                } catch (error) {
                    signale.fatal("**ERROR WHEN TRY PARSING **:" + dirOrFile);
                    signale.fatal(error);
                }
            }
        }
    };
}

function convertDataToBinary(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


const argv = yargs
    .scriptName("mongo-script")
    .usage('$0 <cmd> [args]')
    .option("u", {
        alias: "url",
        describe: "The mongodb url",
        type: "string",
        demandOption: true,
        global: true
    })
    .command({
        command: 'List',
        alias: ['List'],
        describe: 'list the mongo database and collection.',
        handler: (argv) => {
            list(argv);
        }
    })
    .command({
        command: 'Init',
        alias: ['Init'],
        builder: (yargs) => yargs
            .option('db', {
                description: 'Database Name',
                alias: 'databaseName',
                default: 'Residential',
                type: 'string'
            })
            .option('path', {
                description: 'dataset directory path',
                alias: 'directoryPath',
                type: 'array'
            }),

        handler: (argsv) => {
            initialize(argsv);
        }
    })
    .help()
    .alias('help', 'h').argv;