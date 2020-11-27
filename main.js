const Fs = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const Os = require('os');
const FileUtil = require('./utils/file-util');
const ConfigManager = require('./config-manager');

/** 压缩引擎绝对路径 */
let pngquantPath = null;
/** 压缩任务队列 */
let compressTasks = null;
/** 日志 */
let logger = null;
/** 需要排除的文件夹 */
let excludeFolders = null;
/** 需要排除的文件 */
let excludeFiles = null;

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
      const configFilePath = ConfigManager.save(config);
      Editor.log('[PAC]', '保存配置', configFilePath);
      event.reply(null, true);
    },

    'read-config'(event) {
      const config = ConfigManager.read();
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
    const config = ConfigManager.read();
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
    const config = ConfigManager.read();
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

      // 重置日志
      logger = {
        succeedCount: 0,
        failedCount: 0,
        successInfo: '',
        failedInfo: '',
      };

      // 需要排除的文件夹
      excludeFolders = config.excludeFolders || [];
      // 需要排除的文件
      excludeFiles = config.excludeFiles || [];

      // 开始压缩
      Editor.log('[PAC]', '开始压缩 PNG 资源，请勿进行其他操作！');
      // 初始化队列
      compressTasks = [];
      const list = ['res', 'assets', 'subpackages', 'remote'];
      for (let i = 0; i < list.length; i++) {
        const resPath = Path.join(options.dest, list[i]);
        if (!Fs.existsSync(resPath)) continue;
        Editor.log('[PAC]', '压缩资源路径', resPath);
        compress(resPath, compressOptions);
      }
      // 开始压缩并等待压缩完成
      await Promise.all(compressTasks);
      // 清空队列
      compressTasks = null;
      // 打印压缩结果
      printResults();
    }

    callback();
  }

}

/**
 * 压缩
 * @param {string} srcPath 文件路径
 * @param {string} compressOptions 文件路径
 * @param {Promise[]} queue 压缩任务队列
 * @param {object} log 日志对象
 */
function compress(srcPath, compressOptions, queue) {
  FileUtil.map(srcPath, (filePath, stats) => {
    // 排除内置资源
    if (filePath.includes('assets\\internal\\')) return;
    // 排除非 png 资源
    if (Path.extname(filePath) !== '.png') return;
    // 排除指定文件夹和文件
    const assetPath = getAssetPath(filePath);
    for (let i = 0; i < excludeFolders.length; i++) {
      if (assetPath.startsWith(excludeFolders[i])) return;
    }
    for (let i = 0; i < excludeFiles.length; i++) {
      if (assetPath.startsWith(excludeFiles[i])) return;
    }
    // 加入压缩队列
    compressTasks.push(new Promise(res => {
      const sizeBefore = stats.size / 1024;
      // pngquant $OPTIONS -- "$FILE"
      const command = `"${pngquantPath}" ${compressOptions} -- "${filePath}"`;
      ChildProcess.exec(command, (error, stdout, stderr) => {
        recordResult(error, sizeBefore, filePath);
        res();
      });
    }));
  });
}

/**
 * 获取资源源路径
 * @param {string} filePath 
 * @return {string} 
 */
function getAssetPath(filePath) {
  const basename = Path.basename(filePath);
  const uuid = basename.slice(0, basename.indexOf('.'));
  const abPath = Editor.assetdb.uuidToFspath(uuid);
  return abPath.slice(abPath.indexOf('assets\\') + 7);
}

/**
 * 记录结果
 * @param {any} error 错误
 * @param {number} sizeBefore 压缩前尺寸
 * @param {string} filePath 文件路径
 */
function recordResult(error, sizeBefore, filePath) {
  if (!error) {
    // 成功
    logger.succeedCount++;
    const fileName = Path.basename(filePath);
    const sizeAfter = Fs.statSync(filePath).size / 1024;
    const savedSize = sizeBefore - sizeAfter;
    const savedRatio = savedSize / sizeBefore * 100;
    logger.successInfo += `\n + ${'Successful'.padEnd(13, ' ')} | ${fileName.padEnd(50, ' ')} | ${(sizeBefore.toFixed(2) + ' KB').padEnd(13, ' ')} ->   ${(sizeAfter.toFixed(2) + ' KB').padEnd(13, ' ')} | ${(savedSize.toFixed(2) + ' KB').padEnd(13, ' ')} | ${(savedRatio.toFixed(2) + '%').padEnd(20, ' ')}`;
  } else {
    // 失败
    logger.failedCount++;
    logger.failedInfo += `\n - ${'Failed'.padEnd(13, ' ')} | ${filePath.replace(Editor.Project.path || Editor.projectPath, '')}`;
    switch (error.code) {
      case 98:
        logger.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：压缩后体积增大（已经不能再压缩了）`;
        break;
      case 99:
        logger.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：压缩后质量低于已配置最低质量`;
        break;
      case 127:
        logger.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：压缩引擎没有执行权限`;
        break;
      default:
        logger.failedInfo += `\n ${''.padEnd(10, ' ')} - 失败原因：code ${error.code}`;
        break;
    }
  }
}

/**
 * 打印结果
 */
function printResults() {
  Editor.log('[PAC]', `压缩完成（${logger.succeedCount} 张成功 | ${logger.failedCount} 张失败）`);
  const header = `\n # ${'Result'.padEnd(13, ' ')} | ${'Name / Path'.padEnd(50, ' ')} | ${'Size Before'.padEnd(13, ' ')} ->   ${'Size After'.padEnd(13, ' ')} | ${'Saved Size'.padEnd(13, ' ')} | ${'Compressibility'.padEnd(20, ' ')}`;
  Editor.log('[PAC]', '压缩日志 >>>' + header + logger.successInfo + logger.failedInfo);
  // 清空
  logger = null;
}
