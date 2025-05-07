// content.js
// YouTube video selectors
const SELECTORS = {
    // Home feed items
    HOME_FEED_ITEMS: 'ytd-rich-grid-media, ytd-rich-item-renderer, ytd-grid-video-renderer',
    // Search results and recommendation items
    SEARCH_ITEMS: 'ytd-video-renderer',
    // Watch page recommendations
    WATCH_ITEMS: 'ytd-compact-video-renderer',
    // Channel page videos
    CHANNEL_ITEMS: 'ytd-grid-video-renderer',
    // Shorts
    SHORTS_ITEMS: 'ytd-reel-item-renderer',
    // Common elements within video items
    VIDEO_TITLE: '#video-title, #title-wrapper',
    CHANNEL_NAME: '#channel-name, #text-container .ytd-channel-name, .ytd-channel-name a, #byline-container',
    VIEW_COUNT: '#metadata-line span:first-child, .ytd-video-meta-block span:first-child',
    // YouTube containers
    CONTENT_CONTAINER: '#contents, #items'
  };
  
  // Global state
  let filteredCount = 0;
  let totalVideos = 0;
  let optionsVisible = false;
  
  // Initialize the extension elements
  function initializeUI() {
    // Add filter counter
    const counterElement = document.createElement('div');
    counterElement.className = 'yt-filter-counter';
    counterElement.innerHTML = 'Filtered: 0 videos';
    document.body.appendChild(counterElement);
    
    // Add filter button
    const filterButton = document.createElement('button');
    filterButton.className = 'yt-filter-btn';
    filterButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
      Filter Options
    `;
    filterButton.addEventListener('click', toggleOptionsPanel);
    document.body.appendChild(filterButton);
    
    // Add options panel
    const optionsPanel = document.createElement('div');
    optionsPanel.className = 'yt-filter-options';
    optionsPanel.style.display = 'none';
    
    chrome.storage.sync.get(['enabled', 'hideFiltered'], function(settings) {
      optionsPanel.innerHTML = `
        <div class="yt-filter-toggle">
          <span>Enable Filtering</span>
          <label class="yt-filter-switch">
            <input type="checkbox" id="yt-filter-enabled" ${settings.enabled ? 'checked' : ''}>
            <span class="yt-filter-slider"></span>
          </label>
        </div>
        <div class="yt-filter-toggle">
          <span>Hide Filtered Videos</span>
          <label class="yt-filter-switch">
            <input type="checkbox" id="yt-filter-hide" ${settings.hideFiltered ? 'checked' : ''}>
            <span class="yt-filter-slider"></span>
          </label>
        </div>
        <button id="yt-filter-settings" class="yt-filter-restore">Open Full Settings</button>
      `;
      document.body.appendChild(optionsPanel);
      
      // Set up event listeners for the toggles
      document.getElementById('yt-filter-enabled').addEventListener('change', function(e) {
        chrome.storage.sync.set({ enabled: e.target.checked }, function() {
          applyFilters();
        });
      });
      
      document.getElementById('yt-filter-hide').addEventListener('change', function(e) {
        chrome.storage.sync.set({ hideFiltered: e.target.checked }, function() {
          applyFilters();
        });
      });
      
      document.getElementById('yt-filter-settings').addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'openPopup' });
      });
    });
  }
  
  // Toggle the options panel visibility
  function toggleOptionsPanel() {
    const optionsPanel = document.querySelector('.yt-filter-options');
    optionsVisible = !optionsVisible;
    optionsPanel.style.display = optionsVisible ? 'flex' : 'none';
  }
  
  // Parse view count from strings like "1.2M views" to a number
  function parseViewCount(viewText) {
    if (!viewText) return 0;
    
    // Match numbers with abbreviations like K, M, B
    // Support different formats like "1.2M views", "1,200 views", "1.2M", etc.
    const match = viewText.match(/([0-9.,]+)([KMB])?\s*views?/i);
    if (!match) return 0;
    
    let count = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2] ? match[2].toUpperCase() : '';
    
    // Convert to actual number
    if (multiplier === 'K') count *= 1000;
    else if (multiplier === 'M') count *= 1000000;
    else if (multiplier === 'B') count *= 1000000000;
    
    return count;
  }
  
  // Check if title contains any blocked keyword
  function isKeywordBlocked(title, blockedKeywords) {
    if (!title || !blockedKeywords || blockedKeywords.length === 0) return false;
    
    return blockedKeywords.some(keyword => {
      // Handle empty keywords
      if (!keyword.trim()) return false;
      // Case-insensitive match
      return title.toLowerCase().includes(keyword.toLowerCase());
    });
  }
  
  // Check if channel is blocked
  function isChannelBlocked(channelName, blockedChannels) {
    if (!channelName || !blockedChannels || blockedChannels.length === 0) return false;
    
    return blockedChannels.some(channel => {
      // Handle empty channel names
      if (!channel.trim()) return false;
      // Case-insensitive match
      return channelName.toLowerCase().trim() === channel.toLowerCase().trim();
    });
  }
  
  // Get all video elements on the page
  function getAllVideoElements() {
    const selectors = [
      SELECTORS.HOME_FEED_ITEMS,
      SELECTORS.SEARCH_ITEMS,
      SELECTORS.WATCH_ITEMS,
      SELECTORS.CHANNEL_ITEMS,
      SELECTORS.SHORTS_ITEMS
    ];
    
    return document.querySelectorAll(selectors.join(', '));
  }
  
  // Apply filters to all videos on the page
  function applyFilters() {
    chrome.storage.sync.get(
      ['enabled', 'hideFiltered', 'blockedKeywords', 'blockedChannels', 'minViewCount'],
      function(settings) {
        if (!settings.enabled) {
          resetFilters();
          return;
        }
        
        // Convert string arrays to actual arrays if needed
        const blockedKeywords = Array.isArray(settings.blockedKeywords) 
          ? settings.blockedKeywords : [];
        const blockedChannels = Array.isArray(settings.blockedChannels) 
          ? settings.blockedChannels : [];
        const minViewCount = settings.minViewCount || 0;
        const hideFiltered = settings.hideFiltered || false;
        
        // Get all video elements
        const videoElements = getAllVideoElements();
        
        filteredCount = 0;
        totalVideos = videoElements.length;
        
        // Process each video element
        videoElements.forEach(videoElement => {
          // Check if this video container has already been processed
          if (videoElement.getAttribute('data-yt-filter-processed') === 'true') {
            // Update existing element if filter status changed
            const wasFiltered = videoElement.getAttribute('data-yt-filter-status') === 'filtered';
            const overlay = videoElement.querySelector('.yt-filter-overlay');
            
            if (wasFiltered) {
              filteredCount++;
              if (hideFiltered) {
                videoElement.classList.add('hidden-filter');
                if (overlay) overlay.style.display = 'none';
              } else {
                videoElement.classList.remove('hidden-filter');
                videoElement.classList.add('dimmed-filter');
                if (overlay) overlay.style.display = 'flex';
              }
            }
            return;
          }
          
          // Mark as processed
          videoElement.setAttribute('data-yt-filter-processed', 'true');
          
          // Extract video data
          const titleElement = videoElement.querySelector(SELECTORS.VIDEO_TITLE);
          const channelElement = videoElement.querySelector(SELECTORS.CHANNEL_NAME);
          const viewCountElement = videoElement.querySelector(SELECTORS.VIEW_COUNT);
          
          const title = titleElement ? titleElement.textContent.trim() : '';
          const channelName = channelElement ? channelElement.textContent.trim() : '';
          const viewCountText = viewCountElement ? viewCountElement.textContent.trim() : '';
          const viewCount = parseViewCount(viewCountText);
          
          // Apply filters
          let filterReason = '';
          if (isKeywordBlocked(title, blockedKeywords)) {
            filterReason = 'Blocked keyword';
          } else if (isChannelBlocked(channelName, blockedChannels)) {
            filterReason = 'Blocked channel';
          } else if (viewCount > 0 && viewCount < minViewCount) {
            filterReason = `Low views (${viewCountText})`;
          }
          
          const isFiltered = !!filterReason;
          
          // Mark filter status
          videoElement.setAttribute('data-yt-filter-status', isFiltered ? 'filtered' : 'normal');
          
          // Apply visual effects
          if (isFiltered) {
            filteredCount++;
            
            // Position relative for overlay
            if (window.getComputedStyle(videoElement).position === 'static') {
              videoElement.style.position = 'relative';
            }
            
            // Add filter overlay
            const overlay = document.createElement('div');
            overlay.className = 'yt-filter-overlay';
            overlay.innerHTML = `
              <div class="yt-filter-reason">${filterReason}</div>
              <button class="yt-filter-restore">Show Anyway</button>
            `;
            videoElement.appendChild(overlay);
            
            // Add event listener to restore button
            const restoreButton = overlay.querySelector('.yt-filter-restore');
            restoreButton.addEventListener('click', function() {
              videoElement.setAttribute('data-yt-filter-status', 'normal');
              videoElement.classList.remove('dimmed-filter', 'hidden-filter');
              overlay.style.display = 'none';
              filteredCount--;
              updateFilterCounter();
            });
            
            if (hideFiltered) {
              videoElement.classList.add('hidden-filter');
              overlay.style.display = 'none';
            } else {
              videoElement.classList.add('dimmed-filter');
            }
          }
        });
        
        // Update counter
        updateFilterCounter();
      }
    );
  }
  
  // Reset all filters
  function resetFilters() {
    const videoElements = getAllVideoElements();
    
    videoElements.forEach(videoElement => {
      videoElement.classList.remove('dimmed-filter', 'hidden-filter');
      videoElement.removeAttribute('data-yt-filter-status');
      
      const overlay = videoElement.querySelector('.yt-filter-overlay');
      if (overlay) {
        overlay.remove();
      }
    });
    
    filteredCount = 0;
    updateFilterCounter();
  }
  
  // Update the filter counter
  function updateFilterCounter() {
    const counterElement = document.querySelector('.yt-filter-counter');
    if (!counterElement) return;
    
    if (filteredCount > 0) {
      counterElement.textContent = `Filtered: ${filteredCount} videos`;
      counterElement.style.display = 'block';
    } else {
      counterElement.style.display = 'none';
    }
  }
  
  // Set up mutation observer to detect new videos
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let newContent = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if it's a video element or contains video elements
              if (node.matches && 
                  (node.matches(Object.values(SELECTORS).join(', ')) || 
                   node.querySelector(Object.values(SELECTORS).join(', ')))) {
                newContent = true;
                break;
              }
            }
          }
        }
      });
      
      if (newContent) {
        setTimeout(applyFilters, 100); // Short delay to ensure DOM is ready
      }
    });
    
    // Observe the entire document for now
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also handle URL changes
    let lastUrl = location.href;
    
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => {
          applyFilters();
        }, 1000); // Wait for page to load
      }
    });
    
    urlObserver.observe(document.querySelector('head > title'), {
      subtree: true,
      characterData: true
    });
  }
  
  // Initialize the extension
  function init() {
    // Add UI elements
    initializeUI();
    
    // Apply filters
    applyFilters();
    
    // Set up observer
    setupObserver();
  }
  
  // Run the extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'filterUpdated') {
      applyFilters();
    }
  });