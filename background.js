chrome.runtime.onInstalled.addListener(() => {
    // Set default settings
    chrome.storage.sync.set({
      enabled: true,
      hideFiltered: false,
      blockedKeywords: [],
      blockedChannels: [],
      minViewCount: 0
    });
  });