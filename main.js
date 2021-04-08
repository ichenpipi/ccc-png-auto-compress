const Fs = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const Os = require('os');
const ConfigManager = require('./config-manager');
const FileUtil = require('./utils/file-util');

/**
 * i18n
 * @param {string} key
 * @returns {string}
 */
const translate = (key) => Editor.T(`${PACKAGE_NAME}.${key}`);

/** 包名 */
const PACKAGE_NAME = 'ccc-png-auto-compress';

/** 扩展名 */
const EXTENSION_NAME = translate('name');

/** 内置资源目录 */
const internalPath = Path.normalize('assets/internal/');

module.exports = {

  /** 压缩引擎绝对路径 */
  pngquantPath: null,

  /** 压缩任务队列 */
  compressTasks: null,

  /** 日志 */
  logger: null,

  /** 需要排除的文件夹 */
  excludeFolders: null,

  /** 需要排除的文件 */
  excludeFiles: null,

  /**
   * 扩展消息
   * @type {{ [key: string]: Function }}
   */
  messages: {

    /**
     * 打开设置面板
     */
    'open-setting-panel'() {
      Editor.Panel.open(`${PACKAGE_NAME}.setting`);
    },

    /**
     * 读取配置
     * @param {any} event 
     */
    'read-config'(event) {
      const config = ConfigManager.read();
      event.reply(null, config);
    },

    /**
     * 保存配置
     * @param {any} event 
     * @param {any} config 
     */
    'save-config'(event, config) {
      const configFilePath = ConfigManager.save(config);
      Editor.log(`[${EXTENSION_NAME}]`, translate('configSaved'), configFilePath);
      event.reply(null, true);
    },

  },

  /**
   * 生命周期：加载
   */
  load() {
    // 监听事件
    Editor.Builder.on('build-start', this.onBuildStart.bind(this));
    Editor.Builder.on('build-finished', this.onBuildFinished.bind(this));
  },

  /**
   * 生命周期：加载
   */
  unload() {
    // 取消事件监听
    Editor.Builder.removeListener('build-start', this.onBuildStart);
    Editor.Builder.removeListener('build-finished', this.onBuildFinished);
  },

  /**
  * 构建开始回调
  * @param {BuildOptions} options 
  * @param {Function} callback 
  */
  onBuildStart(options, callback) {
    const config = ConfigManager.read();
    if (config && config.enabled) {
      Editor.log(`[${EXTENSION_NAME}]`, translate('willCompress'));
      // 取消编辑器资源选中
      Editor.Selection.clear('asset');
    }
    // Done
    callback();
  },

  /**
   * 构建完成回调
   * @param {BuildOptions} options 
   * @param {Function} callback 
   */
  async onBuildFinished(options, callback) {
    const config = ConfigManager.read();
    if (config && config.enabled) {
      Editor.log(`[${EXTENSION_NAME}]`, translate('prepareCompress'));

      // 获取压缩引擎路径
      const platform = Os.platform();
      switch (platform) {
        case 'darwin':
          // macOS
          this.pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/macos/pngquant');
          break;
        case 'win32':
          // Windows
          this.pngquantPath = Editor.url('packages://ccc-png-auto-compress/pngquant/windows/pngquant');
          break;
        default:
          // Done
          Editor.log(`[${EXTENSION_NAME}]`, translate('notSupport'), platform);
          callback();
          return;
      }

      // 设置引擎文件执行权限（仅 macOS）
      if (platform === 'darwin') {
        if (Fs.statSync(this.pngquantPath).mode != 33261) {
          // 默认为 33188
          // Fs.chmodSync(pngquantPath, 0755);
          Fs.chmodSync(this.pngquantPath, 33261);
        }
        // 另外一个比较蠢的方案
        // const command = `chmod a+x ${this.pngquantPath}`;
        // await new Promise(res => {
        //   ChildProcess.exec(command, (error, stdout, stderr) => {
        //     if (error) Editor.log('[PAC]', '设置引擎文件执行权限失败！');
        //     res();
        //   });
        // });
      }

      // 设置压缩命令
      const qualityParam = `--quality ${config.minQuality}-${config.maxQuality}`,
        speedParam = `--speed ${config.speed}`,
        skipParam = '--skip-if-larger',
        outputParam = '--ext=.png',
        writeParam = '--force',
        // colorsParam = config.colors,
        // compressOptions = `${qualityParam} ${speedParam} ${skipParam} ${outputParam} ${writeParam} ${colorsParam}`;
        compressOptions = `${qualityParam} ${speedParam} ${skipParam} ${outputParam} ${writeParam}`;

      // 重置日志
      logger = {
        succeedCount: 0,
        failedCount: 0,
        successInfo: '',
        failedInfo: '',
      };

      // 需要排除的文件夹
      this.excludeFolders = config.excludeFolders ? config.excludeFolders.map(value => Path.normalize(value)) : [];
      // 需要排除的文件
      this.excludeFiles = config.excludeFiles ? config.excludeFiles.map(value => Path.normalize(value)) : [];

      // 开始压缩
      Editor.log(`[${EXTENSION_NAME}]`, translate('startCompress'));
      // 初始化队列
      this.compressTasks = [];
      // 遍历项目资源
      const dest = options.dest,
        list = ['res', 'assets', 'subpackages', 'remote'];
      for (let i = 0; i < list.length; i++) {
        const dir = Path.join(dest, list[i]);
        if (!Fs.existsSync(dir)) {
          continue;
        }
        Editor.log('[PAC]', '压缩资源路径', dir);
        this.compress(dir, compressOptions);
      }
      // 开始压缩并等待压缩完成
      await Promise.all(compressTasks);
      // 清空队列
      this.compressTasks = null;
      // 打印压缩结果
      printResults();
    }
    // Done
    callback();
  },

  /**
   * 压缩
   * @param {string} srcPath 文件路径
   * @param {string} compressOptions 文件路径
   * @param {Promise[]} queue 压缩任务队列
   * @param {object} log 日志对象
   */
  compress(srcPath, compressOptions) {
    const compressTasks = this.compressTasks,
      pngquantPath = this.pngquantPath,
      filter = this.filter;
    const handler = (filePath, stats) => {
      if (!filter(filePath)) return;
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
    };
    FileUtil.map(srcPath, handler);
  },

  /**
   * 判断资源是否可以进行压缩
   * @param {string} path 路径
   */
  filter(path) {
    // 排除非 png 资源和内置资源
    if (Path.extname(path) !== '.png' || path.includes(internalPath)) {
      return false;
    }
    // 排除指定文件夹和文件
    const assetPath = this.getAssetPath(path);
    if (assetPath) {
      const excludeFolders = this.excludeFolders,
        excludeFiles = this.excludeFiles;
      for (let i = 0; i < excludeFolders.length; i++) {
        if (assetPath.startsWith(excludeFolders[i])) {
          return false;
        }
      }
      for (let i = 0; i < excludeFiles.length; i++) {
        if (assetPath.startsWith(excludeFiles[i])) {
          return false;
        }
      }
    }
    // 测试通过
    return true;
  },

  /**
   * 获取资源源路径
   * @param {string} filePath 
   * @return {string} 
   */
  getAssetPath(filePath) {
    const basename = Path.basename(filePath),
      uuid = basename.slice(0, basename.indexOf('.')),
      abPath = Editor.assetdb.uuidToFspath(uuid);
    if (!abPath) {
      // 图集资源
      // 暂时还没有找到办法处理
      return null;
    }
    // 资源根目录
    const assetsPath = Path.join((Editor.Project.path || Editor.projectPath), 'assets/');
    return Path.relative(assetsPath, abPath);
  },

}

