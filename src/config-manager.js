const Fs = require('fs');
const Path = require('path');

/** 配置文件保存目录 */
const CONFIG_FILE_DIR = 'local';

/** 配置文件名 */
const CONFIG_FILE_NAME = 'ccc-png-auto-compress.json';

/**
 * 配置管理器
 */
const ConfigManager = {

    /**
     * 默认配置
     */
    defaultConfig: {
        version: '1.0',
        enabled: false,
        minQuality: 40,
        maxQuality: 80,
        colors: 256,
        speed: 3,
        excludeFolders: [],
        excludeFiles: [],
    },

    /**
     * 获取配置
     * @returns {object}
     */
    get() {
        const projectPath = Editor.Project.path || Editor.projectPath,
            configFilePath = Path.join(projectPath, CONFIG_FILE_DIR, CONFIG_FILE_NAME);
        const config = { ...this.defaultConfig };
        if (Fs.existsSync(configFilePath)) {
            const localConfig = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
            for (const key in localConfig) {
                config[key] = localConfig[key];
            }
        }
        return config;
    },

    /**
     * 保存配置
     * @param {object} config 配置
     * @returns {string}
     */
    set(config) {
        // 查找目录
        const projectPath = Editor.Project.path || Editor.projectPath,
            configDirPath = Path.join(projectPath, CONFIG_FILE_DIR);
        if (!Fs.existsSync(configDirPath)) {
            Fs.mkdirSync(configDirPath);
        }
        const configFilePath = Path.join(projectPath, CONFIG_FILE_DIR, CONFIG_FILE_NAME);
        // 读取本地配置
        const localConfig = this.get();
        // 处理数组
        for (const key in config) {
            let value = config[key];
            if (Array.isArray(value)) {
                value = value.filter(v => v !== '');
            }
            localConfig[key] = value;
        }
        // 写入配置
        Fs.writeFileSync(configFilePath, JSON.stringify(localConfig, null, 2));
        return configFilePath;
    },

};

module.exports = ConfigManager;
