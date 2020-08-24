// MasterBird v0.5.0
// https://github.com/yukiarrr/MasterBird
// MIT License

function doPost(e) {
  const { csvValue, sheetName, rootFolderId, spreadsheetPath } = JSON.parse(
    decodeURI(e.postData.getDataAsString())
  );
  const response = {};

  sync(csvValue, sheetName, rootFolderId, spreadsheetPath);

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(response));
  return output;
}

function sync(csvValue, sheetName, rootFolderId, spreadsheetPath) {
  const id = getIdByPath(rootFolderId, spreadsheetPath);
  let spreadsheet;
  if (id) {
    spreadsheet = SpreadsheetApp.openById(id);
  } else {
    const fileName = getNameBySpreadsheetPath(spreadsheetPath);
    spreadsheet = SpreadsheetApp.create(fileName);

    createFolder(rootFolderId, spreadsheetPath);

    const folderId = getParentFolderId(rootFolderId, spreadsheetPath);
    const folder = DriveApp.getFolderById(folderId);
    const file = DriveApp.getFileById(spreadsheet.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  const values = Utilities.parseCsv(csvValue);

  sheet.clearContents();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function createFolder(rootFolderId, spreadsheetPath) {
  const folderNames = spreadsheetPath.split("/").slice(0, -1);
  let folderId = rootFolderId;

  for (folderName of folderNames) {
    const folder = DriveApp.getFolderById(folderId);
    const childFolders = folder.getFolders();
    let exists = false;

    while (childFolders.hasNext()) {
      const childFolder = childFolders.next();

      if (childFolder.getName() == folderName) {
        folderId = childFolder.getId();
        exists = true;
        break;
      }
    }

    if (!exists) {
      folderId = folder.createFolder(folderName).getId();
    }
  }
}

function getParentFolderId(rootFolderId, spreadsheetPath) {
  const folderNames = spreadsheetPath.split("/").slice(0, -1);
  let folderId = rootFolderId;

  for (folderName of folderNames) {
    const folder = DriveApp.getFolderById(folderId);
    const childFolders = folder.getFolders();
    let exists = false;

    while (childFolders.hasNext()) {
      const childFolder = childFolders.next();

      if (childFolder.getName() == folderName) {
        folderId = childFolder.getId();
        exists = true;
        break;
      }
    }

    if (!exists) {
      return "";
    }
  }

  return folderId;
}

function getIdByPath(rootFolderId, spreadsheetPath) {
  const folderId = getParentFolderId(rootFolderId, spreadsheetPath);
  if (!folderId) {
    return "";
  }

  const folder = DriveApp.getFolderById(folderId);
  const childFiles = folder.getFiles();
  const fileName = getNameBySpreadsheetPath(spreadsheetPath);
  let fileId = "";

  while (childFiles.hasNext()) {
    const childFile = childFiles.next();

    if (childFile.getName() == fileName) {
      fileId = childFile.getId();
      break;
    }
  }

  return fileId;
}

function getNameBySpreadsheetPath(spreadsheetPath) {
  return spreadsheetPath.split("/").slice(-1)[0];
}