/**
 * 压缩
 * @param {string} srcPath 文件路径
 * @param {string} compressOptions 文件路径
 * @param {Promise[]} queue 压缩任务队列
 * @param {object} log 日志对象
 */
function compress(srcPath, compressOptions) {
  FileUtil.map(srcPath, (filePath, stats) => {
    if (!filter(filePath)) return;
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
 * 判断资源是否可以进行压缩
 * @param {string} path 路径
 */
function filter(path) {
  // 排除非 png 资源和内置资源
  if (Path.extname(path) !== '.png' ||
    path.includes(internalPath)) {
    return false;
  }
  // 排除指定文件夹和文件
  const assetPath = getAssetPath(path);
  if (assetPath) {
    for (let i = 0; i < excludeFolders.length; i++) {
      if (assetPath.startsWith(excludeFolders[i])) {
        return false;
      }
    }
    for (let i = 0; i < excludeFiles.length; i++) {
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
  const basename = Path.basename(filePath);
  const uuid = basename.slice(0, basename.indexOf('.'));
  const abPath = Editor.assetdb.uuidToFspath(uuid);
  if (!abPath) {
    // 图集资源
    // 暂时还没有找到办法处理
    return null;
  }
  // 资源根目录
  const assetsPath = Path.join((Editor.Project.path || Editor.projectPath), 'assets/');
  return Path.relative(assetsPath, abPath);
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
