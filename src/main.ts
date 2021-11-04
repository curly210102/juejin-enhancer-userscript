const storageKey = "added_juejin_extension_";
type IExtension = {
  slug: string;
  version: string;
  code: string;
  url: string;
};

const isIExtension = (object: any): object is IExtension => {
  return (
    !!object &&
    typeof object["slug"] === "string" &&
    typeof object["version"] === "string" &&
    typeof object["code"] === "string" &&
    typeof object["url"] === "string"
  );
};

function initMenu() {
  GM_registerMenuCommand("扩展市场", () => {
    GM_openInTab("http://localhost:3000", {
      active: true,
    });
  });
}

initMenu();
if (location.host === "juejin.cn") {
  launchJuejin();
} else {
  launchMarketplace();
}

function launchMarketplace() {
  const saveToStorage = (
    name: string,
    extension: IExtension,
    isLocal?: boolean
  ) => {
    GM_setValue(storageKey + `${isLocal ? "local_" : ""}` + name, extension);
  };

  const removeFromStorage = (name: string) => {
    GM_deleteValue(storageKey + name);
  };

  const removeAllLocalExtensions = () => {
    try {
      const allLocalExtension = GM_listValues().filter((key) =>
        key.startsWith(storageKey + "local_")
      );
      allLocalExtension.forEach(GM_deleteValue);
      return "success";
    } catch (e) {
      return "error";
    }
  };

  const haveExtension = (name: string) => {
    return (
      GM_getValue(storageKey + name) ||
      GM_getValue(storageKey + "local_" + name)
    );
  };

  const fetchPlugin = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload({ status, response }) {
          if (status === 200) {
            try {
              resolve(response);
            } catch (error) {
              reject(error);
            }
          } else {
            reject("error");
          }
        },
        onerror(e) {
          reject("request_error");
        },
        onabort() {
          reject("aborted");
        },
      });
    });
  };

  unsafeWindow.onAddLocalJuejinExtension = (filePath, code) => {
    const extension = {
      slug: filePath,
      version: "0.0.0",
      code,
      url: filePath,
    };
    saveToStorage(filePath, extension, true);
  };

  unsafeWindow.onRemoveLocalJuejinExtension = () => {
    removeAllLocalExtensions();
  };

  unsafeWindow.onAddJuejinExtension = (slug, { url, version }) => {
    return fetchPlugin(url).then((code) => {
      saveToStorage(slug, {
        slug,
        version,
        code,
        url,
      });
      return "success";
    });
  };

  unsafeWindow.onRemoveJuejinExtension = (slug) => {
    return new Promise((resolve, reject) => {
      try {
        removeFromStorage(slug);
        resolve("success");
      } catch (e) {
        reject("error");
      }
    });
  };

  unsafeWindow.checkJuejinExtensionIsAdded = (slug) => {
    return Boolean(haveExtension(slug));
  };
}

function launchJuejin() {
  const plugins = restoreFromStorage();
  plugins.forEach(({ plugin }) => {
    plugin?.onLoaded?.();
  });
  initRouter();

  function restoreFromStorage() {
    const allStoragePlugins = GM_listValues().filter((key) =>
      key.startsWith(storageKey)
    );

    return allStoragePlugins
      .map((key) => GM_getValue<IExtension | null>(key, null))
      .filter(isIExtension)
      .map(({ slug, code }) => {
        return executePlugin(slug, code);
      })
      .filter(({ plugin }) => {
        return plugin && !plugin.isOffShelf;
      });
  }

  function executePlugin(name: string, code: string) {
    const plugin = eval(code);
    return {
      name,
      plugin,
    };
  }

  function initRouter() {
    let currentRouterPathname = "";
    function onRouteChange() {
      const prevRouterPathname = currentRouterPathname;
      currentRouterPathname = document.location.pathname;

      if (prevRouterPathname !== currentRouterPathname) {
        plugins.forEach(({ plugin }) => {
          plugin?.onRouteChange?.(prevRouterPathname, currentRouterPathname);
        });
      }
    }

    const _historyPushState = history.pushState;
    const _historyReplaceState = history.replaceState;
    history.pushState = function (...rest) {
      _historyPushState.apply(history, rest);
      onRouteChange();
    };
    history.replaceState = function (...rest) {
      _historyReplaceState.apply(history, rest);
      onRouteChange();
    };
    window.addEventListener("popstate", function () {
      onRouteChange();
    });
  }
}
