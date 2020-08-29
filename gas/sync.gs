// MasterBird v0.6.1
// https://github.com/yukiarrr/MasterBird
// MIT License

/* =================================== */

// Change only here
const password = "";

/* =================================== */

function doPost(e) {
  const {
    csvValue,
    sheetName,
    rootFolderId,
    spreadsheetPath,
    syncPassword,
  } = JSON.parse(
    decodeURI(
      e.postData.getDataAsString().replace(/%(?![0-9][0-9a-fA-F]+)/g, "%25")
    )
  );
  const response = {};

  if (syncPassword !== password) {
    throw new Error("Wrong password.");
  }

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
  const values = parseCsv(csvValue);

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

// NOTE: https://qiita.com/weal/items/5aa94235c40d60ef2f0c
function parseCsv(csv) {
  const re = new RegExp(
    '"(?:[^"]|"")*"|"(?:[^"]|"")*$|[^,\r\n]+|\r?\n|\r|,+',
    "g"
  );
  let c,
    m,
    n,
    r = [[""]];
  if (!csv) {
    return [];
  }
  while ((m = re.exec(csv))) {
    if ((c = m[0].charAt(0)) === ",") {
      for (c = m[0].length; c > 0; c--) {
        r[r.length - 1].push("");
      }
      continue;
    }
    if (c === "\n" || c === "\r\n" || c === "\r") {
      r.push([""]);
      continue;
    }
    (n = r[r.length - 1])[n.length - 1] =
      c === '"' ? m[0].replace(/^"|"$/g, "").replace(/""/g, '"') : m[0];
  }
  return r;
}
