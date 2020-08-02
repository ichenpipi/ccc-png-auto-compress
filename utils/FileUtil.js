const Fs = require('fs');
const Path = require('path');

const FileUtil = {

    /**
     * 复制文件/文件夹
     * @param {string} srcPath 源路径
     * @param {string} destPath 目标路径
     */
    copy(srcPath, destPath) {
        if (Fs.existsSync(srcPath)) {
            const stat = Fs.statSync(srcPath);
            if (stat.isDirectory()) {
                if (!Fs.existsSync(destPath)) {
                    Fs.mkdirSync(destPath);
                }
                const names = Fs.readdirSync(srcPath);
                for (const name of names) {
                    const _srcPath = Path.join(srcPath, name);
                    const _destPath = Path.join(destPath, name);
                    this.copy(_srcPath, _destPath);
                }
            } else if (stat.isFile()) {
                const data = Fs.readFileSync(srcPath);
                Fs.writeFileSync(destPath, data);
            }
        }
    },

    /**
     * 删除文件/文件夹
     * @param {string} path 路径
     */
    delete(path) {
        if (Fs.existsSync(path)) {
            const stat = Fs.statSync(path);
            if (stat.isDirectory()) {
                const names = Fs.readdirSync(path);
                for (const name of names) {
                    const _path = Path.join(path, name);
                    this.delete(_path);
                }
                Fs.rmdirSync(path);
            } else if (stat.isFile()) {
                Fs.unlinkSync(path);
            }
        }
    },

    /**
     * 遍历文件/文件夹并执行函数
     * @param {string} path 路径
     * @param {(filePath: string)=>void} handler 处理函数
     */
    map(path, handler) {
        if (Fs.existsSync(path)) {
            const stat = Fs.statSync(path);
            if (stat.isDirectory()) {
                const names = Fs.readdirSync(path);
                for (const name of names) {
                    const _path = Path.join(path, name);
                    this.map(_path, handler);
                }
            } else if (stat.isFile()) {
                handler(path);
            }
        }
    }

}

module.exports = FileUtil;