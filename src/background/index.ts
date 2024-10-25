chrome.runtime.onInstalled.addListener(async (opt) => {
  if (opt.reason === 'install') {
    await chrome.storage.local.clear()

    chrome.tabs.create({
      active: true,
      url: chrome.runtime.getURL('src/setup/index.html?type=install'),
    })
  }

  if (opt.reason === 'update') {
    chrome.tabs.create({
      active: true,
      url: chrome.runtime.getURL('src/setup/index.html?type=update'),
    })
  }
})

// Logic for activating the icon on allowed sites
const allowedUrls: string[] = ["dribbble.com"];

// Listen to tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // Check if the URL is on the allowed list
    const isAllowed: boolean = allowedUrls.some((url: string) => tab?.url?.includes(url));

    // Set the icon activity
    setIconState(tabId, isAllowed);

    // remove data from storage when url was changed
    if (tab.url && isAllowed) {
      chrome.storage.local.set({
        dealData: null,
        notesData: null,
        tempNoteData: null,
        // selectLists: null,
        // expiration: null,
      });
    }
  }
});

// Listen to the activation of the tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    const isAllowed: boolean = allowedUrls.some((url: string) => tab?.url?.includes(url));

    setIconState(activeInfo.tabId, isAllowed);
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // fetch data for lists and save it in storage with timestamp which expires at midnight
  if (request.action === 'fetchLists') {
    chrome.storage.local.get(['selectLists', 'expiration'], (result) => {
      if (result.expiration && result.expiration > Date.now()) {
        sendResponse({
          success: true,
          data: result.selectLists
        });

      } else {
        fetch(`${import.meta.env.VITE_API_URL}/properties`)
          .then(response => response.json())
          .then(data => {
            data.gender = [
              {label: 'Male', value: 'male'},
              {label: 'Female', value: 'female'}
            ]

            chrome.storage.local.set({
              selectLists: data,
              expiration: getExpirationTimestamp()
            }, () => {
              sendResponse({
                success: true,
                data
              });
            });
          })
          .catch(error => {
            sendResponse({
              success: false,
              error: error.message
            });
          });
      }
    });

    return true;
  }
});

// Function to change the icon
function setIconState(tabId: number, isAllowed: boolean) {
  chrome.action.setIcon({
    path: {
      "16": isAllowed ? "icons/16.png" : "icons/16-inactive.png",
      "32": isAllowed ? "icons/32.png" : "icons/32-inactive.png",
      "48": isAllowed ? "icons/48.png" : "icons/48-inactive.png",
      "128": isAllowed ? "icons/128.png" : "icons/128-inactive.png"
    },
    tabId: tabId
  });

  // Activate or deactivate the icon depending on the site
  if (isAllowed) {
    chrome.action.enable(tabId);
  } else {
    chrome.action.disable(tabId);
  }
}

// Function to get expiration time at midnight
function getExpirationTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const expirationTime = tomorrow.getTime() - now.getTime();
  return Date.now() + expirationTime;
}

// Global error handler
self.onerror = function (message, source, lineno, colno, error) {
  console.info(
    `Error: ${message}\nSource: ${source}\nLine: ${lineno}\nColumn: ${colno}\nError object: ${error}`
  )
}

export {}
