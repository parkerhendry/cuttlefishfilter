chrome.runtime.onInstalled.addListener(() => {
    // Set default settings
    chrome.storage.sync.set({
      enabled: true,
      blockedKeywords: [],
      blockedChannels: [],
      minViewCount: 0
    });
  });