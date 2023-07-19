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
    // const connection = mysql.createConnection({
    //     host: args['server'],
    //     user: args['user'],
    //     password: args['pwd'],
    //     database: args['destdb']
    // });
    // console.log(connection);

    // Read mapping file
    if (dbType == 'accdb') {
        const v = await version({ database: filePath });
        // console.log(v);
        try {
            let rawData = fs.readFileSync(`res${seperator}kv.json`);
            let dbMap = JSON.parse(rawData);
            for (let i = 0; i < dbMap.length; i++) {
                const db = dbMap[i];
                let qry = `Select * from ${db['source_tb']}`;
                const list = await sql(
                    {
                        database: filePath,
                        sql: qry
                    }
                );
                let resp = `{"source": "${db['source_tb']}", "dest": "${db['dest_tb']}", "records": "${list.length}"}`;
                event.reply('connect-db', resp);
            }
        } catch (error) {
            event.reply('connect-db', `ERROR: ${error}`);
        }
    }

    if (dbType == 'vfp') {
        try {
            let rawData = fs.readFileSync(`res${seperator}md.json`);
            let dbMap = JSON.parse(rawData);
            let files = fs.readdirSync(filePath);
            for (let i = 0; i < dbMap.length; i++) {
                const db = dbMap[i];
                let srcFile = files.find((f) => f.toLowerCase() == db['source_tb'].toLowerCase());
                console.log(`source: ${srcFile}`);
                if (srcFile.length > 0) {
                    let dbf = await DBFFile.open(`${filePath}${seperator}${srcFile}`);
                    let resp = `{"source": "${srcFile}", "dest": "${db['dest_tb']}", "records": "${dbf.recordCount}"}`;
                    event.reply('connect-db', resp);
                }
            }
        } catch (error) {
            event.reply('connect-db', `ERROR: ${error}`);
        }
    }

})