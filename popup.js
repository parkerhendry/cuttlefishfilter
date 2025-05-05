document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings when popup opens
    chrome.storage.sync.get({
      enabled: true,
      keywords: '',
      channels: '',
      minViews: 0
    }, function(items) {
      document.getElementById('enabled').checked = items.enabled;
      document.getElementById('keywords').value = items.keywords;
      document.getElementById('channels').value = items.channels;
      document.getElementById('minViews').value = items.minViews;
      updateStatusText(items.enabled);
    });
  
    // Toggle enabled/disabled state
    document.getElementById('enabled').addEventListener('change', function() {
      const enabled = this.checked;
      chrome.storage.sync.set({ enabled: enabled });
      updateStatusText(enabled);
      
      // Notify content script about the change
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateFilter", enabled: enabled });
        }
      });
    });
  
    // Save settings
    document.getElementById('save').addEventListener('click', function() {
      const keywords = document.getElementById('keywords').value;
      const channels = document.getElementById('channels').value;
      const minViews = parseInt(document.getElementById('minViews').value) || 0;
      const enabled = document.getElementById('enabled').checked;
  
      chrome.storage.sync.set({
        enabled: enabled,
        keywords: keywords,
        channels: channels,
        minViews: minViews
      }, function() {
        // Display save confirmation
        const message = document.getElementById('message');
        message.textContent = 'Settings saved!';
        setTimeout(function() {
          message.textContent = '';
        }, 2000);
  
        // Notify content script about the changes
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0] && tabs[0].url.includes('youtube.com')) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: "updateFilter", 
              settings: {
                enabled: enabled,
                keywords: keywords,
                channels: channels,
                minViews: minViews
              }
            });
          }
        });
      });
    });
  
    function updateStatusText(enabled) {
      document.getElementById('status-text').textContent = enabled ? 'Filter is enabled' : 'Filter is disabled';
    }
  });