let settings = {
    enabled: true,
    keywords: '',
    channels: '',
    minViews: 0
  };
  
  // Load settings on initialization
  chrome.storage.sync.get({
    enabled: true,
    keywords: '',
    channels: '',
    minViews: 0
  }, function(items) {
    settings = items;
    applyFilters();
  });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateFilter") {
      if (message.settings) {
        settings = message.settings;
      } else if (message.hasOwnProperty('enabled')) {
        settings.enabled = message.enabled;
      }
      applyFilters();
    }
    return true;
  });
  
  // Watch for page changes (YouTube is a SPA)
  const observer = new MutationObserver(mutations => {
    // Only process if filter is enabled
    if (settings.enabled) {
      applyFilters();
    }
  });
  
  // Start observing changes to the DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  function applyFilters() {
    // Skip if filter is disabled
    if (!settings.enabled) {
      showAllVideos();
      return;
    }
  
    // Get all video elements on the page
    const videoElements = getVideoElements();
    
    // Process each video element
    videoElements.forEach(videoElement => {
      processVideoElement(videoElement);
    });
  }
  
  function getVideoElements() {
    // Get video elements based on the current page
    const url = window.location.href;
    let videoElements = [];
    
    if (url.includes('/results')) {
      // Search results page
      videoElements = document.querySelectorAll('ytd-video-renderer');
    } else if (url.includes('/watch')) {
      // Watch page - recommended videos
      videoElements = document.querySelectorAll('ytd-compact-video-renderer');
    } else {
      // Home page and other pages
      videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');
    }
    
    return videoElements;
  }
  
  function processVideoElement(videoElement) {
    // Skip if the element was already processed
    if (videoElement.dataset.processed === 'true') {
      return;
    }
    
    // Get video info
    const videoInfo = extractVideoInfo(videoElement);
    
    // Skip if we couldn't extract the info
    if (!videoInfo) {
      return;
    }
    
    // Check if the video should be filtered
    const shouldFilter = checkFilter(videoInfo);
    
    // Apply filtering
    if (shouldFilter) {
      hideVideo(videoElement);
    } else {
      showVideo(videoElement);
    }
    
    // Mark as processed
    videoElement.dataset.processed = 'true';
  }
  
  function extractVideoInfo(videoElement) {
    try {
      const titleElement = videoElement.querySelector('#video-title, #title-wrapper #title');
      const channelElement = videoElement.querySelector('#channel-name a, #text-container #text.ytd-channel-name a');
      const viewCountElement = videoElement.querySelector('#metadata-line span:first-child, #metadata span.ytd-video-meta-block:first-child');
      
      if (!titleElement || !channelElement) {
        return null;
      }
      
      const title = titleElement.textContent.trim();
      const channel = channelElement.textContent.trim();
      let viewCount = 0;
      
      if (viewCountElement) {
        const viewText = viewCountElement.textContent.trim();
        viewCount = parseViewCount(viewText);
      }
      
      return {
        title,
        channel,
        viewCount
      };
    } catch (error) {
      console.error('Error extracting video info:', error);
      return null;
    }
  }
  
  function parseViewCount(viewText) {
    try {
      if (!viewText.includes('view')) {
        return 0;
      }
      
      // Remove "views" and possible commas, then parse number
      let count = viewText.split(' ')[0].replace(/,/g, '');
      
      // Handle K, M, B suffixes
      if (count.includes('K')) {
        count = parseFloat(count.replace('K', '')) * 1000;
      } else if (count.includes('M')) {
        count = parseFloat(count.replace('M', '')) * 1000000;
      } else if (count.includes('B')) {
        count = parseFloat(count.replace('B', '')) * 1000000000;
      } else {
        count = parseInt(count);
      }
      
      return count || 0;
    } catch (error) {
      console.error('Error parsing view count:', error);
      return 0;
    }
  }
  
  function checkFilter(videoInfo) {
    // Check if the video should be filtered based on settings
    
    // Check keywords
    if (settings.keywords) {
      const keywordList = settings.keywords.split('\n').map(k => k.trim().toLowerCase()).filter(k => k);
      if (keywordList.some(keyword => videoInfo.title.toLowerCase().includes(keyword))) {
        return true;
      }
    }
    
    // Check channels
    if (settings.channels) {
      const channelList = settings.channels.split('\n').map(c => c.trim().toLowerCase()).filter(c => c);
      if (channelList.some(channel => videoInfo.channel.toLowerCase() === channel)) {
        return true;
      }
    }
    
    // Check view count
    if (settings.minViews > 0 && videoInfo.viewCount < settings.minViews) {
      return true;
    }
    
    // Don't filter if none of the conditions match
    return false;
  }
  
  function hideVideo(videoElement) {
    videoElement.style.display = 'none';
  }
  
  function showVideo(videoElement) {
    videoElement.style.display = '';
  }
  
  function showAllVideos() {
    // Show all videos when filter is disabled
    const allVideos = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer');
    allVideos.forEach(video => {
      video.style.display = '';
      // Reset processed flag so videos can be reprocessed when filter is enabled again
      delete video.dataset.processed;
    });
  }