const SELECTORS = {
    HOME_FEED: 'ytd-rich-grid-renderer',
    SEARCH_RESULTS: 'ytd-search',
    VIDEO_ITEM: 'ytd-rich-item-renderer, ytd-video-renderer',
    VIDEO_TITLE: '#video-title',
    CHANNEL_NAME: '#channel-name a, #text-container .ytd-channel-name',
    VIEW_COUNT: '#metadata-line span:first-child',
    SPINNER: 'tp-yt-paper-spinner'
  };
  
  // Parse view count from strings like "1.2M views" to a number
  function parseViewCount(viewText) {
    if (!viewText) return 0;
    
    // Match numbers with abbreviations like K, M, B
    const match = viewText.match(/([0-9.]+)([KMB])?\s*views?/i);
    if (!match) return 0;
    
    let count = parseFloat(match[1]);
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
    
    return blockedKeywords.some(keyword => 
      title.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  
  // Check if channel is blocked
  function isChannelBlocked(channelName, blockedChannels) {
    if (!channelName || !blockedChannels || blockedChannels.length === 0) return false;
    
    return blockedChannels.some(channel => 
      channelName.toLowerCase().trim() === channel.toLowerCase().trim()
    );
  }
  
  // Trigger YouTube to load more content
  function triggerMoreContentLoad() {
    // Scroll to the bottom of the page
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for the spinner to appear and disappear
    const checkSpinner = setInterval(() => {
      const spinner = document.querySelector(SELECTORS.SPINNER);
      if (!spinner || spinner.style.display === 'none') {
        clearInterval(checkSpinner);
        // Re-run filter after new content is loaded
        setTimeout(filterYouTubeFeed, 1000);
      }
    }, 250);
  }
  
  // Main filter function
  function filterYouTubeFeed() {
    chrome.storage.sync.get(
      ['enabled', 'blockedKeywords', 'blockedChannels', 'minViewCount'], 
      function(settings) {
        if (!settings.enabled) return;
        
        // Convert string arrays to actual arrays if needed
        const blockedKeywords = Array.isArray(settings.blockedKeywords) 
          ? settings.blockedKeywords : [];
        const blockedChannels = Array.isArray(settings.blockedChannels) 
          ? settings.blockedChannels : [];
        const minViewCount = settings.minViewCount || 0;
        
        // Select all video items on the page
        const videoItems = document.querySelectorAll(SELECTORS.VIDEO_ITEM);
        
        let filteredCount = 0;
        let totalItems = videoItems.length;
        
        videoItems.forEach((item) => {
          // Skip if already processed
          if (item.dataset.filtered) return;
          
          // Extract video information
          const title = item.querySelector(SELECTORS.VIDEO_TITLE)?.textContent || '';
          const channelName = item.querySelector(SELECTORS.CHANNEL_NAME)?.textContent || '';
          const viewCountText = item.querySelector(SELECTORS.VIEW_COUNT)?.textContent || '';
          
          // Convert view count text to number
          const viewCount = parseViewCount(viewCountText);
          
          // Apply filters
          const shouldFilter = 
            isKeywordBlocked(title, blockedKeywords) || 
            isChannelBlocked(channelName, blockedChannels) ||
            (viewCount < minViewCount);
          
          if (shouldFilter) {
            // Hide the video item
            item.style.display = 'none';
            item.dataset.filtered = 'true';
            filteredCount++;
          } else {
            // Make sure visible items are displayed properly
            item.style.display = '';
            item.dataset.filtered = 'false';
          }
        });
        
        // If too many videos filtered, request more content
        if (filteredCount > 0 && filteredCount >= totalItems / 2) {
          triggerMoreContentLoad();
        }
      }
    );
  }
  
  // Initialize and run filter
  function initFilter() {
    // Run filter immediately
    filterYouTubeFeed();
    
    // Set up mutation observer to detect new videos
    const observer = new MutationObserver((mutations) => {
      let shouldFilter = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldFilter = true;
        }
      });
      
      if (shouldFilter) {
        filterYouTubeFeed();
      }
    });
    
    // Observe changes in the feed container
    const feedContainer = document.querySelector(SELECTORS.HOME_FEED) || 
                         document.querySelector(SELECTORS.SEARCH_RESULTS);
    
    if (feedContainer) {
      observer.observe(feedContainer, { 
        childList: true, 
        subtree: true 
      });
    }
    
    // Also filter when navigation happens within YouTube
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(filterYouTubeFeed, 1500); // Wait for content to load
      }
    }).observe(document, { subtree: true, childList: true });
  }
  
  // Run when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilter);
  } else {
    initFilter();
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'filterUpdated') {
      filterYouTubeFeed();
    }
  });