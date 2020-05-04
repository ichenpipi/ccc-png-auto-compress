Editor.Panel.extend({
  style: `
    :host {
      padding-left: 10px;
      padding-right: 10px;

      height: auto;
    }

    .container {
      height: 100%;
      overflow-y: auto;
    }

    ui-box-container{
      min-height: 50px;
    }
  `,

  template: `
  <div class="container">
    <h2>配置</h2>
    <ui-box-container class="layout vertical left">
      <div>
        <div class="layout horizontal center">
          <label>启用：</label>
          <ui-checkbox checked v-value="enabled"></ui-checkbox>
        </div>
        <br>
        <div class="layout horizontal center">
          <label>最小图像质量：</label>
          <ui-input v-value="minQuality"></ui-input>
        </div>
        <br>
        <div class="layout horizontal center">
          <label>最大图像质量：</label>
          <ui-input v-value="maxQuality"></ui-input>
        </div>
        <br>
        <div class="layout horizontal center">
          <label>质量</label>
          <ui-slider min=1 max=10 step=1 precision=0 v-value="speed"></ui-slider>
          <label>速度</label>
        </div>
      </div>
      <br>
      <ui-button class="blue big" @click="saveConfig()">保存</ui-button>
    </ui-box-container>
  </div>
  `,

  ready() {
    let vue = new window.Vue({
      el: this.shadowRoot,

      data() {
        return {
          enabled: false,
          minQuality: 20,
          maxQuality: 80,
          speed: 3,
        }
      },

      methods: {
        /**
         * 保存配置
         */
        saveConfig() {
          let config = {
            enabled: this.enabled,
            minQuality: this.minQuality,
            maxQuality: this.maxQuality,
            speed: this.speed,
          };
          Editor.Ipc.sendToMain('ccc-png-auto-compress:save-config', config);
        },

        /**
         * 读取配置
         */
        readConfig() {
          Editor.Ipc.sendToMain('ccc-png-auto-compress:read-config', (err, config) => {
            if (err) return;
            this.enabled = config.enabled;
            this.minQuality = config.minQuality;
            this.maxQuality = config.maxQuality;
            this.speed = config.speed;
          });
        }
      }
    });

    vue.readConfig();
  }

});