# DBAdmin

A Data migration tool for VFP Database and MSAccess Database to MSSQL Server and MySQL.

## Beta Stage

- [x] Connect to VFP Database and Read data.
- [x] Connect to MySQL / SQL Server
- [x] Write data from sources (VFP/MSAccess) to Server database.
- [x] Display log of migration process.
- [ ] Schedule and Backup Server database.

## Packaging

npx electron-packager . dbadmin --platform win32 --arch x64 --out dist/ --overwrite --icon res/db.ico
