const { getUrlParam } = require('../../utils/browser-util');
const I18n = require('../../eazax/i18n');
const RendererUtil = require('../../eazax/renderer-util');
const PackageUtil = require('../../eazax/package-util');

/** 语言 */
const LANG = getUrlParam('lang');

/**
 * i18n
 * @param {string} key
 * @returns {string}
 */
const translate = (key) => I18n.translate(LANG, key);

// 应用
const App = {

  /**
   * 数据
   */
  data() {
    return {
      // 包名
      packageName: PackageUtil.name,
      // 仓库地址
      repositoryUrl: PackageUtil.repositoryUrl,
      // 配置
      enabled: false,
      excludeFolders: '',
      excludeFiles: '',
      // 参数
      minQuality: 40,
      maxQuality: 80,
      colors: 256,
      speed: 3,
      // 自动检查更新
      autoCheckUpdate: false,
    };
  },

  /**
   * 监听器
   */
  watch: {

    /**
     * 速度
     */
    speed(value) {
      value = Math.floor(value);
      if (value < 1) {
        value = 1;
      } else if (value > 10) {
        value = 10;
      }
      this.speed = value;
    },

  },

  /**
   * 实例函数
   */
  methods: {

    /**
     * i18n
     * @param {string} key 
     */
    i18n(key) {
      return translate(key);
    },

    /**
     * 应用按钮点击回调
     * @param {*} event 
     */
    onApplyBtnClick(event) {
      // 保存配置
      this.setConfig();
    },

    /**
     * 获取配置
     */
    async getConfig() {
      // （主进程）获取配置
      const config = await RendererUtil.sendSync('get-config');
      if (!config) return;
      for (const key in config) {
        const value = config[key];
        if (Array.isArray(value)) {
          this[key] = value.join(',').replace(/,/g, ',\n');
        } else {
          this[key] = value;
        }
      }
    },

    /**
     * 保存配置
     */
    setConfig() {
      const excludeFolders = this.excludeFolders.split(',').map(v => v.trim()),
        excludeFiles = this.excludeFiles.split(',').map(v => v.trim());
      const config = {
        enabled: this.enabled,
        excludeFolders: excludeFolders,
        excludeFiles: excludeFiles,
        autoCheckUpdate: this.autoCheckUpdate,
        // pngquant 参数
        minQuality: this.minQuality,
        maxQuality: this.maxQuality,
        colors: this.colors,
        speed: this.speed,
      };
      // （主进程）保存配置
      RendererUtil.sendSync('save-config', config);
    },

  },

  /**
   * 生命周期：实例被挂载
   */
  mounted() {
    // 获取配置
    this.getConfig();
    // 覆盖 a 标签点击回调（使用默认浏览器打开网页）
    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const url = link.getAttribute('href');
        RendererUtil.openExternal(url);
      });
    });
    // （主进程）检查更新
    RendererUtil.send('check-update', false);
  },

  /**
   * 生命周期：实例销毁前
   */
  beforeDestroy() {

  },

};

// 创建实例
const app = Vue.createApp(App);
// 挂载
app.mount('#app');
