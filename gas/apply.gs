// MasterBird v0.5.0
// https://github.com/yukiarrr/MasterBird
// MIT License

/* =================================== */

// Change only here
const password = "";

/* =================================== */

function doPost(e) {
  const {
    spreadsheetId,
    baseSheetName,
    overlaySheetNames,
    rootFolderId,
    applyPassword,
  } = JSON.parse(decodeURI(e.postData.getDataAsString()));
  const response = {};

  if (applyPassword !== password) {
    throw new Error("Wrong password.");
  }

  const { csvValue, merged } = mergeSheets(
    spreadsheetId,
    baseSheetName,
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

function mergeSheets(spreadsheetId, baseSheetName, overlaySheetNames) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let baseSheet = spreadsheet.getSheetByName(baseSheetName);
  if (!baseSheet) {
    baseSheet = spreadsheet.insertSheet(baseSheetName);
  }

  if (overlaySheetNames.length === 0) {
    // Base sheet only
    return {
      csvValue: valuesToCsvs(baseSheet.getDataRange().getValues()),
      merged: true,
    };
  }

  let merged = false;

  for (const overlaySheetName of overlaySheetNames) {
    if (overlaySheetName === baseSheetName) {
      continue;
    }

    const overlaySheet = spreadsheet.getSheetByName(overlaySheetName);
    if (!overlaySheet) {
      continue;
    }

    let baseValues = baseSheet.getDataRange().getValues();
    const overlayValues = overlaySheet.getDataRange().getValues();
    let firstBaseValue = baseValues[0];
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
        !firstBaseValue.some((value) => value == overlayColumnValue)
      ) {
        insertColumnIndices.push(overlayColumnIndex);
      }
    }

    const baseSheetId = baseSheet.getSheetId();
    const isEmptyBaseSheet = isEmptySheet(baseValues);
    const columnRequests = [];
    let insertColumns = 0;

    for (const insertColumnIndex of insertColumnIndices) {
      if (
        !isEmptyBaseSheet &&
        insertColumnIndex < firstBaseValue.length + insertColumns
      ) {
        columnRequests.push({
          insertDimension: {
            range: {
              sheetId: baseSheetId,
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
            sheetId: baseSheetId,
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

      baseValues = baseSheet.getDataRange().getValues();
      firstBaseValue = baseValues[0];
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
        let baseRowIndex = 0;
        baseRowIndex < baseValues.length;
        baseRowIndex++
      ) {
        const baseValue = baseValues[baseRowIndex];
        if (overlayValue[0] == baseValue[0]) {
          matched = true;

          for (
            let overlayColumnIndex = 1;
            overlayColumnIndex < overlayValue.length;
            overlayColumnIndex++
          ) {
            for (
              let baseColumnIndex = 1;
              baseColumnIndex < baseValue.length;
              baseColumnIndex++
            ) {
              if (
                firstBaseValue[baseColumnIndex] &&
                firstBaseValue[baseColumnIndex] ==
                  firstOverlayValue[overlayColumnIndex] &&
                baseValue[baseColumnIndex] !== overlayValue[overlayColumnIndex]
              ) {
                rowData.push({
                  range: `${baseSheetName}!${
                    columnToLetter(baseColumnIndex + 1) + (baseRowIndex + 1)
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

        const dataRows = baseValues.length + addRows;
        rowData.push({
          range: `${baseSheetName}!${columnToLetter(1) + dataRows}:${
            columnToLetter(firstBaseValue.length) + dataRows
          }`,
          values: [
            firstBaseValue.map((value) =>
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

    const newRows = baseValues.length + addRows;
    const currentMaxRows = baseSheet.getMaxRows();
    if (currentMaxRows < newRows) {
      baseSheet.insertRows(currentMaxRows, newRows - currentMaxRows);
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

      merged = true;
    }
  }

  return {
    csvValue: valuesToCsvs(baseSheet.getDataRange().getValues()),
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

function isEmptySheet(baseValues) {
  return !Boolean(baseValues[0][0]);
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
