const Fs = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const Os = require('os');
const FileUtil = require('./utils/file-util');

const configFileDir = 'local';
const configFileName = 'ccc-png-auto-compress.json';

let pngquantPath = null;

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
      const configFilePath = saveConfig(config);
      Editor.log('[PAC]', '保存配置', configFilePath);
      event.reply(null, true);
    },

    'read-config'(event) {
      const config = getConfig();
      config ? Editor.log('[PAC]', '读取本地配置') : Editor.log('[PAC]', '未找到本地配置文件');
      event.reply(null, config);
    },

  },

  /**
  * 
  * @param {BuildOptions} options 
  * @param {Function} callback 
  */
  onBuildStart(options, callback) {
    const config = getConfig();
    if (config && config.enabled) {
      Editor.log('[PAC]', '将在构建完成后自动压缩 PNG 资源');

      // 取消编辑器资源选中
      const assets = Editor.Selection.curSelection('asset');
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
    const config = getConfig();
    if (config && config.enabled) {
      Editor.log('[PAC]', '准备压缩 PNG 资源');

      // 获取压缩引擎路径
      switch (Os.platform()) {
        case 'darwin': // MacOS
          pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/mac/pngquant');
          break;
        case 'win32': // Windows
          pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/windows/pngquant');
          break;
        default:
          Editor.log('[PAC]', '压缩引擎不支持当前系统平台！');
          callback();
          return;
      }
      // Editor.log('[PAC]', '压缩引擎路径', pngquantPath);

      // 设置引擎文件执行权限（仅 MacOS）
      if (Os.platform() === 'darwin') {
        if (Fs.statSync(pngquantPath).mode != 33261) {
          // 默认为 33188
          Editor.log('[PAC]', '设置引擎文件执行权限');
          // Fs.chmodSync(pngquantPath, 0755);
          Fs.chmodSync(pngquantPath, 33261);
        }
        // 另外一个比较蠢的方案
        // let command = `chmod a+x ${pngquantPath}`;
        // await new Promise(res => {
        //   ChildProcess.exec(command, (error, stdout, stderr) => {
        //     if (error) Editor.log('[PAC]', '设置引擎文件执行权限失败！');
        //     res();
        //   });
        // });
      }

      // 设置压缩命令
      const qualityParam = `--quality ${config.minQuality}-${config.maxQuality}`;
      const speedParam = `--speed ${config.speed}`;
      const skipParam = '--skip-if-larger';
      const outputParam = '--ext=.png';
      const writeParam = '--force';
      const colorsParam = config.colors;
      const compressOptions = `${qualityParam} ${speedParam} ${skipParam} ${outputParam} ${writeParam} ${colorsParam}`;

      // 压缩日志
      let log = {
        succeedCount: 0,
        failedCount: 0,
        successInfo: '',
        failedInfo: '',
      };

      // 开始压缩
      Editor.log('[PAC]', '开始压缩 PNG 资源，请勿进行其他操作！');
      let tasks = [];
      const list = ['res', 'assets', 'subpackages', 'remote'];
      for (let i = 0; i < list.length; i++) {
        const resPath = Path.join(options.dest, list[i]);
        if (!Fs.existsSync(resPath)) continue;
        Editor.log('[PAC]', '压缩资源路径', resPath);
        compress(resPath, compressOptions, tasks, log);
      }
      await Promise.all(tasks);

      // 压缩完成
      Editor.log('[PAC]', `压缩完成（${log.succeedCount} 张成功 | ${log.failedCount} 张失败）`);
      const header = `\n # ${'Result'.padEnd(13, ' ')} | ${'Name / Path'.padEnd(50, ' ')} | ${'Size Before'.padEnd(13, ' ')} ->   ${'Size After'.padEnd(13, ' ')} | ${'Saved Size'.padEnd(13, ' ')} | ${'Compressibility'.padEnd(20, ' ')}`;
      Editor.log('[PAC]', '压缩日志 >>>' + header + log.successInfo + log.failedInfo);
    }

    callback();
  }

}

/**
 * 保存配置
 * @param {object} config 
 */
function saveConfig(config) {
  // 查找目录
  const projectPath = Editor.Project.path || Editor.projectPath;
  const configDirPath = Path.join(projectPath, configFileDir);
  if (!Fs.existsSync(configDirPath)) Fs.mkdirSync(configDirPath);
  const configFilePath = Path.join(projectPath, configFileDir, configFileName);
  // 读取本地配置
  let object = {};
  if (Fs.existsSync(configFilePath)) {
    object = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  // 写入配置
  for (const key in config) { object[key] = config[key]; }
  Fs.writeFileSync(configFilePath, JSON.stringify(object, null, 2));
  return configFilePath;
}

/**
 * 读取配置
 */
function getConfig() {
  const projectPath = Editor.Project.path || Editor.projectPath;
  const configFilePath = Path.join(projectPath, configFileDir, configFileName);
  let config = null;
  if (Fs.existsSync(configFilePath)) {
    config = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  return config;
}

/**
 * 压缩
 * @param {string} srcPath 文件路径
 * @param {string} compressOptions 文件路径
 * @param {Promise[]} queue 压缩任务队列
 * @param {object} log 日志对象
 */
function compress(srcPath, compressOptions, queue, log) {
  FileUtil.map(srcPath, (filePath, stats) => {
    if (Path.extname(filePath) === '.png') {
      queue.push(new Promise(res => {
        const sizeBefore = stats.size / 1024;
        // pngquant $OPTIONS -- "$FILE"
        const command = `"${pngquantPath}" ${compressOptions} -- "${filePath}"`;
        ChildProcess.exec(command, (error, stdout, stderr) => {
          if (!error) {
            // 成功
            log.succeedCount++;
            const fileName = Path.basename(filePath);
            const sizeAfter = Fs.statSync(filePath).size / 1024;
            const savedSize = sizeBefore - sizeAfter;
            const savedRatio = savedSize / sizeBefore * 100;
            log.successInfo += `\n + ${'Successful'.padEnd(13, ' ')} | ${fileName.padEnd(50, ' ')} | ${(sizeBefore.toFixed(2) + ' KB').padEnd(13, ' ')} ->   ${(sizeAfter.toFixed(2) + ' KB').padEnd(13, ' ')} | ${(savedSize.toFixed(2) + ' KB').padEnd(13, ' ')} | ${(savedRatio.toFixed(2) + '%').padEnd(20, ' ')}`;
          } else {
            // 失败
            log.failedCount++;
            log.failedInfo += `\n - ${'Failed'.padEnd(13, ' ')} | ${filePath.replace(Editor.Project.path || Editor.projectPath, '')}`;
            switch (error.code) {
              case 98:
                log.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：压缩后体积增大（已经不能再压缩了）`;
                break;
              case 99:
                log.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：压缩后质量低于已配置最低质量`;
                break;
              case 127:
                log.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：压缩引擎没有执行权限`;
                break;
              default:
                log.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：code ${error.code}`;
                break;
            }
          }
          res();
        });
      }));
    }
  });
}