let Fs = require('fs');
let Path = require('path');
let Exec = require('child_process').exec;
let Os = require('os');

let configFileUrl = 'packages://ccc-png-auto-compress/config.json';
let defaultConfig = {
  enabled: false,
  minQuality: 40,
  maxQuality: 80,
  speed: 3,
};

/**
 * 读取配置
 */
function getConfig() {
  let projectPath = Editor.projectPath || Editor.Project.path;
  let projectName = projectPath.slice(projectPath.lastIndexOf('\\') + 1);
  let configFilePath = Editor.url(configFileUrl);
  let config = null;
  if (Fs.existsSync(configFilePath)) {
    config = JSON.parse(Fs.readFileSync(configFilePath))[projectName];
  }
  if (!config) {
    config = defaultConfig;
  }
  return config;
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
      Editor.log('[PAC] 构建后自动压缩 PNG');
      Editor.Panel.open('ccc-png-auto-compress');
    },

    'save-config'(event, config) {
      let projectPath = Editor.projectPath || Editor.Project.path;
      let projectName = projectPath.slice(projectPath.lastIndexOf('\\') + 1);
      let configFilePath = Editor.url(configFileUrl);
      let configs = {};
      // 读取配置
      if (Fs.existsSync(configFilePath)) {
        configs = JSON.parse(Fs.readFileSync(configFilePath));
      }
      // 写入配置
      configs[projectName] = config;
      let string = JSON.stringify(configs, null, '\t')
      Fs.writeFileSync(configFilePath, string);
      // log
      let enabled = configs[projectName]['enabled'];
      if (enabled) Editor.log('[PAC] 已启用 PNG 自动压缩');
      else Editor.log('[PAC] 已禁用 PNG 自动压缩');
    },

    'read-config'(event) {
      let config = getConfig();
      event.reply(null, config);
    },

  },

  async onBuildStart(options, callback) {
    let config = getConfig();
    if (config.enabled) {
      Editor.log('[PAC] PNG 自动压缩已启用');
      // 取消编辑器资源选中
      let assets = Editor.Selection.curSelection('asset');
      for (let i = 0; i < assets.length; i++) {
        Editor.Selection.unselect('asset', assets[i]);
      }
    }

    callback();
  },

  async onBuildFinished(options, callback) {
    let config = getConfig();
    if (config.enabled) {
      Editor.log('[PAC] 准备压缩 PNG 资源...');
      // 获取引擎路径
      let pngquantPath;
      switch (Os.platform()) {
        case 'win32':
          Editor.log('[PAC] 当前操作系统为 Windows');
          pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/windows/pngquant');
          break;
        case 'darwin':
          Editor.log('[PAC] 当前操作系统为 Mac OS');
          pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/mac/pngquant');
          break;
      }
      Editor.log('[PAC] pngquant 路径为 ' + pngquantPath);
      // 设置压缩命令
      let colorParam = ' 256';
      let qualityParam = ' --quality=' + config.minQuality + '-' + config.maxQuality;
      let speedParam = ' --speed ' + config.speed;
      let skipParam = ' --skip-if-larger';
      let otherParam = ' --ext=.png --force';
      let compressOptions = colorParam + qualityParam + speedParam + skipParam + otherParam;

      // 压缩 png 资源
      let promises = [];
      let succeedCount = 0;
      let failCount = 0;
      let logHeader = '\n # 结果     | 名称                                      | 压缩前      --> 压缩后      | 压缩大小                   | 压缩率';
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
            promises.push(new Promise(res => {
              let sizeBefore = stat.size / 1000;
              let command = '"' + pngquantPath + '"' + ' ' + compressOptions + ' -- ' + '"' + path + '"';
              Exec(command, (error, stdout, stderr) => {
                if (error) {
                  // 失败
                  failCount++;
                  failLog += '\n × 失败     | ' + path;
                  switch (error.code) {
                    case 98:
                      failLog += '\n   - 失败原因：code 98 压缩后体积增大';
                      break;
                    case 99:
                      failLog += '\n   - 失败原因：code 99 压缩后质量低于已配置最小质量';
                      break;
                    default:
                      failLog += '\n   - 失败原因：code ' + error.code;
                      break;
                  }
                } else {
                  // 成功
                  succeedCount++;
                  let fileName = path.slice(path.lastIndexOf('\\') + 1, path.lastIndexOf('.png'));
                  let sizeAfter = (Fs.statSync(path).size / 1000);
                  let savedSize = '-' + (sizeBefore - sizeAfter).toFixed(3);
                  let savedRatio = (((sizeBefore - sizeAfter) / sizeBefore) * 100).toFixed(3);
                  succeedLog += '\n √ 成功     | ' + fileName.padEnd(40, ' ') + ' | ' + (sizeBefore + 'KB').padEnd(10, ' ') + ' --> ' + (sizeAfter + 'KB').padEnd(10, ' ') + ' | ' + (savedSize + 'KB').padEnd(25, ' ') + ' | ' + (savedRatio + '%').padEnd(10, ' ');
                }
                res();
              });
            }));
          }
        }
      }
      Editor.log('[PAC] 开始压缩 PNG 资源，请勿进行其他操作...');
      // 资源路径
      let resPath = Path.join(options.dest, 'res');
      Editor.log('[PAC] 资源路径为 ' + resPath);
      compress(resPath);
      await Promise.all(promises);
      await new Promise(res => setTimeout(res, 250));
      Editor.log('[PAC] 压缩完成！');
      Editor.log('[PAC] 压缩结果： ' + succeedCount + ' 张成功， ' + failCount + ' 张失败！ >>>' + logHeader + succeedLog + failLog);
    }

    callback();
  }

}