document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    chrome.storage.sync.get(
      ['enabled', 'hideFiltered', 'blockedKeywords', 'blockedChannels', 'minViewCount'],
      function(settings) {
        // Set enabled state
        document.getElementById('enabled').checked = settings.enabled !== false;
        document.getElementById('hide-filtered').checked = settings.hideFiltered === true;
        
        // Set minimum view count
        const minViewsInput = document.getElementById('min-views');
        const viewSlider = document.getElementById('view-slider');
        minViewsInput.value = settings.minViewCount || 0;
        viewSlider.value = settings.minViewCount || 0;
        
        // Update view count display
        updateViewCountDisplay();
        
        // Render keyword tags
        if (Array.isArray(settings.blockedKeywords)) {
          settings.blockedKeywords.forEach(keyword => {
            if (keyword.trim()) {
              addTag('keyword', keyword);
            }
          });
        }
        
        // Render channel tags
        if (Array.isArray(settings.blockedChannels)) {
          settings.blockedChannels.forEach(channel => {
            if (channel.trim()) {
              addTag('channel', channel);
            }
          });
        }
      }
    );
    
    // Function to format view count for display
    function formatViewCount(count) {
      if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M';
      } else if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'K';
      } else {
        return count;
      }
    }
    
    // Update view count display
    function updateViewCountDisplay() {
      const value = document.getElementById('view-slider').value;
      document.getElementById('view-count-display').textContent = formatViewCount(parseInt(value));
    }
    
    // Sync number input and slider
    const minViewsInput = document.getElementById('min-views');
    const viewSlider = document.getElementById('view-slider');
    
    minViewsInput.addEventListener('input', function() {
      viewSlider.value = this.value;
      updateViewCountDisplay();
    });
    
    viewSlider.addEventListener('input', function() {
      minViewsInput.value = this.value;
      updateViewCountDisplay();
    });
    
    // Handle view preset clicks
    document.querySelectorAll('.view-preset').forEach(preset => {
      preset.addEventListener('click', function() {
        const value = this.dataset.value;
        minViewsInput.value = value;
        viewSlider.value = value;
        updateViewCountDisplay();
      });
    });
    
    // Add keyword
    document.getElementById('add-keyword').addEventListener('click', function() {
      const input = document.getElementById('keyword-input');
      const keyword = input.value.trim();
      
      if (keyword) {
        addTag('keyword', keyword);
        input.value = '';
        input.focus();
      }
    });
    
    // Add channel
    document.getElementById('add-channel').addEventListener('click', function() {
      const input = document.getElementById('channel-input');
      const channel = input.value.trim();
      
      if (channel) {
        addTag('channel', channel);
        input.value = '';
        input.focus();
      }
    });
    
    // Handle enter key
    document.getElementById('keyword-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('add-keyword').click();
      }
    });
    
    document.getElementById('channel-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('add-channel').click();
      }
    });
    
    // Save settings
    document.getElementById('save-settings').addEventListener('click', function() {
      saveSettings();
    });
    
    // Function to save settings
    function saveSettings() {
      const enabled = document.getElementById('enabled').checked;
      const hideFiltered = document.getElementById('hide-filtered').checked;
      const minViewCount = parseInt(document.getElementById('min-views').value) || 0;
      
      // Get all keywords
      const keywordTags = document.querySelectorAll('#keyword-tags .tag span');
      const blockedKeywords = Array.from(keywordTags).map(tag => tag.textContent);
      
      // Get all channels
      const channelTags = document.querySelectorAll('#channel-tags .tag span');
      const blockedChannels = Array.from(channelTags).map(tag => tag.textContent);
      
      // Save to storage
      chrome.storage.sync.set({
        enabled,
        hideFiltered,
        blockedKeywords,
        blockedChannels,
        minViewCount
      }, function() {
        // Notify content script of update
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0].url.includes('youtube.com')) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'filterUpdated'});
          }
        });
        
        // Show saved message
        const saveBtn = document.getElementById('save-settings');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveBtn.textContent = originalText;
        }, 1500);
      });
    }
    
    // Toggle option to hide or dim filtered videos
    document.getElementById('hide-filtered').addEventListener('change', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleVisibility'});
        }
      });
    });
    
    // Toggle enabled state
    document.getElementById('enabled').addEventListener('change', function() {
      saveSettings();
    });
    
    // Add tag to the UI
    function addTag(type, value) {
      const container = document.getElementById(`${type}-tags`);
      
      // Check if tag already exists
      const existingTags = container.querySelectorAll('.tag span');
      for (const tag of existingTags) {
        if (tag.textContent.toLowerCase() === value.toLowerCase()) {
          return; // Tag already exists
        }
      }
      
      // Create new tag
      const tag = document.createElement('div');
      tag.className = 'tag';
      
      const span = document.createElement('span');
      span.textContent = value;
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function() {
        container.removeChild(tag);
        saveSettings(); // Auto-save when removing tags
      });
      
      tag.appendChild(span);
      tag.appendChild(removeBtn);
      container.appendChild(tag);
    }
    
    // Apply filters button - immediately refresh and apply
    document.getElementById('refresh-page').addEventListener('click', function() {
      saveSettings();
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('youtube.com')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  });