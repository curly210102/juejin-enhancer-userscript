
// ==UserScript==
// @name                 Juejin Enhancer
// @namespace            juejin-enhancer
// @version              0.1.8
// @description          Enhances Juejin
// @include              *
// @name:zh-CN           掘金助手
// @description:zh-CN    掘金功能增强，提供进度追踪、数据统计、操作辅助等功能。
// @match                https://juejin-enhancer-extensions.vercel.app/*
// @run-at               document-end
// @require              tampermonkey://vendor/jquery.js
// @grant                GM_addStyle
// @grant                GM_addElement
// @grant                GM_log
// @grant                GM_setValue
// @grant                GM_getValue
// @grant                GM_deleteValue
// @grant                GM_listValues
// @grant                GM_addValueChangeListener
// @grant                GM_removeValueChangeListener
// @grant                GM_getResourceText
// @grant                GM_getResourceURL
// @grant                GM_registerMenuCommand
// @grant                GM_unregisterMenuCommand
// @grant                GM_openInTab
// @grant                GM_xmlhttpRequest
// @grant                GM_download
// @grant                GM_getTab
// @grant                GM_saveTab
// @grant                GM_getTabs
// @grant                GM_notification
// @grant                GM_setClipboard
// @connect              juejin.cn
// @connect              github.com
// @connect              gitee.com
// ==/UserScript==
(function () {
  'use strict';

  const storageKey = "added_juejin_extension_";

  const isIExtension = object => {
    return !!object && typeof object["slug"] === "string" && typeof object["version"] === "string" && typeof object["code"] === "string" && typeof object["url"] === "string";
  };

  function initMenu() {
    GM_registerMenuCommand("扩展市场", () => {
      GM_openInTab("https://juejin-enhancer-extensions.vercel.app/", {
        active: true
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
    const saveToStorage = (name, extension, isLocal) => {
      GM_setValue(storageKey + `${isLocal ? "local_" : ""}` + name, extension);
    };

    const removeFromStorage = name => {
      GM_deleteValue(storageKey + name);
    };

    const removeAllLocalExtensions = () => {
      try {
        const allLocalExtension = GM_listValues().filter(key => key.startsWith(storageKey + "local_"));
        allLocalExtension.forEach(GM_deleteValue);
        return "success";
      } catch (e) {
        return "error";
      }
    };

    const haveExtension = name => {
      return GM_getValue(storageKey + name) || GM_getValue(storageKey + "local_" + name);
    };

    const fetchPlugin = url => {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,

          onload({
            status,
            response
          }) {
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
          }

        });
      });
    };

    unsafeWindow.onAddLocalJuejinExtension = (filePath, code) => {
      const extension = {
        slug: filePath,
        version: "0.0.0",
        code,
        url: filePath
      };
      saveToStorage(filePath, extension, true);
    };

    unsafeWindow.onRemoveLocalJuejinExtension = () => {
      removeAllLocalExtensions();
    };

    unsafeWindow.onAddJuejinExtension = (slug, {
      url,
      version
    }) => {
      return fetchPlugin(url).then(code => {
        saveToStorage(slug, {
          slug,
          version,
          code,
          url
        });
        return "success";
      });
    };

    unsafeWindow.onRemoveJuejinExtension = slug => {
      return new Promise((resolve, reject) => {
        try {
          removeFromStorage(slug);
          resolve("success");
        } catch (e) {
          reject("error");
        }
      });
    };

    unsafeWindow.checkJuejinExtensionIsAdded = slug => {
      return Boolean(haveExtension(slug));
    };
  }

  function launchJuejin() {
    const plugins = restoreFromStorage();
    plugins.forEach(({
      plugin
    }) => {
      var _plugin$onLoaded;

      plugin === null || plugin === void 0 ? void 0 : (_plugin$onLoaded = plugin.onLoaded) === null || _plugin$onLoaded === void 0 ? void 0 : _plugin$onLoaded.call(plugin);
    });
    initRouter();

    function restoreFromStorage() {
      const allStoragePlugins = GM_listValues().filter(key => key.startsWith(storageKey));
      return allStoragePlugins.map(key => GM_getValue(key, null)).filter(isIExtension).map(({
        slug,
        code
      }) => {
        return executePlugin(slug, code);
      }).filter(({
        plugin
      }) => {
        return plugin && !plugin.isOffShelf;
      });
    }

    function executePlugin(name, code) {
      const plugin = eval(code);
      return {
        name,
        plugin
      };
    }

    function initRouter() {
      let currentRouterPathname = "";

      function onRouteChange() {
        const prevRouterPathname = currentRouterPathname;
        currentRouterPathname = document.location.pathname;

        if (prevRouterPathname !== currentRouterPathname) {
          plugins.forEach(({
            plugin
          }) => {
            var _plugin$onRouteChange;

            plugin === null || plugin === void 0 ? void 0 : (_plugin$onRouteChange = plugin.onRouteChange) === null || _plugin$onRouteChange === void 0 ? void 0 : _plugin$onRouteChange.call(plugin, prevRouterPathname, currentRouterPathname);
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

})();
