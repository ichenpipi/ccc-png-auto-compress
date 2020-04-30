let Fs = require('fs');
let Path = require('path');
let Exec = require('child_process').exec;
let Os = require('os');

let configFileUrl = 'packages://ccc-auto-compress/config.json';
let defaultConfig = {
  enabled: false,
  minQuality: 20,
  maxQuality: 80,
  speed: 3,
};

module.exports = {

  load() {
    Editor.Builder.on('build-start', this.onBuildStart);
    Editor.Builder.on('build-finished', this.onBuildFinished);
  },

  unload() {
    Editor.Builder.removeListener('build-start', this.onBuildStart);
    Editor.Builder.removeListener('build-finished', this.onBuildFinished);
  },

  messages: {

    'open-panel'() {
      Editor.log('[AC] 自动压缩');
      Editor.Panel.open('ccc-auto-compress');
    },

    'save-config'(event, data) {
      // 读取配置
      let configFilePath = Editor.url(configFileUrl);
      let projectPath = Editor.projectPath || Editor.Project.path;
      let name = projectPath.slice(projectPath.lastIndexOf('\\') + 1);
      let config = {};
      if (Fs.existsSync(configFilePath)) {
        config = JSON.parse(Fs.readFileSync(configFilePath));
      }
      config[name] = data;

      // 写入配置
      let stringData = JSON.stringify(config, null, '\t')
      Fs.writeFileSync(configFilePath, stringData);

      let enabled = config[name]['enabled'];
      if (enabled) Editor.log('[AC] 已启用 png 自动压缩');
      else Editor.log('[AC] 已禁用 png 自动压缩');
    },

    'read-config'(event) {
      // 读取配置
      let configFilePath = Editor.url(configFileUrl);
      let projectPath = Editor.projectPath || Editor.Project.path;
      let name = projectPath.slice(projectPath.lastIndexOf('\\') + 1);
      let config = {};
      if (Fs.existsSync(configFilePath)) {
        config = JSON.parse(Fs.readFileSync(configFilePath));
      }

      if (!config[name]) {
        config[name] = defaultConfig;

        // 写入配置
        let stringData = JSON.stringify(config, null, '\t')
        Fs.writeFileSync(configFilePath, stringData);
      }

      event.reply(null, config[name]);
    },

  },

  async onBuildStart(options, callback) {
    // 读取配置
    let configFilePath = Editor.url(configFileUrl);
    let projectPath = Editor.projectPath || Editor.Project.path;
    let name = projectPath.slice(projectPath.lastIndexOf('\\') + 1);
    let config = {};
    if (Fs.existsSync(configFilePath)) {
      config = JSON.parse(Fs.readFileSync(configFilePath));
    }

    let enabled = config[name] ? config[name]['enabled'] : false;
    if (enabled) {
      Editor.log('[AC] 自动压缩已启用');
      // 取消编辑器资源选中
      let cs = Editor.Selection.curSelection('asset');
      for (let i = 0; i < cs.length; i++) {
        Editor.Selection.unselect('asset', cs[i]);
      }
    }

    callback();
  },

  async onBuildFinished(options, callback) {
    // 读取配置
    let configFilePath = Editor.url(configFileUrl);
    let projectPath = Editor.projectPath || Editor.Project.path;
    let name = projectPath.slice(projectPath.lastIndexOf('\\') + 1);
    let config = {};
    if (Fs.existsSync(configFilePath)) {
      config = JSON.parse(Fs.readFileSync(configFilePath));
    }

    if (!config[name]) config[name] = defaultConfig;

    let enabled = config[name] ? config[name]['enabled'] : true;
    if (enabled) {
      Editor.log('[AC] 准备压缩 png 资源...');
      // 设置路径
      let srcPath = Path.join(options.dest, 'res');
      Editor.log('[AC] 资源路径为', srcPath);
      let pngquantPath = '';
      let platform = Os.platform();
      if (platform === 'win32') {
        Editor.log('[AC] 当前操作系统为 Windows');
        pngquantPath = Editor.url('packages://ccc-auto-compress/pngquant/windows/pngquant');
      } else if (platform === 'darwin') {
        Editor.log('[AC] 当前操作系统为 Mac OS');
        pngquantPath = Editor.url('packages://ccc-auto-compress/pngquant/mac/pngquant');
      }
      Editor.log('[AC] pngquant 路径为 ' + pngquantPath);

      // 设置压缩命令
      let colorParam = ' 256';
      let qualityParam = ' --quality=' + config[name]['minQuality'] + '-' + config[name]['maxQuality'];
      let speedParam = ' -s' + config[name]['speed'];
      let skipParam = ' --skip-if-larger';
      let otherParam = ' --ext=.png --force';

      // 压缩 png 资源
      let promises = [];
      let succeedCount = 0;
      let failCount = 0;
      let logHeader = '\n # 结果     | 名称                            | 压缩前大小   --> 压缩后大小   | 压缩大小    | 压缩率';
      let succeedLog = '';
      let failLog = '';
      let compress = (path) => {
        let stat = Fs.statSync(path);
        if (stat.isDirectory()) {
          let files = Fs.readdirSync(path);
          for (let file of files) {
            let _path = Path.join(path, file);
            compress(_path);
          }
        } else if (stat.isFile()) {
          if (path.indexOf('.png') !== -1) {
            let sizeBefore = stat.size;
            promises.push(new Promise(res => {
              let command = '"' + pngquantPath + '"' + ' ' + colorParam + qualityParam + speedParam + skipParam + otherParam + ' -- ' + '"' + path + '"';
              Exec(command, (error, stdout, stderr) => {
                if (error) {
                  failLog += '\n × 失败     | ' + path;
                  switch (error.code) {
                    case 98:
                      failLog += '\n   - 失败原因：压缩后体积增大 code: 98';
                      break;
                    case 99:
                      failLog += '\n   - 失败原因：压缩后质量过低 code: 99';
                      break;
                    default:
                      failLog += '\n   - 失败原因：code: ' + error.code;
                      break;
                  }
                  failCount++;
                } else {
                  let name = path.slice(path.lastIndexOf('\\') + 1, path.lastIndexOf('.png'));
                  let sizeAfter = Fs.statSync(path).size;
                  let _sizeBefore = (sizeBefore / 1000) + 'KB';
                  let _sizeAfter = (sizeAfter / 1000) + 'KB';
                  let savedSize = '-' + ((sizeBefore - sizeAfter) / 1000) + 'KB';
                  let savedRatio = (((sizeBefore - sizeAfter) / sizeBefore).toFixed(2) * 100) + '%';
                  succeedLog += '\n √ 成功     | ' + name.padEnd(30, ' ') + ' | ' + _sizeBefore.padEnd(10, ' ') + ' --> ' + _sizeAfter.padEnd(10, ' ') + ' | ' + savedSize.padEnd(10, ' ') + ' | ' + savedRatio.padEnd(10, ' ');
                  succeedCount++;
                }
                res();
              });
            }));
          }
        }
      };
      Editor.log('[AC] 开始压缩 png 资源，请勿进行其他操作...');
      compress(srcPath);
      await Promise.all(promises);
      await new Promise(res => setTimeout(res, 250));
      Editor.log('[AC] 压缩完成！');
      Editor.log('[AC] 压缩结果： ' + succeedCount + ' 张成功， ' + failCount + ' 张失败！ >>>' + logHeader + succeedLog + failLog);
    }

    callback();
  },
}