(function () {
  // ==========================================
  // ⚡ 守卫 1: 运行域全局单例拦截（防止脚本自身被多次注入执行）
  // ==========================================
  if (window.__AicupaWeatherAgentLoaded__) {
    console.log(
      "[Weather Plugin] Already initialized. Bypassing duplicated script execution.",
    );
    // 即使脚本被重复 eval 或注入，如果组件不小心被主应用销毁了，这里依然触发一次安全渲染
    if (typeof window.__AicupaRequestRender__ === "function") {
      window.__AicupaRequestRender__();
    }
    return;
  }
  window.__AicupaWeatherAgentLoaded__ = true;

  console.log(
    "Aicupa Weather Agent (Minimalist, Draggable & Idempotent) Loaded.",
  );

  // 状态锁：防止因网络慢或并发 fetch 导致同时渲染出多个卡片
  let isFetching = false;

  // 1. 异步获取天气与位置数据
  async function fetchWeatherData() {
    if (isFetching) return { success: false, msg: "locked" };
    isFetching = true;
    try {
      const response = await fetch("https://wttr.in/?format=j1");
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();

      const current = data.current_condition[0];
      const weatherDesc = current.lang_zh
        ? current.lang_zh[0].value
        : current.weatherDesc[0].value;
      const tempC = current.temp_C;
      const humidity = current.humidity;

      const todayMaxMin = data.weather[0];
      const maxTemp = todayMaxMin.maxtempC;
      const minTemp = todayMaxMin.mintempC;

      const areaInfo = data.nearest_area && data.nearest_area[0];
      let cityName = "未知城市";
      if (areaInfo) {
        cityName = areaInfo.areaName ? areaInfo.areaName[0].value : "当前位置";
        const lowerCity = cityName.toLowerCase();
        if (lowerCity.includes("hangzhou")) cityName = "杭州";
        else if (lowerCity.includes("shanghai")) cityName = "上海";
        else if (lowerCity.includes("beijing")) cityName = "北京";
        else if (lowerCity.includes("shenzhen")) cityName = "深圳";
      }

      return {
        success: true,
        city: cityName,
        desc: weatherDesc,
        temp: tempC,
        range: `${minTemp}°C ~ ${maxTemp}°C`,
        humidity: humidity,
      };
    } catch (err) {
      console.error("[Weather Plugin] Fetch crashed:", err);
      return { success: false };
    } finally {
      isFetching = false;
    }
  }

  // 2. 动态渲染极简组件
  async function renderWeatherWidget() {
    // ==========================================
    // ⚡ 守卫 2: DOM 节点单例去重（若已存在，直接刷新位置，绝不创建第二个）
    // ==========================================
    let widget = document.getElementById("aicupa-weather-widget");
    if (widget) {
      applySavedPosition();
      return;
    }

    const weatherInfo = await fetchWeatherData();
    if (!weatherInfo.success) {
      // 如果是因为锁定了则静默退出，如果是网络失败且 DOM 被冲掉了则尝试应用旧样式
      if (weatherInfo.msg === "locked") return;
      applySavedPosition();
      return;
    }

    // 双重检查：异步 fetch 回来后，再次确认期间有没有被其他微任务创建过
    widget = document.getElementById("aicupa-weather-widget");
    if (widget) {
      updateWidgetDOM(widget, weatherInfo);
      return;
    }

    widget = document.createElement("div");
    widget.id = "aicupa-weather-widget";
    updateWidgetDOM(widget, weatherInfo);

    // 在你的 inject.js 的 window message 监听总入口处增加此分支：
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg && msg.type === "plugin-call") {
        if (msg.method === "resetWeatherPosition") {
          const el = document.getElementById("aicupa-weather-widget");
          if (el) {
            // 清除拖动产生的内联样式，回归 CSS 默认的 top: 15px; right: 80px;
            el.style.top = "";
            el.style.left = "";
            el.style.right = "";
            console.log(
              "🎉 Weather widget position restored to default configuration.",
            );
          }
        }
      }
    });

    // ==========================================
    // ⚡ 守卫 3: Style 标签单例去重覆盖
    // ==========================================
    let styleTag = document.getElementById("aicupa-weather-styles");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "aicupa-weather-styles";
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      #aicupa-weather-widget {
        position: fixed;
        top: 15px;
        right: 80px; 
        z-index: 99999;
        display: flex;
        align-items: center;
        background: rgba(26, 26, 26, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.06);
        padding: 4px 10px;
        border-radius: 14px;
        color: #d1d1d6;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        cursor: move;
        user-select: none;
        -webkit-user-select: none;
        transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      }
      #aicupa-weather-widget:hover {
        border-color: rgba(0, 163, 255, 0.4);
        box-shadow: 0 0 12px rgba(0, 163, 255, 0.15);
        background: rgba(30, 30, 35, 0.85);
        color: #ffffff;
      }
      .weather-main {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
      }
      .weather-icon { font-size: 13px; }
      
      .weather-detail-panel {
        position: absolute;
        top: 125%;
        right: 0;
        background: #141416;
        border: 1px solid #282830;
        box-shadow: 0 6px 16px rgba(0,0,0,0.6);
        border-radius: 8px;
        padding: 8px 12px;
        display: none;
        flex-direction: column;
        gap: 5px;
        min-width: 125px;
        pointer-events: none;
      }
      #aicupa-weather-widget:not(.dragging):hover .weather-detail-panel {
        display: flex;
      }
      .font-location { color: #00a3ff !important; font-weight: 600; }
      .detail-split { height: 1px; background: #282830; margin: 2px 0; }
      .detail-item { font-size: 11px; color: #9a9a9f; white-space: nowrap; }
    `;

    document.body.appendChild(widget);

    applySavedPosition();
    makeElementDraggable(widget);
  }

  // 更新 DOM 内容的基础抽取函数
  function updateWidgetDOM(el, info) {
    el.innerHTML = `
      <div class="weather-main">
        <span class="weather-icon">${getWeatherIcon(info.desc)}</span>
        <span class="weather-temp">${info.temp}°C</span>
      </div>
      <div class="weather-detail-panel">
        <div class="detail-item font-location">📍 ${info.city}</div>
        <div class="detail-split"></div>
        <div class="detail-item">状况: ${info.desc}</div>
        <div class="detail-item">范围: ${info.range}</div>
        <div class="detail-item">湿度: ${info.humidity}%</div>
      </div>
    `;
  }

  // 3. 读取本地持久化坐标并应用
  function applySavedPosition() {
    const el = document.getElementById("aicupa-weather-widget");
    if (!el) return;
    const pos = localStorage.getItem("aicupa_weather_pos");
    if (pos) {
      const { top, left } = JSON.parse(pos);
      el.style.top = top;
      el.style.left = left;
      el.style.right = "auto";
    }
  }

  // 4. 核心高流畅度拖拽实现
  function makeElementDraggable(el) {
    if (el.__DraggableBound__) return; // 防止重复绑定拖拽事件
    el.__DraggableBound__ = true;

    let offsetX = 0,
      offsetY = 0,
      isDown = false;

    function onStart(e) {
      isDown = true;
      el.classList.add("dragging");
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      offsetX = clientX - el.getBoundingClientRect().left;
      offsetY = clientY - el.getBoundingClientRect().top;

      document.addEventListener("mousemove", onMove, { passive: false });
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchend", onEnd);
    }

    function onMove(e) {
      if (!isDown) return;
      e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      let newLeft = clientX - offsetX;
      let newTop = clientY - offsetY;

      const maxLeft = window.innerWidth - el.offsetWidth - 5;
      const maxTop = window.innerHeight - el.offsetHeight - 5;
      newLeft = Math.max(5, Math.min(newLeft, maxLeft));
      newTop = Math.max(5, Math.min(newTop, maxTop));

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
      el.style.right = "auto";
    }

    function onEnd() {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("dragging");

      localStorage.setItem(
        "aicupa_weather_pos",
        JSON.stringify({
          top: el.style.top,
          left: el.style.left,
        }),
      );

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchend", onEnd);
    }

    el.addEventListener("mousedown", onStart);
    el.addEventListener("touchstart", onStart, { passive: true });
  }

  function getWeatherIcon(desc) {
    if (desc.includes("晴") || desc.includes("Sunny") || desc.includes("Clear"))
      return "☀️";
    if (
      desc.includes("云") ||
      desc.includes("阴") ||
      desc.includes("Cloudy") ||
      desc.includes("Overcast")
    )
      return "☁️";
    if (desc.includes("雨") || desc.includes("Rain") || desc.includes("Shower"))
      return "🌧️";
    if (desc.includes("雪") || desc.includes("Snow")) return "❄️";
    if (desc.includes("雷") || desc.includes("Thunder")) return "⚡";
    return "🍃";
  }

  // 导出对外刷新的单例桥梁，供外部（或重复加载时）随时触发重绘
  window.__AicupaRequestRender__ = renderWeatherWidget;

  // 首次运行
  renderWeatherWidget();

  // 🚀 5. 单页应用路由守护哨兵（利用单例全局变量锁死防死循环）
  if (!window.AicupaWeatherObserverAttached) {
    window.AicupaWeatherObserverAttached = true;
    const observer = new MutationObserver(() => renderWeatherWidget());
    observer.observe(document.body, { childList: true });

    // 1小时定时局部内容静默同步
    setInterval(
      async () => {
        const el = document.getElementById("aicupa-weather-widget");
        if (!el) {
          renderWeatherWidget();
          return;
        }
        const weatherInfo = await fetchWeatherData();
        if (weatherInfo.success) {
          updateWidgetDOM(el, weatherInfo);
        }
      },
      60 * 60 * 1000,
    );
  }
})();
