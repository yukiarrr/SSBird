// MasterBird v0.6.0
// https://github.com/yukiarrr/MasterBird
// MIT License

/* =================================== */

// Change only here
const password = "";

/* =================================== */

function doPost(e) {
  const {
    spreadsheetId,
    targetSheetName,
    overlaySheetNames,
    rootFolderId,
    applyPassword,
  } = JSON.parse(
    decodeURI(
      e.postData.getDataAsString().replace(/%(?![0-9][0-9a-fA-F]+)/g, "%25")
    )
  );
  const response = {};

  if (applyPassword !== password) {
    throw new Error("Wrong password.");
  }

  const { csvValue, merged } = mergeSheets(
    spreadsheetId,
    targetSheetName,
    overlaySheetNames
  );
  if (merged) {
    response["csv"] = {
      path: getFullPath(spreadsheetId, rootFolderId),
      value: csvValue,
    };
  }

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(response));
  return output;
}

function mergeSheets(spreadsheetId, targetSheetName, overlaySheetNames) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let targetSheet = spreadsheet.getSheetByName(targetSheetName);
  if (!targetSheet) {
    targetSheet = spreadsheet.insertSheet(targetSheetName);
  }

  if (overlaySheetNames.length === 0) {
    // Target sheet only
    return {
      csvValue: valuesToCsvs(targetSheet.getDataRange().getDisplayValues()),
      merged: true,
    };
  }

  let merged = false;

  for (const overlaySheetName of overlaySheetNames) {
    if (overlaySheetName === targetSheetName) {
      continue;
    }

    const overlaySheet = spreadsheet.getSheetByName(overlaySheetName);
    if (!overlaySheet) {
      continue;
    }

    let targetValues = targetSheet.getDataRange().getDisplayValues();
    const overlayValues = overlaySheet.getDataRange().getDisplayValues();
    let firstTargetValue = targetValues[0];
    const firstOverlayValue = overlayValues[0];
    const insertColumnIndices = [];

    for (
      let overlayColumnIndex = 0;
      overlayColumnIndex < firstOverlayValue.length;
      overlayColumnIndex++
    ) {
      const overlayColumnValue = firstOverlayValue[overlayColumnIndex];
      if (
        overlayColumnValue &&
        !firstTargetValue.some((value) => value == overlayColumnValue)
      ) {
        insertColumnIndices.push(overlayColumnIndex);
      }
    }

    const targetSheetId = targetSheet.getSheetId();
    const isEmptyTargetSheet = isEmptySheet(targetValues);
    const columnRequests = [];
    let insertColumns = 0;

    for (const insertColumnIndex of insertColumnIndices) {
      if (
        !isEmptyTargetSheet &&
        insertColumnIndex < firstTargetValue.length + insertColumns
      ) {
        columnRequests.push({
          insertDimension: {
            range: {
              sheetId: targetSheetId,
              dimension: "COLUMNS",
              startIndex: insertColumnIndex,
              endIndex: insertColumnIndex + 1,
            },
          },
        });
        insertColumns++;
      }

      columnRequests.push({
        updateCells: {
          rows: [
            {
              values: [
                {
                  userEnteredValue: {
                    stringValue: firstOverlayValue[insertColumnIndex],
                  },
                },
              ],
            },
          ],
          fields: "userEnteredValue",
          range: {
            sheetId: targetSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: insertColumnIndex,
            endColumnIndex: insertColumnIndex + 1,
          },
        },
      });
    }

    if (insertColumnIndices.length > 0) {
      Sheets.Spreadsheets.batchUpdate(
        { requests: columnRequests },
        spreadsheetId
      );

      SpreadsheetApp.flush();

      targetValues = targetSheet.getDataRange().getDisplayValues();
      firstTargetValue = targetValues[0];
    }

    const rowData = [];
    let addRows = 0;

    for (
      let overlayRowIndex = 0;
      overlayRowIndex < overlayValues.length;
      overlayRowIndex++
    ) {
      const overlayValue = overlayValues[overlayRowIndex];
      if (overlayRowIndex === 0 || ignoresRow(overlayValue)) {
        continue;
      }

      let matched = false;

      for (
        let targetRowIndex = 0;
        targetRowIndex < targetValues.length;
        targetRowIndex++
      ) {
        const targetValue = targetValues[targetRowIndex];
        if (overlayValue[0] == targetValue[0]) {
          matched = true;

          for (
            let overlayColumnIndex = 1;
            overlayColumnIndex < overlayValue.length;
            overlayColumnIndex++
          ) {
            for (
              let targetColumnIndex = 1;
              targetColumnIndex < targetValue.length;
              targetColumnIndex++
            ) {
              if (
                firstTargetValue[targetColumnIndex] &&
                firstTargetValue[targetColumnIndex] ==
                  firstOverlayValue[overlayColumnIndex] &&
                targetValue[targetColumnIndex] !==
                  overlayValue[overlayColumnIndex]
              ) {
                rowData.push({
                  range: `${targetSheetName}!${
                    columnToLetter(targetColumnIndex + 1) + (targetRowIndex + 1)
                  }`,
                  values: [[overlayValue[overlayColumnIndex]]],
                });
                changed = true;
                break;
              }
            }
          }
        }
      }

      if (!matched) {
        addRows++;

        const dataRows = targetValues.length + addRows;
        rowData.push({
          range: `${targetSheetName}!${columnToLetter(1) + dataRows}:${
            columnToLetter(firstTargetValue.length) + dataRows
          }`,
          values: [
            firstTargetValue.map((value) =>
              value
                ? overlayValue.find(
                    (element, index) => firstOverlayValue[index] == value
                  )
                : null
            ),
          ],
        });
      }
    }

    const newRows = targetValues.length + addRows;
    const currentMaxRows = targetSheet.getMaxRows();
    if (currentMaxRows < newRows) {
      targetSheet.insertRows(currentMaxRows, newRows - currentMaxRows);
    }

    if (rowData.length > 0) {
      Sheets.Spreadsheets.Values.batchUpdate(
        {
          valueInputOption: "USER_ENTERED",
          data: rowData,
        },
        spreadsheetId
      );

      SpreadsheetApp.flush();
    }

    merged = true;
  }

  return {
    csvValue: valuesToCsvs(targetSheet.getDataRange().getDisplayValues()),
    merged: merged,
  };
}

function valuesToCsvs(values) {
  return values
    .filter((row) => !ignoresRow(row))
    .map((row) =>
      row
        .filter((element, index) => values[0][index])
        .map((value) =>
          /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        )
        .join(",")
    )
    .join("\n");
}

function ignoresRow(row) {
  return !Boolean(row[0]);
}

function isEmptySheet(targetValues) {
  return !Boolean(targetValues[0][0]);
}

function columnToLetter(column) {
  let temp,
    letter = "";
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function getFullPath(fileId, rootFolderId) {
  const file = DriveApp.getFileById(fileId);
  const names = [file.getName()];
  let parent = file.getParents();

  while (parent.hasNext()) {
    parent = parent.next();
    if (parent.getId() === rootFolderId) {
      break;
    }
    names.push(parent.getName());
    parent = parent.getParents();
  }

  if (names.length > 0) {
    return names.reverse().join("/");
  }
}
