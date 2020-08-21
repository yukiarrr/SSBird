const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const closeWithMessage = async (message) => {
  await alertOnBackground(message);
  close();
};

const alertOnBackground = async (message) => {
  return new Promise((resolve) => {
    chrome.runtime.getBackgroundPage((backgroundPage) =>
      resolve(backgroundPage.alert(message))
    );
  });
};

const chromeStorage = {
  get: async (keys) => {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  },
  set: async (items) => {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  },
  remove: async (keys) => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  },
  clear: async () => {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  },
};

const getBackgroundVariable = (variableName) => {
  return new Promise((resolve) => {
    chrome.runtime.getBackgroundPage((backgroundPage) =>
      resolve(backgroundPage.backgroundObject[variableName])
    );
  });
};

const callBackgroundFunction = (functionName, args) => {
  return new Promise((resolve) => {
    chrome.runtime.getBackgroundPage((backgroundPage) =>
      resolve(backgroundPage.backgroundObject[functionName](args))
    );
  });
};
