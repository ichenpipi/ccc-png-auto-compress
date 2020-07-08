const Fs = require('fs');
const Path = require('path');

const IOUtil = {

    /**
     * 复制文件/文件夹
     * @param {string} srcPath 源路径
     * @param {string} destPath 目标路径
     */
    copy(srcPath, destPath) {
        if (Fs.existsSync(srcPath)) {
            let stat = Fs.statSync(srcPath);
            if (stat.isDirectory()) {
                if (!Fs.existsSync(destPath)) {
                    Fs.mkdirSync(destPath);
                }
                let fileNames = Fs.readdirSync(srcPath);
                for (let name of fileNames) {
                    let _srcPath = Path.join(srcPath, name);
                    let _destPath = Path.join(destPath, name);
                    this.copy(_srcPath, _destPath);
                }
            } else if (stat.isFile()) {
                let data = Fs.readFileSync(srcPath);
                Fs.writeFileSync(destPath, data);
            }
        } else {
            if (Editor) Editor.log('[IO Util]', '路径不存在', srcPath);
        }
    },

    /**
     * 删除文件/文件夹
     * @param {string} path 源路径
     */
    delete(path) {
        if (Fs.existsSync(path)) {
            let stat = Fs.statSync(path);
            if (stat.isDirectory()) {
                let fileNames = Fs.readdirSync(path);
                for (let name of fileNames) {
                    let _path = Path.join(path, name);
                    this.delete(_path);
                }
                Fs.rmdirSync(path);
            } else if (stat.isFile()) {
                Fs.unlinkSync(path);
            }
        } else {
            if (Editor) Editor.log('[IO Util]', '路径不存在', path);
        }
    }
}

module.exports = IOUtil;