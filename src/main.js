const Fs = require('fs');
const Path = require('path');
const Os = require('os');
const { exec } = require('child_process');
const ConfigManager = require('./config-manager');
const PanelManager = require('./panel-manager');
const { map } = require('./utils/file-util');
const { print, translate, checkUpdate } = require('./eazax/editor-util');
const MainUtil = require('./eazax/main-util');

/**
 * 压缩引擎路径表
 */
const PNGQUANT_PATHS = {
  /** macOS */
  'darwin': 'lib/pngquant/macos/pngquant',
  /** Windows */
  'win32': 'lib/pngquant/windows/pngquant.exe',
};

/**
 * 项目路径
 * @type {string}
 */
const PROJECT_PATH = Editor.Project.path || Editor.projectPath;

/**
 * 资源根目录路径
 * @type {string}
 */
const ASSETS_PATH = Path.join(PROJECT_PATH, 'assets');

/** 
 * 内置资源目录
 * @type {string}
 */
const INTERNAL_PATH = Path.join(ASSETS_PATH, 'internal');

/**
 * 压缩命令前缀
 * @type {string}
 */
let commandPrefix = null;

/**
 * 压缩日志
 * @type {{ successfulCount: number, failedCount: number, successfulInfo: string, failedInfo: string }}
 */
let logger = null;

/**
 * 需要排除的文件夹
 * @type {string[]}
 */
let excludeFolders = null;

/**
 * 需要排除的文件
 * @type {string[]}
 */
let excludeFiles = null;

/**
* 构建开始回调
* @param {BuildOptions} options 
* @param {Function} callback 
*/
function onBuildStart(options, callback) {
  const config = ConfigManager.get();
  if (config && config.enabled) {
    print('log', translate('willCompress'));
    // 取消编辑器资源选中（解除占用）
    Editor.Selection.clear('asset');
  }
  // Done
  callback();
}

/**
 * 构建完成回调
 * @param {BuildOptions} options 
 * @param {Function} callback 
 */
async function onBuildFinished(options, callback) {
  const config = ConfigManager.get();

  // 未开启直接跳过
  if (!config || !config.enabled) {
    callback();
    return;
  }

  // 获取压缩引擎路径
  const platform = Os.platform(),
    pngquantPath = Path.join(__dirname, `../${PNGQUANT_PATHS[platform]}`);

  // 没有压缩引擎
  if (!Fs.existsSync(pngquantPath)) {
    print('log', translate('noPngquant'), platform);
    callback();
    return;
  }

  // 设置引擎文件的执行权限（仅 macOS）
  if (platform === 'darwin') {
    if (Fs.statSync(pngquantPath).mode != 33261) {
      // 默认为 33188
      Fs.chmodSync(pngquantPath, 33261);
    }
  }

  // 组装压缩命令
  const qualityParam = `--quality ${config.minQuality}-${config.maxQuality}`,
    speedParam = `--speed ${config.speed}`,
    skipParam = '--skip-if-larger',
    outputParam = '--ext=.png',
    writeParam = '--force',
    // colorsParam = config.colors,
    // compressOptions = `${qualityParam} ${speedParam} ${skipParam} ${outputParam} ${writeParam} ${colorsParam}`;
    compressOptions = `${qualityParam} ${speedParam} ${skipParam} ${outputParam} ${writeParam}`;
  // 压缩命令前缀
  commandPrefix = `"${pngquantPath}" ${compressOptions}`;

  // 需要排除的文件夹
  excludeFolders = config.excludeFolders ? config.excludeFolders.map(v => Path.normalize(v)) : [];
  // 需要排除的文件
  excludeFiles = config.excludeFiles ? config.excludeFiles.map(v => Path.normalize(v)) : [];

  // 重置日志
  logger = {
    successfulCount: 0,
    failedCount: 0,
    successfulInfo: '',
    failedInfo: ''
  };

  // 开始压缩
  print('log', translate('startCompress'));

  // 遍历项目资源
  const dest = options.dest,
    dirs = ['res', 'assets', 'subpackages', 'remote'];
  for (let i = 0; i < dirs.length; i++) {
    const dirPath = Path.join(dest, dirs[i]);
    if (!Fs.existsSync(dirPath)) {
      continue;
    }
    print('log', translate('compressDir'), dirPath);
    // 压缩并记录结果
    await compress(dirPath);
  }

  // 打印压缩结果
  printResults();

  // Done
  callback();
}

/**
 * 压缩
 * @param {string} srcPath 文件路径
 */
async function compress(srcPath) {
  const tasks = [];
  const handler = (path, stats) => {
    // 过滤文件
    if (!filter(path)) {
      return;
    }
    // 加入压缩队列
    tasks.push(new Promise(res => {
      const sizeBefore = stats.size / 1024,
        command = `${commandPrefix} -- "${path}"`;
      // pngquant $OPTIONS -- "$FILE"
      exec(command, (error, stdout, stderr) => {
        recordResult(error, sizeBefore, path);
        res();
      });
    }));
  };
  await map(srcPath, handler);
  await Promise.all(tasks);
}

/**
 * 判断资源是否可以进行压缩
 * @param {string} path 路径
 */
