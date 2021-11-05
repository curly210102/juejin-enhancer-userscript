const extStoragePrefix = "added_juejin_extension_";
// const marketplaceURL = "http://localhost:3000";
const marketplaceURL = "https://juejin-enhancer-extensions.vercel.app";

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

const saveToStorage = (
  name: string,
  extension: IExtension,
  isLocal?: boolean
) => {
  GM_setValue(
    extStoragePrefix + `${isLocal ? "local_" : ""}` + name,
    extension
  );
};

const removeFromStorage = (name: string) => {
  GM_deleteValue(extStoragePrefix + name);
};

const removeAllLocalExtensions = () => {
  try {
    const allLocalExtension = GM_listValues().filter((key) =>
      key.startsWith(extStoragePrefix + "local_")
    );
    allLocalExtension.forEach(GM_deleteValue);
    return "success";
  } catch (e) {
    return "error";
  }
};

const queryExtension = (name: string) => {
  return (
    GM_getValue(extStoragePrefix + name) ||
    GM_getValue(extStoragePrefix + "local_" + name)
  );
};

const listAllExtension = () => {
  return GM_listValues()
    .filter(
      (key) =>
        key.startsWith(extStoragePrefix) &&
        !key.startsWith(extStoragePrefix + "local_")
    )
    .map((key) => key.replace(new RegExp("^" + extStoragePrefix), ""));
};

const cleanDataCaches = () => {
  GM_listValues()
    .filter((key) => !key.startsWith(extStoragePrefix))
    .forEach((key) => GM_deleteValue(key));
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

function installExtension(slug: string, url: string, version: string) {
  return fetchPlugin(url).then((code) => {
    saveToStorage(slug, {
      slug,
      version,
      code,
      url,
    });
  });
}

function launchMarketplace() {
  unsafeWindow.onAddLocalJuejinExtension = (filePath, code) => {
    try {
      const extension = {
        slug: filePath,
        version: "0.0.0",
        code,
        url: filePath,
      };
      saveToStorage(filePath, extension, true);
      return "success";
    } catch (e) {
      return "error";
    }
  };

  unsafeWindow.onRemoveLocalJuejinExtension = () => {
    try {
      removeAllLocalExtensions();
      return "success";
    } catch (e) {
      return "error";
    }
  };

  unsafeWindow.onAddJuejinExtension = (slug, { url, version }) => {
    return installExtension(slug, url, version).then(() => {
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

  unsafeWindow.checkJuejinExtension = (slug, version) => {
    const extension = queryExtension(slug) as IExtension;
    if (!extension) {
      return {
        added: false,
        update: false,
      };
    } else {
      return {
        added: true,
        update: version !== extension.version,
      };
    }
  };

  unsafeWindow.cleanExtensionDataCaches = () => {
    try {
      cleanDataCaches();
      return "success";
    } catch (e) {
      return "error";
    }
  };
}

function launchJuejin() {
  console.log($);
  const plugins = restoreFromStorage();
  plugins.forEach(({ plugin }) => {
    plugin?.onLoaded?.();
  });
  initRouter();

  function restoreFromStorage() {
    const allStoragePlugins = GM_listValues().filter((key) =>
      key.startsWith(extStoragePrefix)
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

function initMenu() {
  GM_registerMenuCommand("扩展市场", () => {
    GM_openInTab(marketplaceURL, {
      active: true,
    });
  });
}

function autoCheckExtension() {
  const duration = 30 * 60 * 1000;
  const allExtensions = listAllExtension();
  const lastCheckTime = GM_getValue("update_check", 0);
  const isTimeToCheck = new Date().valueOf() - lastCheckTime > duration;

  if (allExtensions.length > 0 && isTimeToCheck) {
    GM_setValue("update_check", new Date().valueOf());
    GM_xmlhttpRequest({
      method: "POST",
      url: `${marketplaceURL}/api/check`,
      headers: {
        "content-type": "application/json",
      },
      data: JSON.stringify({
        slugs: allExtensions,
      }),
      responseType: "json",
      onload({ status, response }) {
        if (status === 200) {
          response.updated.forEach(
            ({
              slug,
              rawURL,
              version,
            }: {
              slug: string;
              rawURL: string;
              version: string;
            }) => {
              const localExt = queryExtension(slug) as IExtension;
              if (localExt?.version !== version || localExt.url !== rawURL) {
                installExtension(slug, rawURL, version);
              }
            }
          );
          response.deleted.forEach((slug: string) => {
            removeFromStorage(slug);
          });
        }
      },
    });
  }

  setTimeout(() => {
    autoCheckExtension();
  }, duration);
}

async function preInstallExtension() {
  if (!GM_getValue("activated", false)) {
    await installExtension(
      "juejin-post-tracker",
      "https://gitee.com/curlly-brackets/juejin-post-tracker/raw/main/main.user.js",
      "0.0.1"
    );
    GM_setValue("activated", true);
  }
}

(async function start() {
  initMenu();
  await preInstallExtension();
  autoCheckExtension();
  if (location.host === "juejin.cn") {
    launchJuejin();
  } else if (location.origin === marketplaceURL) {
    launchMarketplace();
  }
})();
