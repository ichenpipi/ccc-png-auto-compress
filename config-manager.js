const Fs = require('fs');
const Path = require('path');

/** 配置文件保存目录 */
const configFileDir = 'local';

/** 配置文件名 */
const configFileName = 'ccc-png-auto-compress.json';

/** 默认配置 */
const defaultConfig = {
    enabled: false,
    minQuality: 40,
    maxQuality: 80,
    colors: 256,
    speed: 3,
    excludeFolders: [],
    excludeFiles: [],
};

/** 配置管理器 */
const ConfigManager = {

    /**
     * 获取配置
     * @returns {object}
     */
    get() {
        const projectPath = Editor.Project.path || Editor.projectPath,
            configFilePath = Path.join(projectPath, configFileDir, configFileName);
        let config = null;
        if (Fs.existsSync(configFilePath)) {
            config = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
        } else {
            config = { ...defaultConfig };
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
            configDirPath = Path.join(projectPath, configFileDir);
        if (!Fs.existsSync(configDirPath)) {
            Fs.mkdirSync(configDirPath);
        }
        const configFilePath = Path.join(projectPath, configFileDir, configFileName);
        // 读取本地配置
        let object = Object.create(null);
        if (Fs.existsSync(configFilePath)) {
            object = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
        }
        // 写入配置
        for (const key in config) {
            let value = config[key];
            if (Array.isArray(value)) {
                value = value.filter(_value => _value !== '');
            }
            object[key] = value;
        }
        Fs.writeFileSync(configFilePath, JSON.stringify(object, null, 2));
        return configFilePath;
    },

}

module.exports = ConfigManager;
