const { readFileSync } = require('fs');

/** 包名 */
const PACKAGE_NAME = 'ccc-png-auto-compress';

/**
 * i18n
 * @param {string} key
 * @returns {string}
 */
const translate = (key) => Editor.T(`${PACKAGE_NAME}.${key}`);

/** 扩展名 */
const EXTENSION_NAME = translate('name');

// 注册面板
Editor.Panel.extend({

  /** HTML */
  template: readFileSync(Editor.url(`packages://${PACKAGE_NAME}/panel.setting/index.html`), 'utf8'),

  /** 样式 */
  style: readFileSync(Editor.url(`packages://${PACKAGE_NAME}/panel.setting/index.css`), 'utf8'),

  /**
   * 当面板渲染成功后触发
   */
  ready() {
    // 创建 Vue 实例
    const app = new window.Vue({

      /**
       * 挂载目标
       * @type {string | Element}
       */
      el: this.shadowRoot,

      /**
       * 数据对象
       */
      data: {
        // 多语言文本
        titleLabel: translate('setting'),
        repositoryLabel: translate('repository'),
        applyLabel: translate('apply'),
        // 配置
        enabled: false,
        excludeFolders: '',
        excludeFiles: '',
        // 参数
        minQuality: 40,
        maxQuality: 80,
        colors: 256,
        speed: 3,
        // 按钮状态
        isProcessing: false,
      },

      /**
       * 实例函数
       * @type {{ [key: string]: Function }}
       */
      methods: {

        /**
         * 应用按钮回调
         * @param {*} event 
         */
        onApplyBtnClick(event) {
          this.saveConfig();
        },

        /**
         * 读取配置
         */
        readConfig() {
          Editor.Ipc.sendToMain(`${PACKAGE_NAME}:read-config`, (error, config) => {
            if (error || !config) return;
            for (const key in config) {
              const value = config[key];
              if (Array.isArray(value)) {
                this[key] = value.join(',').replace(/,/g, ',\n');
              } else {
                this[key] = value;
              }
            }
          });
        },

        /**
         * 保存配置
         */
        saveConfig() {
          if (this.isProcessing) return;
          this.isProcessing = true;
          // 配置
          const excludeFolders = this.excludeFolders.split(',').map(value => value.trim()),
            excludeFiles = this.excludeFiles.split(',').map(value => value.trim()),
            config = {
              enabled: this.enabled,
              excludeFolders,
              excludeFiles,
              // 参数
              minQuality: this.minQuality,
              maxQuality: this.maxQuality,
              colors: this.colors,
              speed: this.speed,
            };
          // 发消息给主进程保存配置
          Editor.Ipc.sendToMain(`${PACKAGE_NAME}:save-config`, config, () => {
            this.isProcessing = false;
          });
        },

      },

    });

    // 读取配置
    app.readConfig();

  }

});
