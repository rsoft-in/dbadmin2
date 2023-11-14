const { app, BrowserWindow, ipcMain } = require('electron');
const { dialog } = require('electron');
const fs = require('fs-extra');
const { versionMdbTools, version, tables, sqlAsString, sql } = require('@el3um4s/mdbtools');
const mysql = require('mysql2');
const { DBFFile } = require('dbffile');
const os = require('node:os');
const path = require('path');

const seperator = os.platform() == 'win32' ? "\\" : "/";

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
        },
    })

    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('minimize-app', () => {
    var window = BrowserWindow.getFocusedWindow();
    window.minimize();
})

ipcMain.on('exit-app', () => {
    app.quit()
})

ipcMain.on('file-dialog', (event, args) => {
    let type = args['type'];
    console.log(type);
    let extensions = ['*'];
    if (type == 'vfp') {
        extensions = ['dbf'];
    }
    if (type == 'accdb') {
        extensions = ['mdb', 'accdb'];
    }
    dialog.showOpenDialog(BrowserWindow, {
        properties: ['openFile', 'openDirectory'],
    }).then(result => {
        if (!result.canceled) {
            let file_path = result.filePaths[0];
            if (type == 'vfp') {
                let afile = result.filePaths[0].split(seperator);
                console.log(afile);
                file_path = afile.slice(0, afile.length - 1).join(seperator);
            }
            event.reply('file-dialog', file_path)
        }
    }).catch(err => {
        console.log(err)
    })
});

