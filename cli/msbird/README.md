# msbird

[English](https://github.com/yukiarrr/SSBird/blob/master/cli/msbird/README.md) / [日本語](https://github.com/yukiarrr/SSBird/blob/master/cli/msbird/README.ja.md)

msbird is CLI tool for SSBird master data management tool.
It can reflect csv data from the CLI to Spreadsheet, and is intended to be used in the CI/CD pipeline.

## Getting started

### Server side

1. Download the version of `SSBird-vX.X.X.Server.zip` you want to use from the [Releases](https://github.com/yukiarrr/SSBird/releases) and unzip it
2. Right-click on the location on Google Drive where you want to save the script and select `More > Google Apps Script` (please create it separate from `apply.gs`)
3. Open the code editor, overwrite it with the code in `SSBird/gas/sync.gs` and save it
4. (optional) In line 8 of the `sync.gs`, enter your password like `const password = "Enter a random password here";` (it will be required as `"syncPassword"` in `cli-config.json`)
5. From the status bar above, select `Publish > Deploy as Web app...` and change the permissions under "Who has access to the app" so that SSBird members can access it, then press "Update"
6. You will be asked to approve it after the update, so follow the instructions to approve it

### CLI side

Execute the following command.

```sh
$ go get -u github.com/yukiarrr/SSBird/cli/msbird
```

If your path contains bin (`export PATH=$PATH:$GOPATH/bin`), you will be able to execute the following command.

```sh
$ msbird help
This is the CLI for SSBird, master data management tool.
This CLI can reflect csv data to Spreadsheet.
It is intended to be used on CI/CD pipeline.

Usage:
  msbird [command]

Available Commands:
  help        Help about any command
  init        Initialize msbird command
  sync        Sync csv data in Spreadsheet

Flags:
  -h, --help   help for msbird

Use "msbird [command] --help" for more information about a command.

```

## How to use CLI

Initialize msbird command.
There are two initialization methods.

#### OAuth 2.0

```sh
$ msbird init --config cli-config.json
```

This method uses OAuth 2.0 to authorize to Google API.
The required option is `--config` and the required json key is as follows.

```jsonc
{
  // URLs that can be obtained after publishing a web application in sync.gs
  "syncUrl": "https://script.google.com/XXXXXXX/exec",

  // It's the same as the one you set up in extension-config.json when you set up the Chrome extension
  "repositoryUrl": "https://github.com/XXXXXXX/XXXXXXX",

  // It's the same as the one you set up in extension-config.json when you set up the Chrome extension
  "rootFolderId": "XXXXXXX",

  // Access Token required to reference csv data from CLI to repository
  "gitHubAccessToken": "",

  // The password that was set when the sync.gs was set up (if omitted, it is not necessary)
  "syncPassword": "",

  // Client Id created in Google API Console
  "googleClientId": "XXXXXXX",

  // Secret Id created in Google API Console
  "googleClientSecret": "XXXXXXX",

  // Refresh Token generated based on Client Id and Client Secret
  "googleRefreshToken": "XXXXXXX"
}
```

When you create Refresh Token, specify `https://www.googleapis.com/auth/drive` in Scope.

#### How to generate Refresh Token

1. Register `http://localhost` as an approved URL in Google API Console
2. Access　`https://accounts.google.com/o/oauth2/auth?client_id=[Client Id]&redirect_uri=http://localhost&scope=https://www.googleapis.com/auth/drive&response_type=code&approval_prompt=force&access_type=offline` in your browser
3. Cut out the `[Code]` part of the redirected `http://localhost/?code=[Code]&scope=https://www.googleapis.com/auth/drive`
4. Execute `curl -d client_id=[Client Id] -d client_secret=[Client Secret] -d redirect_uri=http://localhost -d grant_type=authorization_code -d code=[Code] https://accounts.google.com/o/oauth2/token` through CLI (use the one you just cut out for `[Code]`)
5. You can get Refresh Token in the response


### Service Account

```sh
$ msbird init --config cli-config.json --service-account service-account.json
```

This method uses Service Account to authorize to Google API.
The required options are `--config` and `--service-account`, and the json key required for `--config` is as follows.

```jsonc
{
  // URLs that can be obtained after publishing a web application in sync.gs
  "syncUrl": "https://script.google.com/XXXXXXX/exec",

  // It's the same as the one you set up in extension-config.json when you set up the Chrome extension
  "repositoryUrl": "https://github.com/XXXXXXX/XXXXXXX",

  // It's the same as the one you set up in extension-config.json when you set up the Chrome extension
  "rootFolderId": "XXXXXXX",

  // Access Token required to reference csv data from CLI to repository
  "gitHubAccessToken": "",

  // The password that was set when the sync.gs was set up (if omitted, it is not necessary)
  "syncPassword": ""
}
```

Please specify the key pair of json which will be downloaded after creating Service Account in `--service-account`.

When you use Service Account, **you need to share the `sync.gs` with created Service Account. (add Service Account email address)**

### `msbird sync`

Csv data on GitHub is reflected in Spreadsheet.
When Pull Request is merged into target branch, it is intended that the changes will also be reflected in Spreadsheet.

```sh
$ msbird sync --csv-path csvs/example.csv --sheet-name develop
```

In this example, create "csvs" folder and "example" spreadsheet in Google Drive if they don't exist,
then create "develop" sheet if it doesn't exist and write the csv data to it.

Note that --csv-path for the argument must be relative to the repository.