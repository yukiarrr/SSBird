<p align="center"><img width="80" src="https://github.com/yukiarrr/MasterBird/raw/master/docs/images/logo.png" alt="MasterBird logo"></p>
<h2 align="center">MasterBird</h2>
<p align="center"><a href="https://github.com/yukiarrr/MasterBird/blob/master/README.md">English</a> / <a href="https://github.com/yukiarrr/MasterBird/blob/master/README.ja.md">日本語</a></p>

This is a master data management tool that can merge sheets in Spreadsheet and push it to GitHub as csv, using only the Chrome Extension.

<p align="center"><img width="600" src="https://github.com/yukiarrr/MasterBird/raw/master/docs/images/masterbird.gif" alt="MasterBird gif"></p>

## 目次

- [Overview](#Overview)
- [Getting started](#getting-started)
  - [Administrator only](#administrator-only)
  - [All members](#all-members)
  - [About `extension-config.json`](#about-extension-configjson)
- [How to use](#how-to-use)
  - [Support dark mode](#support-dark-mode)
  - [Push a sheet directly to GitHub](#push-a-sheet-directly-to-github)
  - [Merge sheets and push it to GitHub](#merge-sheets-and-push-it-to-github)
  - [Push multiple Spreadsheets to GitHub](#push-multiple-Spreadsheets-to-github)
- [Rules for merging sheets and converting csv](#rules-for-merging-sheets-and-converting-csv)
  - [Basic rules](#basic-rules)
  - [Rules for merging sheets](#rules-for-merging-sheets)

## Overview

The most common way to manage master data is to create data in Excel or Spreadsheet, and reflect it to GitHub or database.  
Of these, MasterBird minimizes the cost of managing master data by taking care of the process of creating data and pushing it to GitHub, except for parts that are dependent on each project's development environment, such as reflecting database.

<p align="center"><img width="500" src="https://github.com/yukiarrr/MasterBird/raw/master/docs/images/masterbird-role.jpg" alt="MasterBird role"></p>

It is also configured to minimize the cost of deploying this tool by using Spreadsheet and making it serverless.  
As an operational flow, we assume that when a csv is pushed to GitHub, it is imported into the database on CI/CD.

## Getting started

### Administrator only

1. Download the version of `MasterBird-vX.X.X.Server.zip` you want to use from the [Releases](https://github.com/yukiarrr/MasterBird/releases) and unzip it
2. Right-click on the location on Google Drive where you want to save the script and select `More > Google Apps Script`
3. Open the code editor, overwrite it with the code in `MasterBird/gas/apply.gs` and save it
4. (optional) In line 8 of the `apply.gs`, enter your password like `const password = "Enter a random password here";` (it will be required as Apply Password when the Chrome extension is installed)
5. From the status bar above, go to `Resources > Advanced Google services...` and turn on "Google Sheets API"
6. From the status bar above, select `Publish > Deploy as Web app...` and change the permissions under "Who has access to the app" so that MasterBird members can access it, then press "Update"
7. You will be asked to approve it after the update, so follow the instructions to approve it
8. Edit MasterBird/examples/extension-config.json with reference to [this](#about-extension-configjson) (use the URL that appears after the completion of step 5 of this procedure for applyUrl)
9. Right-click on the configuration file in a location on Google Drive that your team members can access and upload the `extension-config.json` that you edited in `Upload files`
10. Right-click on the uploaded `extension-config.json`, select `Get shareable link`, and note the `XXXXXXX` part of `https://drive.google.com/open?id=XXXXXXX` as the ID (it will be required as Config File Id when the Chrome extension is installed)

### All members

1. Download the version of `MasterBird-vX.X.X.Client.zip` you want to use from the [Releases](https://github.com/yukiarrr/MasterBird/releases) and unzip it
2. If you are a Mac user, right-click on `MasterBird/extension/installer/mac/install.command`, hold down the command key and select "Open", which will bring up a dialog, then select "Open"
3. If you are a Windows user, double-click on `MasterBird/extension/installer/windows/install.bat`
4. Please log in with your administrator-designated GitHub account
5. Please refer to [this page](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) and check the "repo" box in step 7 of the reference, and then issue the GitHub access token
6. Go to `chrome://extensions`, turn on developer mode in the upper right corner, and select `MasterBird/extension/app` under "LOAD UNPACKED"
7. Please log in with your administrator-designated Google account
8. When you go to the Spreadsheet screen or the folder where Spreadsheet is located in Google Drive, you will be able to press the MasterBird icon in the upper right corner of Chrome
9. You will be asked for information, so enter it (use the GitHub Access Token you got in step 4 of this procedure)
10. Config File Id should be told to you by your administrator

### About `extension-config.json`

```jsonc
{
  // URLs that can be obtained after publishing a web application in apply.gs
  "applyUrl": "https://script.google.com/XXXXXXX/exec",

  // URL of the GitHub repository to push
  // Please give the user who issues the access token more than Write permission
  "repositoryUrl": "https://github.com/XXXXXXX/XXXXXXX",

  // The path from this ID folder to Spreadsheet will be the path on GitHub
  // The ID of the folder is the URL in the state of opening the folder with a browser, and
  // https://drive.google.com/drive/u/0/folders/XXXXXXX
  // XXXXXXX part is applicable
  "rootFolderId": "XXXXXXX"
}
```

## How to use

### Support dark mode

|light|dark|
|:-:|:-:|
|<p align="center"><img width="250" src="https://github.com/yukiarrr/MasterBird/raw/master/docs/images/light.png" alt="MasterBird light mode"></p>|<p align="center"><img width="250" src="https://github.com/yukiarrr/MasterBird/raw/master/docs/images/dark.png" alt="MasterBird dark mode"></p>|

### Push a sheet directly to GitHub

1. Create the sheet and data that you want to reflect in Spreadsheet
2. Press the MasterBird icon at the top right
3. Select the sheet you want to reflect in the "Target Sheet"
4. press "Apply"
5. if "Success 🎉" comes up, it's a success!

### Merge sheets and push it to GitHub

1. In Spreadsheet, create a sheet to overwrite the data separately from the sheet you want to reflect (please write a column in the sheet for overwriting)
2. Please write only the data you want to overwrite in the sheet you want to overwrite
3. Select the sheet you want to reflect in the "Target Sheet"
4. Select the sheet describing the data to be overwritten in "Overlay Sheets" (multiple selections are possible, and the data will be overwritten in the order of selection)
5. press "Apply"
6. if "Success 🎉" comes up, it's a success!

### Push multiple Spreadsheets to GitHub

1. Go to the Google Drive folder screen that contains the Spreadsheet you want to reflect.
2. In the 'Apply Spreadsheets' section, select the spreadsheet you want to reflect.
3. As for "Target Sheet" and "Overlay Sheets", it is the same as [Merge sheets and push it to GitHub](#merge-sheets-and-push-it-to-github), and is applied to all selected Spreadsheets.
4. press "Apply".
5. if "Success 🎉" comes up, it's a success!

## Rules for merging sheets and converting csv

### Basic rules

- If the Spreadsheet name is example, it will be example.csv on GitHub
- If the target sheet name is develop, the csv will be pushed to the develop branch
- Data columns should be written with no spaces on the left and top (A1,B1,C1...)
- Cells with blank A columns or 1 rows will be ignored in both merging sheets and converting csv, so please use this when making notes (if you're making notes in B3, leave A3 or B1 blank)

### Rules for merging sheets

- Cells in column A (A1,A2,A3...) is the same, it is assumed to be the same data and overwritten, if not, it is added to the bottom as new data
- If the data is overwritten, it is not a problem even if the order of the data columns other than column A is different between the target sheet and the sheet describing the data to be overwritten because the data is overwritten based on the data column
- If the sheet containing the data to be overwritten has a new data column that is not in the target sheet, new data column will be added
