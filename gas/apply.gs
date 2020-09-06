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
    mergeSheetNames,
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
    mergeSheetNames,
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
  mergeSheetNames,
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

  if (mergeSheetNames.length === 0) {
    // Target sheet only
    return {
      csvText: dumpCsv(targetValues),
      merged: true,
    };
  }

  let merged = false;

  for (const mergeSheetName of mergeSheetNames) {
    if (mergeSheetName === targetSheetName) {
      continue;
    }

    const mergeSheet = spreadsheet.getSheetByName(mergeSheetName);
    if (!mergeSheet) {
      continue;
    }

    const mergeValues = mergeSheet.getDataRange().getDisplayValues();
    const insertColumnIndices = [];

    for (
      let mergeColumnIndex = 0;
      mergeColumnIndex < mergeValues[0].length;
      mergeColumnIndex++
    ) {
      const mergeColumnValue = mergeValues[0][mergeColumnIndex];
      if (
        mergeColumnValue &&
        !targetValues[0].some((value) => value == mergeColumnValue)
      ) {
        insertColumnIndices.push(mergeColumnIndex);
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
      const updateValue = mergeValues[0][insertColumnIndex];
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
      let mergeRowIndex = 0;
      mergeRowIndex < mergeValues.length;
      mergeRowIndex++
    ) {
      const mergeValue = mergeValues[mergeRowIndex];
      if (mergeRowIndex === 0 || ignoresRow(mergeValue)) {
        continue;
      }

      let matched = false;

      for (
        let targetRowIndex = 0;
        targetRowIndex < targetValues.length;
        targetRowIndex++
      ) {
        const targetValue = targetValues[targetRowIndex];
        if (mergeValue[0] == targetValue[0]) {
          matched = true;

          for (
            let mergeColumnIndex = 1;
            mergeColumnIndex < mergeValue.length;
            mergeColumnIndex++
          ) {
            for (
              let targetColumnIndex = 1;
              targetColumnIndex < targetValue.length;
              targetColumnIndex++
            ) {
              if (
                targetValues[0][targetColumnIndex] &&
                targetValues[0][targetColumnIndex] ==
                  mergeValues[0][mergeColumnIndex] &&
                targetValue[targetColumnIndex] != mergeValue[mergeColumnIndex]
              ) {
                const updateValue = mergeValue[mergeColumnIndex];
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
            ? mergeValue.find(
                (element, index) => mergeValues[0][index] == value
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
