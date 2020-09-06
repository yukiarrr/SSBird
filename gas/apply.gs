// MasterBird v0.6.1
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
    notUpdateSheet,
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

  const { csvText, merged } = mergeSheets(
    spreadsheetId,
    targetSheetName,
    overlaySheetNames,
    notUpdateSheet
  );
  if (merged) {
    response["csv"] = {
      path: getFullPath(spreadsheetId, rootFolderId),
      value: csvText,
    };
  }

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(response));
  return output;
}

function mergeSheets(
  spreadsheetId,
  targetSheetName,
  overlaySheetNames,
  notUpdateSheet
) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let targetSheet = spreadsheet.getSheetByName(targetSheetName);
  if (!targetSheet && !notUpdateSheet) {
    targetSheet = spreadsheet.insertSheet(targetSheetName);
  }

  let targetValues = notUpdateSheet
    ? [[]]
    : targetSheet.getDataRange().getDisplayValues();

  if (overlaySheetNames.length === 0) {
    // Target sheet only
    return {
      csvText: dumpCsv(targetValues),
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

    const overlayValues = overlaySheet.getDataRange().getDisplayValues();
    const insertColumnIndices = [];

    for (
      let overlayColumnIndex = 0;
      overlayColumnIndex < overlayValues[0].length;
      overlayColumnIndex++
    ) {
      const overlayColumnValue = overlayValues[0][overlayColumnIndex];
      if (
        overlayColumnValue &&
        !targetValues[0].some((value) => value == overlayColumnValue)
      ) {
        insertColumnIndices.push(overlayColumnIndex);
      }
    }

    const targetSheetId = targetSheet ? targetSheet.getSheetId() : "";
    const isEmptyTargetSheet = isEmptySheet(targetValues);
    const columnRequests = [];

    for (const insertColumnIndex of insertColumnIndices) {
      if (!isEmptyTargetSheet && insertColumnIndex < targetValues[0].length) {
        targetValues = targetValues.map((value) => {
          if (value.length > insertColumnIndex) {
            value.splice(insertColumnIndex, 0, "");
          }
          return value;
        });
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
      }

      targetValues = targetValues.map((value) =>
        value.length < insertColumnIndex + 1
          ? value.concat(
              ...new Array(insertColumnIndex + 1 - value.length).fill("")
            )
          : value
      );
      const updateValue = overlayValues[0][insertColumnIndex];
      targetValues[0][insertColumnIndex] = updateValue;
      columnRequests.push({
        updateCells: {
          rows: [
            {
              values: [
                {
                  userEnteredValue: {
                    stringValue: updateValue,
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

    if (insertColumnIndices.length > 0 && !notUpdateSheet) {
      Sheets.Spreadsheets.batchUpdate(
        { requests: columnRequests },
        spreadsheetId
      );
    }

    const rowData = [];
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
                targetValues[0][targetColumnIndex] &&
                targetValues[0][targetColumnIndex] ==
                  overlayValues[0][overlayColumnIndex] &&
                targetValue[targetColumnIndex] !=
                  overlayValue[overlayColumnIndex]
              ) {
                const updateValue = overlayValue[overlayColumnIndex];
                targetValues[targetRowIndex][targetColumnIndex] = updateValue;
                rowData.push({
                  range: `${targetSheetName}!${
                    columnToLetter(targetColumnIndex + 1) + (targetRowIndex + 1)
                  }`,
                  values: [[updateValue]],
                });
                break;
              }
            }
          }
        }
      }

      if (!matched) {
        const updateValue = targetValues[0].map((value) =>
          value
            ? overlayValue.find(
                (element, index) => overlayValues[0][index] == value
              )
            : ""
        );
        targetValues.push(updateValue);
        rowData.push({
          range: `${targetSheetName}!${
            columnToLetter(1) + targetValues.length
          }:${columnToLetter(targetValues[0].length) + targetValues.length}`,
          values: [updateValue],
        });
      }
    }

    const currentMaxRows = targetSheet ? targetSheet.getMaxRows() : 0;
    if (currentMaxRows < targetValues.length && !notUpdateSheet) {
      targetSheet.insertRows(
        currentMaxRows,
        targetValues.length - currentMaxRows
      );
    }

    if (rowData.length > 0 && !notUpdateSheet) {
      Sheets.Spreadsheets.Values.batchUpdate(
        {
          valueInputOption: "USER_ENTERED",
          data: rowData,
        },
        spreadsheetId
      );
    }

    merged = true;
  }

  return {
    csvText: dumpCsv(targetValues),
    merged: merged,
  };
}

function dumpCsv(values) {
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
