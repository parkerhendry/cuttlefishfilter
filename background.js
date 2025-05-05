chrome.runtime.onInstalled.addListener(() => {
    // Set default settings when extension is installed
    chrome.storage.sync.set({
      enabled: true,
      keywords: '',
      channels: '',
      minViews: 0
    });
  });