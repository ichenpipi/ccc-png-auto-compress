const Fs = require('fs');

Editor.Panel.extend({

  style: Fs.readFileSync(Editor.url('packages://ccc-png-auto-compress/panel/index.css'), 'utf8'),

  template: Fs.readFileSync(Editor.url('packages://ccc-png-auto-compress/panel/index.html'), 'utf8'),

  ready() {
    let vue = new window.Vue({
      el: this.shadowRoot,

      data() {
        return {
          enabled: false,

          minQuality: 40,
          maxQuality: 80,
          colors: 256,
          speed: 3,

          isSaving: false,
        }
      },

      methods: {

        /**
         * 保存配置
         */
        saveConfig() {
          if (this.isSaving) return;
          this.isSaving = true;

          let config = {
            enabled: this.enabled,

            minQuality: this.minQuality,
            maxQuality: this.maxQuality,
            colors: this.colors,
            speed: this.speed,
          };
          Editor.Ipc.sendToMain('ccc-png-auto-compress:save-config', config, () => {
            this.isSaving = false;
          });
        },

        /**
         * 读取配置
         */
        readConfig() {
          Editor.Ipc.sendToMain('ccc-png-auto-compress:read-config', (err, config) => {
            if (err || !config) return;
            for (let key in config) {
              this[key] = config[key];
            }
          });
        }

      }
    });

    vue.readConfig();
  }

});