ipcMain.on('connect-db', async (event, args) => {
    var filePath = args['sourcedb'];
    var dbType = args['sourcetype'];

    // MySQL Connection
    const connection = mysql.createConnection({
        host: args['server'],
        user: args['user'],
        password: args['pwd'],
        database: args['destdb']
    });

    // Read mapping file
    if (dbType == 'accdb') {
        const windowPath = (os.platform() == 'win32') ? path.join(__dirname, '..', 'mdbtools-win') : null;
        const v = await version({ database: filePath, windowsPath: windowPath });
        const today = new Date();
        const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        try {
            let rawData = fs.readFileSync(`res${seperator}accdb.json`);
            let dbMap = JSON.parse(rawData);
            for (let i = 0; i < dbMap.length; i++) {
                let rowsIns = 0;
                let rowsFailed = 0;
                const db = dbMap[i];
                if (!db['enable']) continue;
                if (db['clear']) {
                    let resClear = await clearDB(connection, db['dest_tb']);
                }
                let sourceFields = db['source_flds'].split(',');
                let sourceFunc = db['source_func'].split(',');
                let qry = `SELECT ${db['source_flds']} FROM ${db['source_tb']}`;
                if (db['source_qry'] != '') {
                    qry = db['source_qry'];
                }
                const list = await sql(
                    {
                        database: filePath,
                        windowsPath: windowPath,
                        sql: qry
                    }
                );
                for (let i = 0; i < list.length; i++) {
                    let data = [];
                    const item = list[i];
                    for (let j = 0; j < sourceFields.length; j++) {
                        let _val = item[sourceFields[j]];
                        if (sourceFunc[j] != "") {
                            let _afun = sourceFunc[j].split(';');
                            if (_afun[0] == 'padl') {
                                _val = (_val).padStart(parseInt(_afun[2]), _afun[1]);
                            }
                            if (_afun[0] == 'def') {
                                _val = _afun[1];
                            }
                        }
                        if (os.platform() == 'win32') {
                            data.push(_val);
                        } else {
                            data.push(decodeURIComponent(escape(_val)));
                        }
                    }
                    let query = '';
                    let qryResult = '';
                    if (db['source_tb'] == 'Abrechnung') {
                        let data = [];
                        let tourVonDatum = item['AuswJahr'] + '-' + item['AuswMonat'].padStart(2, '0') + '-' + '01';
                        let previousDate = new Date(tourVonDatum);
                        previousDate = new Date(previousDate.setMonth(previousDate.getMonth() + 1));
                        previousDate = new Date(previousDate.setDate(previousDate.getDate() - 1));

                        let tourBisDatum = previousDate.getFullYear() + '-' + String(previousDate.getMonth() + 1).padStart(2, '0') + '-' + String(previousDate.getDate()).padStart(2, '0');
                        let refDate = (parseInt(item['AuswMonat']) == 12 ? String(parseInt(item['AuswJahr']) + 1) : item['AuswJahr']) + '-' + String(parseInt(item['AuswMonat']) == 12 ? 1 : parseInt(item['AuswMonat']) + 1).padStart(2, '0') + '-' + '01';
                        data = [item['AuswJahr'] + String(item['AuswMonat']).padStart(2, '0') + `${item['PersNr']}`.padStart(7, '0'),
                            refDate,
                            tourVonDatum,
                            tourBisDatum,
                        Math.floor(item['MilchMengeA'] * 100) / 100,
                        Math.floor(item['MilchKg'] * 100) / 100,
                        item['Auszahlung'],
                            date, (`${i}`).padStart(6, '0'), ''];
                        query = `INSERT INTO abrechnung (refnr,refdate,tourdtvon,tourdtbis,mengeltr,mengekg,gu_auszahl,modified,transid, dta_nr) VALUES(?,?,?,?,?,?,?,?,?,?)`;
                        qryResult = await runQuery(connection, query, data);
                        if (qryResult.indexOf('SUCCESS') < 0) {
                            event.reply('connect-db', `ERROR: ${qryResult}`);
                        }
                    } else {
                        let paramPlaceholder = (("?,").repeat(sourceFields.length)).substring(0, (sourceFields.length * 2) - 1);
                        query = `INSERT INTO ${db['dest_tb']} (${db['dest_flds']}) VALUES(${paramPlaceholder})`;
                        qryResult = await runQuery(connection, query, data)
                    }
                    if ((`${qryResult}`).indexOf('SUCCESS') >= 0) {
                        rowsIns++;
                    } else {
                        event.reply('connect-db', `ERROR: ${qryResult}`);
                        rowsFailed++;
                    }
                }
                if (db['source_tb'] == 'Abrechnung') {
                    let updQry = await runQuery(connection, "UPDATE abrechnung JOIN transponder ON transponder.kundennr = SUBSTRING(abrechnung.refnr, 7) SET abrechnung.transid = transponder.transid")
                    if (updQry.indexOf('SUCCESS') < 0) {
                        event.reply('connect-db', `ERROR: ${updQry}`);
                    }
                }
                let resp = `{"source": "${db['source_tb']}", "dest": "${db['dest_tb']}", "msg": "${list.length} Records, ${rowsIns} added, ${rowsFailed} failed."}`;
                event.reply('connect-db', resp);
                // console.log("Total records " + list.length);
            }
        } catch (error) {
            event.reply('connect-db', `ERROR: ${error}`);
        }
    } else if (dbType == 'vfp') {
        try {
            let rawData = fs.readFileSync(`res${seperator}vfp.json`);
            let dbMap = JSON.parse(rawData);
            let files = fs.readdirSync(filePath);
            for (let i = 0; i < dbMap.length; i++) {
                const db = dbMap[i];
                let srcFile = files.find((f) => f.toLowerCase() == db['source_tb'].toLowerCase());
                console.log(`source: ${srcFile}`);
                if (srcFile.length > 0) {
                    let dbf = await DBFFile.open(`${filePath}${seperator}${srcFile}`);
                    let rows = await dbf.readRecords(10);

                    if (db['source_join'] != '') {
                        let dbf2 = await DBFFile.open(`${filePath}${seperator}${db['source_join']}`);
                        let rows2 = await dbf2.readRecords();
                        let condition = db['join_on'].split('=');
                        // rows contains t_adressen data
                        // rows2 contains t_orte data
                        for (let i = 0; i < rows.length; i++) {
                            for (let j = 0; j < rows2.length; j++) {
                                if (rows[i][condition[0]] == rows2[j][condition[1]]) {
                                    let a_join = db['join_flds'];
                                    for (let x = 0; x < a_join.length; x++) {
                                        rows[i][a_join[x]['sfld']] = rows2[j][a_join[x]['tfld']];
                                    }
                                }
                            }
                        }

                        // console.log(rows);
                    }
                    for (let j = 0; j < rows.length; j++) {
                        const record = rows[j];
                        // console.log(record);
                        const tableName = db['dest_tb'];



                        // Construct the INSERT query
                        // const columns = Object.keys(record).join(', ');




                        const columns = db['dest_flds'];
                        // const values = Object.values(record).map((val) => connection.escape(val)).join(', ');
                        let values = [];
                        let sflds = db['source_flds'].split(',');



                        for (let y = 0; y < sflds.length; y++) {
                            const sourceField = sflds[y].toUpperCase();
                            let value = record[sourceField];

                            if (value != null) {
                                if ((`${value}`).indexOf(':') > 0) {
                                    const date = new Date(value);
                                    if (!isNaN(date)) {
                                        value = date.toISOString().slice(0, 19).replace('T', ' ');
                                    }
                                }
                            }

                            values.push(value);
                        }
                        const insertQuery = `INSERT INTO ${tableName} (${columns}) VALUES ('${values.join("', '")}')`;
                        console.log(insertQuery);

                        // Execute the INSERT query
                        connection.query(insertQuery, (error, results) => {
                            if (error) {
                                event.reply('connect-db', `ERROR: Failed to insert record: ${error.message}`);
                            } else {
                                console.log(`Inserted record into ${tableName}: ${JSON.stringify(record)}`);
                            }
                        }
                        );
                    }
                    let resp = `{"source": "${srcFile}", "dest": "${db['dest_tb']}", "records": "${dbf.recordCount}"}`;
                    event.reply('connect-db', resp);
                }
            }
        } catch (error) {
            event.reply('connect-db', `ERROR: ${error}`);
        }
    }

    async function clearDB(connection, tableName) {
        return new Promise((resolve, reject) => {
            try {
                connection.query(`DELETE FROM ${tableName}`, (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve('SUCCESS');
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    async function runQuery(connection, query, data) {
        return new Promise((resolve, reject) => {
            try {
                connection.query(query, data, (err, res) => {
                    if (err) {
                        resolve(err);
                    } else {
                        resolve('SUCCESS');
                    }
                });
            } catch (error) {
                resolve(error);
            }
        });
    }
})