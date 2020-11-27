const Fs = require('fs');
const Path = require('path');

/** 配置文件保存目录 */
const configFileDir = 'local';
/** 配置文件名 */
const configFileName = 'ccc-png-auto-compress.json';

/** 配置管理器 */
const ConfigManager = {

    /** 默认配置 */
    default: {
        enabled: false,

        minQuality: 40,
        maxQuality: 80,
        colors: 256,
        speed: 3,

        excludeFolders: [],
        excludeFiles: [],
    },

    /**
     * 保存配置
     * @param {object} config 配置
     */
    save(config) {
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
        for (const key in config) {
            object[key] = Array.isArray(config[key]) ? config[key].filter(value => value !== '') : config[key];
        }
        Fs.writeFileSync(configFilePath, JSON.stringify(object, null, 2));
        return configFilePath;
    },

    /**
     * 读取配置
     */
    read() {
        const projectPath = Editor.Project.path || Editor.projectPath;
        const configFilePath = Path.join(projectPath, configFileDir, configFileName);
        let config = null;
        if (Fs.existsSync(configFilePath)) {
            config = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
        } else {
            config = { ...this.default };
        }
        return config;
    }

}

module.exports = ConfigManager;
