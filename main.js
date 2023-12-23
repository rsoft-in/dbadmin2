const { app, BrowserWindow, ipcMain } = require('electron');
const { dialog } = require('electron');
const fs = require('fs-extra');
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
        // const windowPath = (os.platform() == 'win32') ? path.join(__dirname, '..', 'mdbtools-win') : null;
        // const v = await version({ database: filePath, windowsPath: windowPath });
        // const today = new Date();
        // const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        // try {
        //     let rawData = fs.readFileSync(`res${seperator}accdb.json`);
        //     let dbMap = JSON.parse(rawData);
        //     for (let i = 0; i < dbMap.length; i++) {
        //         let rowsIns = 0;
        //         let rowsFailed = 0;
        //         const db = dbMap[i];
        //         if (!db['enable']) continue;
        //         if (db['clear']) {
        //             let resClear = await clearDB(connection, db['dest_tb']);
        //         }
        //         let sourceFields = db['source_flds'].split(',');
        //         let sourceFunc = db['source_func'].split(',');
        //         let qry = `SELECT ${db['source_flds']} FROM ${db['source_tb']}`;
        //         if (db['source_qry'] != '') {
        //             qry = db['source_qry'];
        //         }
        //         const list = await sql(
        //             {
        //                 database: filePath,
        //                 windowsPath: windowPath,
        //                 sql: qry
        //             }
        //         );
        //         for (let i = 0; i < list.length; i++) {
        //             let data = [];
        //             const item = list[i];
        //             for (let j = 0; j < sourceFields.length; j++) {
        //                 let _val = item[sourceFields[j]];
        //                 if (sourceFunc[j] != "") {
        //                     let _afun = sourceFunc[j].split(';');
        //                     if (_afun[0] == 'padl') {
        //                         _val = (_val).padStart(parseInt(_afun[2]), _afun[1]);
        //                     }
        //                     if (_afun[0] == 'def') {
        //                         _val = _afun[1];
        //                     }
        //                 }
        //                 if (os.platform() == 'win32') {
        //                     data.push(_val);
        //                 } else {
        //                     data.push(decodeURIComponent(escape(_val)));
        //                 }
        //             }
        //             let query = '';
        //             let qryResult = '';
        //             if (db['source_tb'] == 'Abrechnung') {
        //                 let data = [];
        //                 let tourVonDatum = item['AuswJahr'] + '-' + item['AuswMonat'].padStart(2, '0') + '-' + '01';
        //                 let previousDate = new Date(tourVonDatum);
        //                 previousDate = new Date(previousDate.setMonth(previousDate.getMonth() + 1));
        //                 previousDate = new Date(previousDate.setDate(previousDate.getDate() - 1));

        //                 let tourBisDatum = previousDate.getFullYear() + '-' + String(previousDate.getMonth() + 1).padStart(2, '0') + '-' + String(previousDate.getDate()).padStart(2, '0');
        //                 let refDate = (parseInt(item['AuswMonat']) == 12 ? String(parseInt(item['AuswJahr']) + 1) : item['AuswJahr']) + '-' + String(parseInt(item['AuswMonat']) == 12 ? 1 : parseInt(item['AuswMonat']) + 1).padStart(2, '0') + '-' + '01';
        //                 data = [item['AuswJahr'] + String(item['AuswMonat']).padStart(2, '0') + `${item['PersNr']}`.padStart(7, '0'),
        //                     refDate,
        //                     tourVonDatum,
        //                     tourBisDatum,
        //                 Math.floor(item['MilchMengeA'] * 100) / 100,
        //                 Math.floor(item['MilchKg'] * 100) / 100,
        //                 item['Auszahlung'],
        //                     date, (`${i}`).padStart(6, '0'), ''];
        //                 query = `INSERT INTO abrechnung (refnr,refdate,tourdtvon,tourdtbis,mengeltr,mengekg,gu_auszahl,modified,transid, dta_nr) VALUES(?,?,?,?,?,?,?,?,?,?)`;
        //                 qryResult = await runQuery(connection, query, data);
        //                 if (qryResult.indexOf('SUCCESS') < 0) {
        //                     event.reply('connect-db', `ERROR: ${qryResult}`);
        //                 }
        //             } else {
        //                 let paramPlaceholder = (("?,").repeat(sourceFields.length)).substring(0, (sourceFields.length * 2) - 1);
        //                 query = `INSERT INTO ${db['dest_tb']} (${db['dest_flds']}) VALUES(${paramPlaceholder})`;
        //                 qryResult = await runQuery(connection, query, data)
        //             }
        //             if ((`${qryResult}`).indexOf('SUCCESS') >= 0) {
        //                 rowsIns++;
        //             } else {
        //                 event.reply('connect-db', `ERROR: ${qryResult}`);
        //                 rowsFailed++;
        //             }
        //         }
        //         if (db['source_tb'] == 'Abrechnung') {
        //             let updQry = await runQuery(connection, "UPDATE abrechnung JOIN transponder ON transponder.kundennr = SUBSTRING(abrechnung.refnr, 7) SET abrechnung.transid = transponder.transid")
        //             if (updQry.indexOf('SUCCESS') < 0) {
        //                 event.reply('connect-db', `ERROR: ${updQry}`);
        //             }
        //         }
        //         let resp = `{"source": "${db['source_tb']}", "dest": "${db['dest_tb']}", "msg": "${list.length} Records, ${rowsIns} added, ${rowsFailed} failed."}`;
        //         event.reply('connect-db', resp);
        //         // console.log("Total records " + list.length);
        //     }
        // } catch (error) {
        //     event.reply('connect-db', `ERROR: ${error}`);
        // }
    } else if (dbType == 'vfp') {
        try {
            let rawData = fs.readFileSync(`res${seperator}vfp.json`);
            let dbMap = JSON.parse(rawData);
            let files = fs.readdirSync(filePath);
            for (let i = 0; i < dbMap.length; i++) {
                const db = dbMap[i];
                let rowsIns = 0;
                let rowsFailed = 0;
                let srcFile = files.find((f) => f.toLowerCase() == db['source_tb'].toLowerCase());
                if (srcFile.length > 0 && db['enabled']) {
                    if (db['clear']) {
                        let resClear = await clearDB(connection, db['dest_tb']);
                    }
                    let dbf = await DBFFile.open(`${filePath}${seperator}${srcFile}`);
                    let rows = await dbf.readRecords();
                    for (let j = 0; j < rows.length; j++) {
                        const record = rows[j];
                        let values = [];
                        let sflds = db['source_flds'].split(',');
                        for (let y = 0; y < sflds.length; y++) {
                            const sourceField = sflds[y].toUpperCase();
                            let value = '';
                            if (sourceField == 'DEF_DATE') {
                                value = new Date();
                            } else if (sourceField == 'DEF_STRING') {
                                value = "DEFAULT";
                            } else if (sourceField == 'DEF_EMPTY') {
                                value = "";
                            } else if (sourceField == 'DEF_USER') {
                                value = "super-admin";
                            } else {
                                value = record[sourceField];
                            }
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
                        let paramPlaceholder = (("?,").repeat(sflds.length)).substring(0, (sflds.length * 2) - 1);
                        let query = `INSERT INTO ${db['dest_tb']} (${db['dest_flds']}) VALUES(${paramPlaceholder})`;
                        qryResult = await runQuery(connection, query, values)
                        if ((`${qryResult}`).indexOf('SUCCESS') >= 0) {
                            rowsIns++;
                        } else {
                            event.reply('connect-db', `ERROR: ${qryResult}`);
                            rowsFailed++;
                        }
                        event.reply('connect-db', `{ \"progress\": "${parseInt(((rowsIns + rowsFailed) * 100) / (rows.length))}" }`);
                    }
                    if (db['dest_tb'] == "adressen") {
                        let updResult = await runQuery(connection, "UPDATE adressen JOIN codes ON codes.cod_code = adressen.adr_anred AND codes.cod_art = 'ANR' SET adressen.adr_anred = codes.cod_bez");
                        let updResult2 = await runQuery(connection, "UPDATE adressen JOIN orte ON orte.ort_ord_nr = adressen.adr_ord_nr SET adressen.adr_plz = orte.ort_plz, adressen.adr_ort = orte.ort_ort");
                    }
                    if (db['dest_tb'] == "product") {
                        let updResult3 = await runQuery(connection, "UPDATE product JOIN codes ON codes.cod_code = product.productid AND codes.cod_art = 'MilchSorte' SET product.productname = codes.cod_bez");
                    }

                    let resp = `{"source": "${srcFile}", "dest": "${db['dest_tb']}", "msg": "${rows.length} Records, ${rowsIns} added, ${rowsFailed} failed."}`;
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