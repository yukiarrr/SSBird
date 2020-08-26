const FunctionType = {
  Unknown: 0,
  Initialize: 1,
  Apply: 2,
};

window.backgroundObject = {};

backgroundObject.isInitializing = false;
backgroundObject.isInitialized = false;
backgroundObject.isApplying = false;
backgroundObject.saveCallback = () => {};
backgroundObject.applyCallback = () => {};

backgroundObject.initialize = async (args) => {
  backgroundObject.saveCallback = args.callback;
  delete args.callback;
  Object.assign(backgroundObject, args);
  backgroundObject.isInitializing = true;
  backgroundObject.isInitialized = false;

  await chromeStorage.set(args);

  const maxRequestCount = 5;
  const downloadConfig = async (i) => {
    try {
      Object.assign(
        backgroundObject,
        await $.get({
          url: `https://drive.google.com/u/${i}/uc?export=download&id=${backgroundObject.configFileId}`,
        })
      );
    } catch (e) {
      if (i < maxRequestCount && e.status === 403) {
        i++;
        await downloadConfig(i);
      } else {
        backgroundObject.isInitializing = false;
        await chromeStorage.remove("configFileId");
        delete backgroundObject.configFileId;
        alert(
          `Failed download extension-config.json.\nCheck Config File Id.\n\n${e.responseText}`
        );
      }
    }
  };

  await downloadConfig(0);
  if (!backgroundObject.configFileId) {
    return;
  }

  port.postMessage({
    functionType: FunctionType.Initialize,
    repositoryUrl:
      backgroundObject.repositoryUrl.replace(
        "https://",
        `https://${backgroundObject.gitHubUsername}:${backgroundObject.gitHubAccessToken}@`
      ) + ".git",
  });
};

backgroundObject.apply = async (args) => {
  if (backgroundObject.isInitializing) {
    alert("Wait initializing...");

    return;
  }

  const {
    spreadsheetIds,
    targetSheetName,
    overlaySheetNames,
    baseBranchName,
    callback,
  } = args;
  backgroundObject.applyCallback = callback;
  backgroundObject.isApplying = true;

  if (!backgroundObject.applyUrl || !backgroundObject.rootFolderId) {
    backgroundObject.isApplying = false;
    callback();
    alert("Not found applyUrl or rootFolderId.\nCheck extension-config.json.");

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
          targetSheetName: targetSheetName,
          overlaySheetNames: overlaySheetNames,
          rootFolderId: backgroundObject.rootFolderId,
          applyPassword: backgroundObject.applyPassword,
        }),
        dataType: "json",
      });
    } catch (e) {
      backgroundObject.isApplying = false;
      callback();
      alert(
        `Failed apply api.\nCheck applyUrl in extension-config.json.\n\n${e.responseText}`
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

  if (!backgroundObject.gitHubUsername || !backgroundObject.gitHubEmail) {
    backgroundObject.isApplying = false;
    callback();
    alert("Not found GitHub Username or GitHub Email.\nResave Config.");

    return;
  }

  const baseBranchNames = [baseBranchName];
  port.postMessage({
    functionType: FunctionType.Apply,
    targetBranchName: targetSheetName,
    baseBranchNames: baseBranchNames,
    username: backgroundObject.gitHubUsername,
    email: backgroundObject.gitHubEmail,
    csvs: csvs,
  });
};

const port = chrome.runtime.connectNative("com.yukiarrr.masterbird");
port.onMessage.addListener((message) => {
  backgroundObject.isInitializing = false;
  backgroundObject.isApplying = false;
  backgroundObject.saveCallback();
  backgroundObject.applyCallback();

  if (!message.errorMessage) {
    if (!backgroundObject.isInitialized) {
      backgroundObject.isInitialized = true;
    }

    alert("Success 🎉");
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
