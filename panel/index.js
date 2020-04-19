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

    .button{
      float:right
    }

    ui-box-container{
      min-height: 50px;
    }
  `,

  template: `
  <div class="container">
    <h2>自动压缩</h2>
    <ui-box-container class="layout vertical left">
      <div>
        <label>启用 </label><ui-checkbox checked v-value="enabled"></ui-checkbox>
        <br>
        <label>最小图像质量 </label><ui-input v-value="minQuality"></ui-input>
        <br>
        <label>最大图像质量 </label><ui-input v-value="maxQuality"></ui-input>
        <br>
        <label>质量 </label><ui-slider min=1 max=10 step=1 precision=0 v-value="speed"></ui-slider><label> 速度</label>
      </div>
      <br>
      <ui-button class="button blue big" @click="save()">保存</ui-button>
    </ui-box-container>
  </div>
  `,

  ready() {
    let vue = new window.Vue({
      el: this.shadowRoot,

      data() {
        return {
          enabled: true,
          minQuality: 20,
          maxQuality: 80,
          speed: 3,
        }
      },

      methods: {
        save() {
          let config = {
            enabled: this.enabled,
            minQuality: this.minQuality,
            maxQuality: this.maxQuality,
            speed: this.speed,
          };
          Editor.Ipc.sendToMain('ccc-auto-compress:save-config', config, (err, msg) => { });
        },
      },
    });

    Editor.Ipc.sendToMain('ccc-auto-compress:read-config', (err, msg) => {
      if (!err) {
        vue.enabled = msg['enabled'];
        vue.minQuality = msg['minQuality'];
        vue.maxQuality = msg['maxQuality'];
        vue.speed = msg['speed'];
      }
    });

  },
});