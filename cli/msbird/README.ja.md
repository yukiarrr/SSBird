# msbird

[English](https://github.com/yukiarrr/SSBird/blob/master/cli/msbird/README.md) / [日本語](https://github.com/yukiarrr/SSBird/blob/master/cli/msbird/README.ja.md)

msbirdはマスタデータ管理ツール「SSBird」のCLIツールです。
CLIからcsvのデータをスプレットシートに反映することができ、CI/CDパイプライン上での使用を想定しています。

## 導入手順

### サーバー側

1. [Releases](https://github.com/yukiarrr/SSBird/releases)から、使用したいバージョンの`SSBird-vX.X.X.Server.zip`をダウンロードし、解凍してください
2. スクリプトを保存したいGoogle Drive上の場所で右クリックし、`その他 > Google Apps Script`を選択してください（`apply.gs`とは別で作成してください）
3. コードエディタが開くので、`SSBird/gas/sync.gs`のコードで上書き後に保存してください
4. （省略可能）`sync.gs`の8行目に、`const password = "ここにランダムなパスワードを入力";`のようにパスワードを入力してください（`cli-config.json`の`"syncPassword"`として必要となります）
5. 上のステータスバーから、`公開 > ウェブ アプリケーションとして導入...`を選択し、「Who has access to the app」でSSBirdを使用するメンバーがアクセスできるように権限を変更してから「更新」を押してください
6. 更新後に承認を求められるので、説明に従って承認してください

### CLI側

以下のコマンドを実行してください。

```sh
$ go get -u github.com/yukiarrr/SSBird/cli/msbird
```

binにパスが通っていれば（`export PATH=$PATH:$GOPATH/bin`）、以下のコマンドが実行できるようになります。

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

## CLIの使い方

### `msbird init`

msbirdコマンドを初期化します。
初期化する方法は二つあります。

#### OAuth 2.0を使った方法

```sh
$ msbird init --config cli-config.json
```

この方法では、Google APIの認証にOAuth 2.0を使用します。
必須オプションは`--config`で、必要となるjsonのkeyは以下の通りです。

```jsonc
{
  // sync.gsのWebアプリケーション公開後に取得できるURL
  "syncUrl": "https://script.google.com/XXXXXXX/exec",

  // Chrome拡張導入時にextension-config.jsonに設定したものと同じ
  "repositoryUrl": "https://github.com/XXXXXXX/XXXXXXX",

  // Chrome拡張導入時にextension-config.jsonに設定したものと同じ
  "rootFolderId": "XXXXXXX",

  // CLIからリポジトリにcsvを参照するために必要なAccess Token
  "gitHubAccessToken": "",

  // sync.gs導入時に設定したパスワード（省略した場合は不要）
  "syncPassword": "",

  // Google API Consoleで作成したClient Id
  "googleClientId": "XXXXXXX",

  // Google API Consoleで作成したClient Secret
  "googleClientSecret": "XXXXXXX",

  // Client IdとClient Secretを元に生成したRefresh Token
  "googleRefreshToken": "XXXXXXX"
}
```

なお、Refresh Tokenを生成する際、Scopeに`https://www.googleapis.com/auth/drive`を指定してください。

#### Refresh Tokenの生成方法

1. Google API Consoleで`http://localhost`を承認済みのURLとして登録してください
2. `https://accounts.google.com/o/oauth2/auth?client_id=[Client Id]&redirect_uri=http://localhost&scope=https://www.googleapis.com/auth/drive&response_type=code&approval_prompt=force&access_type=offline`にブラウザでアクセスしてください
3. リダイレクトされた`http://localhost/?code=[Code]&scope=https://www.googleapis.com/auth/drive`のURLの`[Code]`の部分を抜き取ってください
4. `curl -d client_id=[Client Id] -d client_secret=[Client Secret] -d redirect_uri=http://localhost -d grant_type=authorization_code -d code=[Code] https://accounts.google.com/o/oauth2/token`をCLIで実行してください（`[Code]`には先ほど抜き取ったものを使用してください）
5. レスポンスでRefresh Tokenを取得できます


### Service Accountを使った方法

```sh
$ msbird init --config cli-config.json --service-account service-account.json
```

この方法では、Google APIの認証にService Accountを使用します。
必須オプションは`--config`と`--service-account`で、`--config`で必要となるjsonのkeyは以下の通りです。

```jsonc
{
  // sync.gsのWebアプリケーション公開後に取得できるURL
  "syncUrl": "https://script.google.com/XXXXXXX/exec",

  // Chrome拡張導入時にextension-config.jsonに設定したものと同じ
  "repositoryUrl": "https://github.com/XXXXXXX/XXXXXXX",

  // Chrome拡張導入時にextension-config.jsonに設定したものと同じ
  "rootFolderId": "XXXXXXX",

  // CLIからリポジトリにcsvを参照するために必要なAccess Token
  "gitHubAccessToken": "",

  // sync.gs導入時に設定したパスワード（省略した場合は不要）
  "syncPassword": ""
}
```

`--service-account`には、Service Account作成後にダウンロードするjsonのキーペアを指定してください。

なお、Service Accountを使用する場合、**作成した`Service Account`に`sync.gs`を共有する必要があります（メールアドレスの追加）。**

### `msbird sync`

GitHub上のcsvデータをスプレットシートに反映します。
Pull Requestが対象のブランチにマージされた際に、その変更をスプレットシート側にも反映するなどの使用方法を想定しています。

```sh
$ msbird sync --csv-path csvs/example.csv --sheet-name develop
```

この例では、Google Driveに「csvs」フォルダと「example」スプレッドシートが存在しない場合は作成後、そのスプレットシートに「develop」シートがなければ作成し、そこにcsvデータを書き込んでいます。

なお、引数の`--csv-path`はリポジトリからの相対パスでなければならないことに注意してください。