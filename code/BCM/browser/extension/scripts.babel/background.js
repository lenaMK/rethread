let lastTab = null;

const ws = new WebSocketClient();

function broadcast(event) {
  ws.send(event);
}
function sendCurrentUrl() {
  return new Promise((resolve) => {
    chrome.tabs.getSelected(null, function (tab) {
      resolve(tab);
    });
  });
}

chrome.tabs.onSelectionChanged.addListener(async (tabId) => {
  lastTab = await sendCurrentUrl();
  chrome.tabs.reload(lastTab.id);
  broadcast({
    event: "tab_changed",
    tab: lastTab,
    tab_id: tabId,
  });
});

// chrome.tabs.onActivated.addListener(async function (tabId) {
//   lastTab = await sendCurrentUrl();
//   broadcast({
//     event: "tab_changed",
//     tab: lastTab,
//     tab_id: tabId,
//   });
// });

chrome.tabs.onRemoved.addListener(function (tabId) {
  broadcast({
    event: "tab_closed",
    tab_id: tabId,
  });
});

chrome.windows.onRemoved.addListener(function (tabId) {
  broadcast({
    event: "window_closed",
    tab_id: tabId,
  });
});

chrome.webRequest.onBeforeRequest.addListener(
  async function (event) {
    if (event.initiator == null || event.initiator.indexOf("chrome-extension") == 0) {
      return;
    }
    if (event.type == "main_frame") {
      ga("send", "pageview", event.url);
    }
    lastTab = await sendCurrentUrl();
    if (event.requestBody && event.requestBody.raw) {
      let formData = event.requestBody.raw;
      var res = "";
      for (i = 0; i < formData.length; i++) {
        res =
          res +
          String.fromCharCode.apply(
            null,
            new Uint8Array(event.requestBody.raw[i].bytes)
          );
      }
      if (res.length > 0 && (res[0] == "[" || res[0] == "{")) {
        try {
          res = JSON.parse(res);
        } catch (error) {
          console.error("[ERROR] parsing form data");
        }
      }
      event.requestBody = res;
    }
    event.activeTab = event.tabId == lastTab.id;
    ga("send", "event", "request_created", event.type, event.url);
    broadcast({
      event: "request_created",
      request: event,
      current_tab: lastTab,
    });
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

var accessControlRequestHeaders;
var exposedHeaders;

chrome.webRequest.onCompleted.addListener(
  async function (event) {
    if (event.initiator == null || event.initiator.indexOf("chrome-extension") == 0) {
      return;
    }
    lastTab = await sendCurrentUrl();
    event.activeTab = event.tabId == lastTab.id;
    ga("send", "event", "request_completed", event.type, event.url);
    broadcast({
      event: "request_completed",
      request: event,
      current_tab: lastTab,
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

async function inactive() {
  chrome.tabs.getAllInWindow(null, (tabs) => {
    tabs = tabs.filter((tab) => tab.id > -1);
    const indexes = [];
    for (let tab of tabs) {
      console.log(tab);
      if (tab != tabs[0]) {
        indexes.push(tab.id);
      }
    }
    chrome.tabs.update(tabs[0].id, {
      url: "http://localhost:8873/button.html",
    });
    chrome.tabs.remove(indexes);
  });
}

ga("create", "UA-5954162-29", "auto");
ga("set", "checkProtocolTask", null);

var actionTimeout = null;
var isInactive = false;
function action() {
  clearTimeout(actionTimeout);
  if (isInactive) {
    broadcast({
      event: "idle",
      action: "active",
    });
    ga("send", "event", "idle", "active");
  }
  isInactive = false;
  actionTimeout = setTimeout(function () {
    isInactive = true;
    // inactive();
    broadcast({
      event: "idle",
      action: "inactive",
    });
    ga("send", "pageview", "home");
    ga("send", "event", "idle", "inactive");
  }, 60000);
}

chrome.runtime.onMessage.addListener(function (data, sender, sendResponse) {
  if (data.type == "action") {
    action();
  } else if (data.type == "home") {
    ga("send", "pageview", "/home");
    broadcast({
      event: "home",
      action: data.action,
    });
  } else {
    console.log(data);
  }
  return true;
});
