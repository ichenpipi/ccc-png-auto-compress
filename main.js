const Fs = require('fs');
const Path = require('path');
const Os = require('os');
const { exec } = require('child_process');
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
      // 取消编辑器资源选中（解除占用）
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

    // 未开启直接跳过
    if (!config || !config.enabled) {
      callback();
      return;
    }

    // 准备
    Editor.log(`[${EXTENSION_NAME}]`, translate('prepareCompress'));

    // 获取压缩引擎路径
    const platform = Os.platform();
    this.pngquantPath = Path.join(__dirname, enginePathMap[platform]);
    if (!this.pngquantPath) {
      Editor.log(`[${EXTENSION_NAME}]`, translate('notSupport'), platform);
      callback();
      return;
    }

    // 设置引擎文件的执行权限（仅 macOS）
    if (platform === 'darwin') {
      if (Fs.statSync(this.pngquantPath).mode != 33261) {
        // 默认为 33188
        Fs.chmodSync(this.pngquantPath, 33261);
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

    // 需要排除的文件夹
    this.excludeFolders = config.excludeFolders ? config.excludeFolders.map(value => Path.normalize(value)) : [];
    // 需要排除的文件
    this.excludeFiles = config.excludeFiles ? config.excludeFiles.map(value => Path.normalize(value)) : [];

    // 重置日志
    this.logger = {
      succeedCount: 0,
      failedCount: 0,
      successInfo: '',
      failedInfo: ''
    };

    // 开始压缩
    Editor.log(`[${EXTENSION_NAME}]`, translate('startCompress'));

    // 遍历项目资源
    const dest = options.dest,
      dirs = ['res', 'assets', 'subpackages', 'remote'];
    for (let i = 0; i < dirs.length; i++) {
      const dirPath = Path.join(dest, dirs[i]);
      if (!Fs.existsSync(dirPath)) {
        continue;
      }
      Editor.log(`[${EXTENSION_NAME}]`, translate('compressDir'), dirPath);
      // 压缩并记录结果
      await this.compress(dirPath, compressOptions);
    }

    // 打印压缩结果
    this.printResults();

    // Done
    callback();
  },

  /**
   * 压缩
   * @param {string} srcPath 文件路径
   * @param {object} options 压缩参数
   */
  async compress(srcPath, options) {
    const pngquantPath = this.pngquantPath,
      tasks = [];
    const filter = this.filter,
      handler = (filePath, stats) => {
        if (!filter(filePath)) return;
        // 加入压缩队列
        tasks.push(new Promise(res => {
          const sizeBefore = stats.size / 1024,
            command = `"${pngquantPath}" ${options} -- "${filePath}"`;
          // pngquant $OPTIONS -- "$FILE"
          exec(command, (error, stdout, stderr) => {
            this.recordResult(error, sizeBefore, filePath);
            res();
          });
        }));
      };
    FileUtil.map(srcPath, handler);
    await Promise.all(tasks);
  },

  /**
   * 判断资源是否可以进行压缩
   * @param {string} path 路径
   */
  filter(path) {
    // 排除非 png 资源和内置资源
    if (!path.endsWith('.png') || path.includes(internalPath)) {
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

  /**
   * 记录结果
   * @param {object} error 错误
   * @param {number} sizeBefore 压缩前尺寸
   * @param {string} filePath 文件路径
   */
  recordResult(error, sizeBefore, filePath) {
    const log = this.logger;
    if (!error) {
      // 成功
      const fileName = Path.basename(filePath),
        sizeAfter = Fs.statSync(filePath).size / 1024,
        savedSize = sizeBefore - sizeAfter,
        savedRatio = savedSize / sizeBefore * 100;
      log.succeedCount++;
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
  },

  /**
   * 打印结果
   */
  printResults() {
    const log = this.logger,
      header = `\n # ${'Result'.padEnd(13, ' ')} | ${'Name / Path'.padEnd(50, ' ')} | ${'Size Before'.padEnd(13, ' ')} ->   ${'Size After'.padEnd(13, ' ')} | ${'Saved Size'.padEnd(13, ' ')} | ${'Compressibility'.padEnd(20, ' ')}`;
    Editor.log('[PAC]', `压缩完成（${log.succeedCount} 张成功 | ${log.failedCount} 张失败）`);
    Editor.log('[PAC]', '压缩日志 >>>' + header + log.successInfo + log.failedInfo);
  },

}

/** 压缩引擎路径表 */
const enginePathMap = {
  /** macOS */
  'darwin': 'pngquant/macos/pngquant',
  /** Windows */
  'win32': 'pngquant/windows/pngquant'
}
