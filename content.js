// content.js
// YouTube video selectors - Updated for current YouTube DOM
const SELECTORS = {
    // Home feed items
    HOME_FEED_ITEMS: 'ytd-rich-item-renderer, ytd-grid-video-renderer',
    // Search results
    SEARCH_ITEMS: 'ytd-video-renderer',
    // Watch page recommendations
    WATCH_ITEMS: 'ytd-compact-video-renderer',
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
  
  // Add filter counter element
  function addFilterCounter() {
    const counterElement = document.createElement('div');
    counterElement.className = 'yt-filter-counter';
    counterElement.innerHTML = 'Filtered: 0 videos';
    counterElement.style.position = 'fixed';
    counterElement.style.bottom = '20px';
    counterElement.style.right = '20px';
    counterElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    counterElement.style.color = 'white';
    counterElement.style.padding = '8px 12px';
    counterElement.style.borderRadius = '4px';
    counterElement.style.fontFamily = 'Roboto, Arial, sans-serif';
    counterElement.style.fontSize = '14px';
    counterElement.style.zIndex = '9999';
    counterElement.style.display = 'none';
    document.body.appendChild(counterElement);
  }
  
  // Parse view count from strings like "1.2M views" to a number
  function parseViewCount(viewText) {
    if (!viewText) return 0;
    
    // Clean the text first (sometimes it contains non-breaking spaces or other characters)
    const cleanText = viewText.replace(/\s+/g, ' ').trim();
    
    // Match numbers with abbreviations like K, M, B
    // Support different formats like "1.2M views", "1,200 views", "1.2M", etc.
    const match = cleanText.match(/([0-9.,]+)([KMB])?\s*views?/i);
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
    
    const titleLower = title.toLowerCase();
    return blockedKeywords.some(keyword => {
      // Handle empty keywords
      if (!keyword.trim()) return false;
      // Case-insensitive match
      return titleLower.includes(keyword.toLowerCase());
    });
  }
  
  // Check if channel is blocked
  function isChannelBlocked(channelName, blockedChannels) {
    if (!channelName || !blockedChannels || blockedChannels.length === 0) return false;
    
    const channelLower = channelName.toLowerCase().trim();
    return blockedChannels.some(channel => {
      // Handle empty channel names
      if (!channel.trim()) return false;
      // Case-insensitive match
      return channelLower === channel.toLowerCase().trim();
    });
  }
  
  // Get all video elements on the page
  function getAllVideoElements() {
    const selectors = [
      SELECTORS.HOME_FEED_ITEMS,
      SELECTORS.SEARCH_ITEMS,
      SELECTORS.WATCH_ITEMS,
      SELECTORS.SHORTS_ITEMS
    ];
    
    return document.querySelectorAll(selectors.join(', '));
  }
  
  // Apply filters to all videos on the page
  function applyFilters() {
    console.log("YouTube Filter: Applying filters...");
    
    chrome.storage.sync.get(
      ['enabled', 'hideFiltered', 'blockedKeywords', 'blockedChannels', 'minViewCount'],
      function(settings) {
        console.log("YouTube Filter: Got settings", settings);
        
        if (!settings.enabled) {
          resetFilters();
          return;
        }
        
        // Convert string arrays to actual arrays if needed
        const blockedKeywords = Array.isArray(settings.blockedKeywords) 
          ? settings.blockedKeywords : [];
        const blockedChannels = Array.isArray(settings.blockedChannels) 
          ? settings.blockedChannels : [];
        const minViewCount = Number(settings.minViewCount) || 0;
        const hideFiltered = settings.hideFiltered || false;
        
        console.log("YouTube Filter: Using keywords:", blockedKeywords);
        console.log("YouTube Filter: Using channels:", blockedChannels);
        console.log("YouTube Filter: Min views:", minViewCount);
        
        // Get all video elements
        const videoElements = getAllVideoElements();
        console.log("YouTube Filter: Found", videoElements.length, "video elements");
        
        filteredCount = 0;
        totalVideos = videoElements.length;
        
        // Process each video element
        videoElements.forEach((videoElement, index) => {
          // Remove any existing overlays
          const existingOverlay = videoElement.querySelector('.yt-filter-overlay');
          if (existingOverlay) {
            existingOverlay.remove();
          }
          
          // Reset classes
          videoElement.classList.remove('dimmed-filter', 'hidden-filter');
          
          // Extract video data
          const titleElement = videoElement.querySelector(SELECTORS.VIDEO_TITLE);
          const channelElement = videoElement.querySelector(SELECTORS.CHANNEL_NAME);
          const viewCountElement = videoElement.querySelector(SELECTORS.VIEW_COUNT);
          
          const title = titleElement ? titleElement.textContent.trim() : '';
          const channelName = channelElement ? channelElement.textContent.trim() : '';
          const viewCountText = viewCountElement ? viewCountElement.textContent.trim() : '';
          const viewCount = parseViewCount(viewCountText);
          
          // Debug specific video
          if (index === 0) {
            console.log("YouTube Filter: Example video data:", {
              title,
              channelName,
              viewCountText,
              viewCount
            });
          }
          
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
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            overlay.style.zIndex = '5';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.color = 'white';
            overlay.style.textAlign = 'center';
            overlay.style.padding = '10px';
            overlay.style.fontFamily = 'Roboto, Arial, sans-serif';
            
            overlay.innerHTML = `
              <div class="yt-filter-reason" style="font-size: 14px; margin-bottom: 5px;">${filterReason}</div>
              <button class="yt-filter-restore" style="background-color: #3ea6ff; color: black; border: none; border-radius: 2px; padding: 6px 12px; font-size: 14px; cursor: pointer; margin-top: 8px;">Show Anyway</button>
            `;
            videoElement.appendChild(overlay);
            
            // Add event listener to restore button
            const restoreButton = overlay.querySelector('.yt-filter-restore');
            restoreButton.addEventListener('click', function(e) {
              e.stopPropagation(); // Prevent clicking through to the video
              videoElement.classList.remove('dimmed-filter', 'hidden-filter');
              overlay.style.display = 'none';
              filteredCount--;
              updateFilterCounter();
            });
            
            if (hideFiltered) {
              videoElement.classList.add('hidden-filter');
              videoElement.style.display = 'none';
            } else {
              videoElement.classList.add('dimmed-filter');
              videoElement.style.opacity = '0.3';
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
      videoElement.style.opacity = '';
      videoElement.style.display = ''; // Restore original display value
      
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
      let shouldFilter = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if any selectors match this node or its children
              const selectors = [
                SELECTORS.HOME_FEED_ITEMS,
                SELECTORS.SEARCH_ITEMS, 
                SELECTORS.WATCH_ITEMS,
                SELECTORS.SHORTS_ITEMS
              ];
              
              for (const selector of selectors) {
                if ((node.matches && node.matches(selector)) || 
                    (node.querySelector && node.querySelector(selector))) {
                  shouldFilter = true;
                  break;
                }
              }
              
              if (shouldFilter) break;
            }
          }
        }
      });
      
      if (shouldFilter) {
        console.log("YouTube Filter: New content detected, reapplying filters");
        setTimeout(applyFilters, 200); // Short delay to ensure DOM is ready
      }
    });
    
    // Start observing critical YouTube containers
    const contentContainers = document.querySelectorAll(SELECTORS.CONTENT_CONTAINER);
    if (contentContainers.length > 0) {
      console.log("YouTube Filter: Setting up observer on content containers:", contentContainers.length);
      contentContainers.forEach(container => {
        observer.observe(container, {
          childList: true,
          subtree: true
        });
      });
    } else {
      // Fallback to observing the body
      console.log("YouTube Filter: No content containers found, observing body");
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    // Also handle URL changes (YouTube is a SPA)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        console.log("YouTube Filter: URL changed from", lastUrl, "to", location.href);
        lastUrl = location.href;
        
        // Wait for the new page to load
        setTimeout(() => {
          // Re-setup the observer for new content containers
          const newContainers = document.querySelectorAll(SELECTORS.CONTENT_CONTAINER);
          if (newContainers.length > 0) {
            console.log("YouTube Filter: Re-setting up observer on new containers");
            observer.disconnect();
            newContainers.forEach(container => {
              observer.observe(container, {
                childList: true,
                subtree: true
              });
            });
          }
          
          // Apply filters to the new page
          applyFilters();
        }, 1000);
      }
    });
    
    // Observe title changes which may indicate page navigation
    const titleElement = document.querySelector('head > title');
    if (titleElement) {
      urlObserver.observe(titleElement, {
        subtree: true,
        characterData: true
      });
    }
  }
  
  // Initialize the extension
  function init() {
    console.log("YouTube Feed Filter: Initializing...");
    
    // Add UI elements
    addFilterCounter();
    
    // Apply filters
    applyFilters();
    
    // Set up observer
    setupObserver();
    
    // Re-apply filters periodically for safety
    setInterval(applyFilters, 10000);
  }
  
  // Run the extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message) => {
    console.log("YouTube Filter: Received message", message);
    if (message.action === 'filterUpdated') {
      applyFilters();
    } else if (message.action === 'toggleVisibility') {
      chrome.storage.sync.get(['hideFiltered'], function(settings) {
        // Toggle the setting
        const newSetting = !settings.hideFiltered;
        chrome.storage.sync.set({ hideFiltered: newSetting }, function() {
          applyFilters();
        });
      });
    }
  });