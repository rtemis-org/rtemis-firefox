// Move live tabs between regular, app, and fullscreen windows without reloading.
// spec: rtemis-firefox/page-windows#context-menu-actions
(() => {
  const returnAction = "return-to-regular-window";
  const actions = new Map([
    ["open-in-app-window", {
      title: "Open in app window", sourceTypes: ["normal"], type: "popup", state: "normal",
    }],
    ["open-in-full-screen", {
      title: "Open in full screen", sourceTypes: ["normal", "popup"], type: "popup", state: "fullscreen",
    }],
    [returnAction, {
      title: "Return to regular window", sourceTypes: ["popup"], type: "normal", state: "normal",
    }],
  ]);
  const pendingTabs = new Set();
  let menuInstance = 0;

  async function movePageToWindow(actionId, tab) {
    const action = actions.get(actionId);
    if (!action || !Number.isInteger(tab?.id) || tab.id < 0 || pendingTabs.has(tab.id)) return;

    pendingTabs.add(tab.id);
    try {
      const sourceWindow = await browser.windows.get(tab.windowId);
      if (!action.sourceTypes.includes(sourceWindow.type)) return;

      // Transfer the existing tab. Reopening its URL would discard web-app state.
      // App-to-fullscreen uses the same creation path as regular-to-fullscreen.
      await browser.windows.create({
        tabId: tab.id,
        type: action.type,
        state: action.state,
        incognito: sourceWindow.incognito,
      });
    } catch (error) {
      console.error(`Could not ${action.title.toLowerCase()}:`, error);
    } finally {
      pendingTabs.delete(tab.id);
    }
  }

  for (const [id, action] of actions) {
    browser.menus.create({
      id,
      title: action.title,
      contexts: ["page", "frame", "link", "selection", "editable", "image", "video", "audio"],
      visible: false,
    }, () => {
      if (browser.runtime.lastError) {
        console.error("Could not create the page-window menu:", browser.runtime.lastError);
      }
    });
  }

  browser.menus.onShown.addListener(async (_info, tab) => {
    const instance = ++menuInstance;
    try {
      const sourceWindow = Number.isInteger(tab?.windowId)
        ? await browser.windows.get(tab.windowId)
        : null;
      if (instance !== menuInstance) return;
      await Promise.all(Array.from(actions, ([id, action]) =>
        browser.menus.update(id, { visible: action.sourceTypes.includes(sourceWindow?.type) })
      ));
      if (instance === menuInstance) await browser.menus.refresh();
    } catch (error) {
      console.error("Could not update the page-window menu:", error);
    }
  });

  browser.menus.onHidden.addListener(() => { ++menuInstance; });

  browser.menus.onClicked.addListener((info, tab) => {
    return movePageToWindow(info.menuItemId, tab);
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === returnAction) return movePageToWindow(returnAction, tab);
  });
})();
