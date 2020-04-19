let Fs = require('fs');
let Path = require('path');

module.exports = {
    /**
     * 复制文件/文件夹
     * @param {*} srcPath 源路径
     * @param {*} destPath 目标路径
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
            if (Editor) Editor.log('[Copy] 路径不存在！ ' + srcPath);
        }
    },

    /**
     * 删除文件/文件夹
     * @param {*} srcPath 源路径
     */
    delete(srcPath) {
        if (Fs.existsSync(srcPath)) {
            let stat = Fs.statSync(srcPath);
            if (stat.isDirectory()) {
                let fileNames = Fs.readdirSync(srcPath);
                for (let name of fileNames) {
                    let path = Path.join(srcPath, name);
                    this.delete(path);
                }
                Fs.rmdirSync(srcPath);
            } else if (stat.isFile()) {
                Fs.unlinkSync(srcPath);
            }
        } else {
            if (Editor) Editor.log('[Delete] 路径不存在！ ' + srcPath);
        }
    }
}