function filter(path) {
  // 排除非 png 资源和内置资源
  if (!path.endsWith('.png') || path.startsWith(INTERNAL_PATH)) {
    return false;
  }
  // 排除指定文件夹和文件
  const assetPath = getAssetPath(path);
  if (assetPath) {
    // 文件夹
    for (let i = 0, l = excludeFolders.length; i < l; i++) {
      if (assetPath.startsWith(excludeFolders[i])) {
        return false;
      }
    }
    // 文件
    for (let i = 0, l = excludeFiles.length; i < l; i++) {
      if (assetPath.startsWith(excludeFiles[i])) {
        return false;
      }
    }
  }
  // 测试通过
  return true;
}

/**
 * 获取资源源路径
 * @param {string} filePath 
 * @return {string} 
 */
function getAssetPath(filePath) {
  // 获取源路径（图像在项目中的实际路径）
  const basename = Path.basename(filePath),
    uuid = basename.slice(0, basename.indexOf('.')),
    sourcePath = Editor.assetdb.uuidToFspath(uuid);
  if (!sourcePath) {
    // 图集资源
    // 暂时还没有找到办法处理
    return null;
  }
  return Path.relative(ASSETS_PATH, sourcePath);
}

/**
 * 记录结果
 * @param {object} error 错误
 * @param {number} sizeBefore 压缩前尺寸
 * @param {string} filePath 文件路径
 */
function recordResult(error, sizeBefore, filePath) {
  if (!error) {
    // 成功
    const fileName = Path.basename(filePath),
      sizeAfter = Fs.statSync(filePath).size / 1024,
      savedSize = sizeBefore - sizeAfter,
      savedRatio = savedSize / sizeBefore * 100;
    logger.successfulCount++;
    logger.successfulInfo += `\n + ${'Successful'.padEnd(13, ' ')} | ${fileName.padEnd(50, ' ')} | ${(sizeBefore.toFixed(2) + ' KB').padEnd(13, ' ')} ->   ${(sizeAfter.toFixed(2) + ' KB').padEnd(13, ' ')} | ${(savedSize.toFixed(2) + ' KB').padEnd(13, ' ')} | ${(savedRatio.toFixed(2) + '%').padEnd(20, ' ')}`;
  } else {
    // 失败
    logger.failedCount++;
    logger.failedInfo += `\n - ${'Failed'.padEnd(13, ' ')} | ${filePath.replace(PROJECT_PATH, '')}`;
    switch (error.code) {
      case 98:
        logger.failedInfo += `\n ${' '.repeat(10)} - 失败原因：压缩后体积增大（已经不能再压缩了）`;
        break;
      case 99:
        logger.failedInfo += `\n ${' '.repeat(10)} - 失败原因：压缩后质量低于已配置最低质量`;
        break;
      case 127:
        logger.failedInfo += `\n ${' '.repeat(10)} - 失败原因：压缩引擎没有执行权限`;
        break;
      default:
        logger.failedInfo += `\n ${' '.repeat(10)} - 失败原因：code ${error.code}`;
        break;
    }
  }
}

/**
 * 打印结果
 */
function printResults() {
  const header = `\n # ${'Result'.padEnd(13, ' ')} | ${'Name / Path'.padEnd(50, ' ')} | ${'Size Before'.padEnd(13, ' ')} ->   ${'Size After'.padEnd(13, ' ')} | ${'Saved Size'.padEnd(13, ' ')} | ${'Compressibility'.padEnd(20, ' ')}`;
  print('log', `压缩完成（${logger.successfulCount} 张成功 | ${logger.failedCount} 张失败）`);
  print('log', '压缩日志 >>>' + header + logger.successfulInfo + logger.failedInfo);
}

/**
 * （渲染进程）获取配置事件回调
 * @param {Electron.IpcMainEvent} event 
 */
function onGetConfigEvent(event) {
  const config = ConfigManager.get();
  event.returnValue = config;
}

/**
 * （渲染进程）保存配置事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {{ type: string, content: string }} config 
 */
function onSaveConfigEvent(event, config) {
  ConfigManager.set(config);
}

module.exports = {

  /**
   * 扩展消息
   * @type {{ [key: string]: Function }}
   */
  messages: {

    /**
     * 打开设置面板
     */
    'open-setting-panel'() {
      PanelManager.openSettingPanel();
    },

    /**
     * 检查更新
     */
    'force-check-update'() {
      checkUpdate(true);
    },

    /**
     * 读取配置
     * @param {any} event 
     */
    'read-config'(event) {
      const config = ConfigManager.get();
      event.reply(null, config);
    },

    /**
     * 保存配置
     * @param {any} event 
     * @param {any} config 
     */
    'save-config'(event, config) {
      const configFilePath = ConfigManager.set(config);
      print('log', translate('configSaved'), configFilePath);
      event.reply(null, true);
    },

  },

  /**
   * 生命周期：加载
   */
  load() {
    // 监听事件
    Editor.Builder.on('build-start', onBuildStart);
    Editor.Builder.on('build-finished', onBuildFinished);
    MainUtil.on('get-config', onGetConfigEvent);
    MainUtil.on('save-config', onSaveConfigEvent);
  },

  /**
   * 生命周期：加载
   */
  unload() {
    // 取消事件监听
    Editor.Builder.removeListener('build-start', onBuildStart);
    Editor.Builder.removeListener('build-finished', onBuildFinished);
    MainUtil.removeAllListeners('get-config');
    MainUtil.removeAllListeners('save-config');
  },

};
