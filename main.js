const Fs = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const Os = require('os');

const configFileDir = 'local';
const configFileName = 'ccc-png-auto-compress.json';

/**
 * 保存配置
 * @param {*} config 
 */
function saveConfig(config) {
  // 查找目录
  let projectPath = Editor.Project.path || Editor.projectPath;
  let configDirPath = Path.join(projectPath, configFileDir);
  if (!Fs.existsSync(configDirPath)) Fs.mkdirSync(configDirPath);
  let configFilePath = Path.join(projectPath, configFileDir, configFileName);
  // 读取本地配置
  let object = {};
  if (Fs.existsSync(configFilePath)) {
    object = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  // 写入配置
  for (let key in config) { object[key] = config[key]; }
  Fs.writeFileSync(configFilePath, JSON.stringify(object, null, 2));
  return configFilePath;
}

/**
 * 读取配置
 */
function getConfig() {
  let projectPath = Editor.Project.path || Editor.projectPath;
  let configFilePath = Path.join(projectPath, configFileDir, configFileName);
  let config = null;
  if (Fs.existsSync(configFilePath)) {
    config = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  return config;
}

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
      Editor.Panel.open('ccc-png-auto-compress');
    },

    'save-config'(event, config) {
      Editor.log('[PAC]', '保存配置');
      let configFilePath = saveConfig(config);
      Editor.log('[PAC]', '配置文件路径', configFilePath);
      event.reply(null, true);
    },

    'read-config'(event) {
      Editor.log('[PAC]', '读取配置');
      let config = getConfig();
      event.reply(null, config);
    },

  },

  /**
  * 
  * @param {BuildOptions} options 
  * @param {Function} callback 
  */
  onBuildStart(options, callback) {
    let config = getConfig();
    if (config && config.enabled) {
      Editor.log('[PAC]', '将在构建完成后自动压缩 PNG 资源');

      // 取消编辑器资源选中
      let assets = Editor.Selection.curSelection('asset');
      for (let i = 0; i < assets.length; i++) {
        Editor.Selection.unselect('asset', assets[i]);
      }
    }

    callback();
  },

  /**
   * 
   * @param {BuildOptions} options 
   * @param {Function} callback 
   */
  async onBuildFinished(options, callback) {
    let config = getConfig();
    if (config && config.enabled) {
      Editor.log('[PAC]', '准备压缩 PNG 资源...');

      // 获取引擎路径
      let pngquantPath = '';
      if (Os.platform() === 'darwin') {
        // MacOS
        pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/mac/pngquant');
      } else {
        // Windows
        pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/windows/pngquant');
      }
      Editor.log('[PAC]', '压缩引擎路径为', pngquantPath);

      // 设置 pngquant 文件权限（仅 MacOS）
      if (Os.platform() === 'darwin') {
        if (Fs.statSync(pngquantPath).mode != 33261) {
          // 默认为 33188
          Editor.log('[PAC]', '设置引擎文件执行权限');
          // Fs.chmodSync(pngquantPath, 0755);
          Fs.chmodSync(pngquantPath, 33261);
        }
        // let command = `chmod a+x ${pngquantPath}`;
        // await new Promise(res => {
        //   ChildProcess.exec(command, (error, stdout, stderr) => {
        //     if (error) Editor.log('[PAC]', '设置引擎文件执行权限失败！');
        //     res();
        //   });
        // });
      }

      // 设置压缩命令
      let qualityParam = `--quality ${config.minQuality}-${config.maxQuality}`;
      let speedParam = `--speed ${config.speed}`;
      let skipParam = '--skip-if-larger';
      let outputParam = '--ext=.png';
      let writeParam = '--force';
      let colorsParam = config.colors;
      let compressOptions = `${qualityParam} ${speedParam} ${skipParam} ${outputParam} ${writeParam} ${colorsParam}`;

      // 准备材料
      let promises = [];
      let succeedCount = 0;
      let failCount = 0;
      let logHeader = `\n # ${'Result'.padEnd(10, ' ')} | ${'Name / Path'.padEnd(45, ' ')} | ${'Size Before'.padEnd(15, ' ')} -> ${'Size After'.padEnd(15, ' ')} | ${'Saved Size'.padEnd(15, ' ')} | ${'Compressibility'.padEnd(20, ' ')}`;
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
          if (Path.extname(path) === '.png') {
            promises.push(new Promise(res => {
              let sizeBefore = stat.size / 1024;
              // pngquant $OPTIONS -- "$FILE"
              let command = `"${pngquantPath}" ${compressOptions} -- "${path}"`;
              ChildProcess.exec(command, (error, stdout, stderr) => {
                if (error) {
                  // 失败
                  failCount++;
                  failLog += `\n - ${'Fail'.padEnd(10, ' ')} | ${path}`;
                  switch (error.code) {
                    case 98:
                      failLog += `\n ${''.padEnd(5, ' ')} - 失败原因：code 98 压缩后体积增大`;
                      break;
                    case 99:
                      failLog += `\n ${''.padEnd(5, ' ')} - 失败原因：code 99 压缩后质量低于已配置最低质量`;
                      break;
                    case 127:
                      failLog += `\n ${''.padEnd(5, ' ')} - 失败原因：code 127 请设置引擎执行权限`;
                      break;
                    default:
                      failLog += `\n ${''.padEnd(5, ' ')} - 失败原因：code ${error.code}`;
                      break;
                  }
                } else {
                  // 成功
                  succeedCount++;
                  let fileName = Path.basename(path);
                  let sizeAfter = Fs.statSync(path).size / 1024;
                  let savedSize = sizeBefore - sizeAfter;
                  let savedRatio = savedSize / sizeBefore * 100;
                  succeedLog += `\n + ${'Succeed'.padEnd(10, ' ')} | ${fileName.padEnd(45, ' ')} | ${(sizeBefore.toFixed(2) + ' KB').padEnd(15, ' ')} -> ${(sizeAfter.toFixed(2) + ' KB').padEnd(15, ' ')} | ${(savedSize.toFixed(2) + ' KB').padEnd(15, ' ')} | ${(savedRatio.toFixed(2) + '%').padEnd(20, ' ')}`;
                }
                res();
              });
            }));
          }
        }
      }

      // 开始压缩
      let resPath = Path.join(options.dest, 'res');
      Editor.log('[PAC]', '资源路径为', resPath);
      Editor.log('[PAC]', '开始压缩 PNG 资源，请勿进行其他操作...');
      compress(resPath);
      await Promise.all(promises);
      Editor.log('[PAC]', '压缩完成！');
      Editor.log('[PAC]', `压缩结果：${succeedCount} 张成功，${failCount} 张失败 >>>` + logHeader + succeedLog + failLog);
    }

    callback();
  }

}