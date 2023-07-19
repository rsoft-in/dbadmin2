const ipcRenderer = require('electron').ipcRenderer;

const minimizeButton = document.getElementById('minimize');
const exitButton = document.getElementById('exit');
const connectButton = document.getElementById('connect');
const accessDbInput = document.getElementById('source-db');
const selectButton = document.getElementById('select-file');
const summaryText = document.getElementById('summary-text');

const sourceType = document.getElementById('source-type');
const sourceDb = document.getElementById('source-db');
const serverName = document.getElementById('server-name');
const serverUsername = document.getElementById('server-user-name');
const serverPassword = document.getElementById('server-password');
const serverDbName = document.getElementById('server-db-name');

minimizeButton.addEventListener('click', () => {
    ipcRenderer.send('minimize-app', null);
});

exitButton.addEventListener('click', () => {
    ipcRenderer.send('exit-app', null);
});

connectButton.addEventListener('click', () => {
    if (sourceDb.value == '') {
        alert('Select a source database!');
        return;
    }
    if (serverName.value == '' || serverUsername.value == '' || serverPassword.value == '' || serverDbName.value == '') {
        alert('Destination Database parameters\ncannot be empty');
        return;
    }
    let data = {
        sourcetype: sourceType.value,
        sourcedb: sourceDb.value,
        server: serverName.value,
        user: serverUsername.value,
        pwd: serverPassword.value,
        destdb: serverDbName.value
    };
    summaryText.innerHTML = "";
    ipcRenderer.send('connect-db', data);
});

selectButton.addEventListener('click', function (event) {
    let data = { type: sourceType.value };
    ipcRenderer.send('file-dialog', data);
});

ipcRenderer.on('file-dialog', function (event, path) {
    accessDbInput.value = path;
});

ipcRenderer.on('connect-db', function (event, msg) {
    if (msg.indexOf('CRITICAL') >= 0) {
        alert(msg.replace('CRITICAL:', ''));
    }
    if (msg.indexOf('ERROR') >= 0) {
        summaryText.innerHTML += msg.replace('ERROR:', '') + "<br>";
    }
    if (msg.indexOf('source') >= 0) {
        console.log(msg);
        let map = JSON.parse(msg);
        summaryText.innerHTML += `${map['source']} => ${map['dest']}: ${map['records']} records<br>`;
    }
});