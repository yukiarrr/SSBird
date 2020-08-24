const FunctionType = {
  Unknown: 0,
  Initialize: 1,
  Apply: 2,
};

window.backgroundObject = {};

backgroundObject.isInitializing = false;
backgroundObject.isInitialized = false;
backgroundObject.isApplying = false;
backgroundObject.applyCallback = () => {};

backgroundObject.initialize = async () => {
  if (backgroundObject.isInitializing || backgroundObject.isInitialized) {
    return;
  }

  backgroundObject.isInitializing = true;

  Object.assign(
    backgroundObject,
    await chromeStorage.get([
      "gitHubUserName",
      "gitHubUserEmail",
      "gitHubAccessToken",
      "globalConfigFileId",
    ])
  );

  const promptIfEmpty = async (key) => {
    if (!backgroundObject[key]) {
      backgroundObject[key] = prompt(`Input ${key}.`);

      if (!backgroundObject[key]) {
        throw `Empty ${key}.`;
      }
    }
    await chromeStorage.set({
      key: backgroundObject[key],
    });
  };

  try {
    await promptIfEmpty("gitHubUserName");
    await promptIfEmpty("gitHubUserEmail");
    await promptIfEmpty("gitHubAccessToken");
    await promptIfEmpty("globalConfigFileId");
  } catch (e) {
    backgroundObject.isInitializing = false;
    alert(e);

    return;
  }

  const maxRequestCount = 5;
  const downloadGlobalConfig = async (i) => {
    try {
      Object.assign(
        backgroundObject,
        await $.get({
          url: `https://drive.google.com/u/${i}/uc?export=download&id=${backgroundObject.globalConfigFileId}`,
        })
      );
    } catch (e) {
      if (i < maxRequestCount && e.status === 403) {
        i++;
        await downloadGlobalConfig(i);
      } else {
        backgroundObject.isInitializing = false;
        await chromeStorage.remove("globalConfigFileId");
        delete backgroundObject.globalConfigFileId;
        alert(
          `Failed download global-config.json.\nCheck globalConfigFileId.\n\n${e.responseText}`
        );
      }
    }
  };

  await downloadGlobalConfig(0);
  if (!backgroundObject.globalConfigFileId) {
    return;
  }

  port.postMessage({
    functionType: FunctionType.Initialize,
    repositoryUrl:
      backgroundObject.repositoryUrl.replace(
        "https://",
        `https://${backgroundObject.gitHubUserName}:${backgroundObject.gitHubAccessToken}@`
      ) + ".git",
  });
};

backgroundObject.apply = async (args) => {
  if (backgroundObject.isInitializing) {
    alert("Wait initializing...");

    return;
  }

  const { spreadsheetIds, baseSheetName, overlaySheetNames, callback } = args;
  backgroundObject.applyCallback = callback;
  backgroundObject.isApplying = true;

  if (!backgroundObject.applyUrl || !backgroundObject.rootFolderId) {
    backgroundObject.isApplying = false;
    callback();
    alert("Not found applyUrl or rootFolderId.\nCheck global-config.json.");

    return;
  }

  const csvs = [];
  for (const spreadsheetId of spreadsheetIds) {
    let applyResponse = {};
    try {
      applyResponse = await $.post({
        url: backgroundObject.applyUrl,
        data: JSON.stringify({
          spreadsheetId: spreadsheetId,
          baseSheetName: baseSheetName,
          overlaySheetNames: overlaySheetNames,
          rootFolderId: backgroundObject.rootFolderId,
        }),
        dataType: "json",
      });
    } catch (e) {
      backgroundObject.isApplying = false;
      callback();
      alert(
        `Failed apply api.\nCheck applyUrl in global-config.json.\n\n${e.responseText}`
      );

      return;
    }

    if (applyResponse.csv) {
      csvs.push(applyResponse.csv);
    }
  }

  if (csvs.length === 0) {
    backgroundObject.isApplying = false;
    callback();
    alert("Not changed.");

    return;
  }

  if (!backgroundObject.gitHubUserName || !backgroundObject.gitHubUserEmail) {
    backgroundObject.isApplying = false;
    callback();
    alert("Not found gitHubUserName or gitHubUserEmail.\nReset Config.");

    return;
  }

  port.postMessage({
    functionType: FunctionType.Apply,
    baseBranchName: baseSheetName,
    userName: backgroundObject.gitHubUserName,
    userEmail: backgroundObject.gitHubUserEmail,
    csvs: csvs,
  });
};

backgroundObject.reset = async () => {
  backgroundObject.isInitializing = false;
  backgroundObject.isInitialized = false;
  await chromeStorage.clear();
};

const port = chrome.runtime.connectNative("com.yukiarrr.masterbird");
port.onMessage.addListener((message) => {
  backgroundObject.isInitializing = false;
  backgroundObject.isApplying = false;
  backgroundObject.applyCallback();

  if (!message.errorMessage) {
    if (!backgroundObject.isInitialized) {
      backgroundObject.isInitialized = true;
    } else {
      alert("Success 🎉");
    }
  } else {
    alert(message.errorMessage);
  }
});

chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
  chrome.declarativeContent.onPageChanged.addRules([
    {
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostEquals: "docs.google.com",
            pathContains: "spreadsheets",
          },
        }),
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostEquals: "drive.google.com", pathContains: "folders" },
        }),
      ],
      actions: [new chrome.declarativeContent.ShowPageAction()],
    },
  ]);
});
