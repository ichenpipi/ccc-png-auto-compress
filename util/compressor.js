let Fs = require('fs');
let Exec = require('child_process').exec;
let Os = require('os');

module.exports = {

    /**
     * 压缩文件/文件夹（自动选择压缩程序）
     * @param {*} srcPath 源路径
     * @param {*} destPath 目标路径
     * @param {*} fileName 目标文件名
     */
    compress(srcPath, destPath, fileName) {
        return new Promise(async res => {
            let platform = Os.platform();
            if (platform === 'win32') {
                if (Editor) Editor.log('[Compressor] 当前操作系统为 Windows');
                Exec("REG QUERY HKEY_CURRENT_USER\\Software\\7-Zip /v Path", async (error, stdout, stderr) => {
                    if (!error && stdout && !stderr) {
                        await this.compressBy7Zip(srcPath, destPath, fileName);
                    } else {
                        await new Promise(_res => {
                            Exec("REG QUERY HKEY_CLASSES_ROOT\\WinRAR\\shell\\open\\command /ve", async (error, stdout, stderr) => {
                                if (!error && stdout && !stderr) {
                                    await this.compressByWinRAR(srcPath, destPath, fileName);
                                } else {
                                    if (Editor) Editor.log('[Compressor] 没有找到可用压缩程序，无法完成压缩功能！');
                                }
                                _res();
                            });
                        });
                    }
                    res();
                });
            } else if (platform === 'darwin') {
                if (Editor) Editor.log('[Compressor] 当前操作系统为 Mac OS');
                await this.compressInMacOS(srcPath, destPath, fileName);
                res();
            } else {
                if (Editor) Editor.log('[Compressor] 不支持当前操作系统 ' + platform);
                res();
            }
        });
    },

    /**
     * 使用 7-Zip 压缩文件/文件夹
     * @param {*} srcPath 源路径
     * @param {*} destPath 目标路径
     * @param {*} fileName 目标文件名
     */
    compressBy7Zip(srcPath, destPath, fileName) {
        if (Fs.existsSync(srcPath)) {
            return new Promise(res => {
                Exec("REG QUERY HKEY_CURRENT_USER\\Software\\7-Zip /v Path", async (error, stdout, stderr) => {
                    if (!error && stdout && !stderr) {
                        let programPath = stdout.slice(stdout.lastIndexOf(':') - 1, stdout.lastIndexOf('\\') + 1) + '7z.exe';
                        if (Editor) Editor.log('[Compressor] 已经找到 7-Zip 程序 ' + programPath);
                        let stat = Fs.statSync(srcPath);
                        if (stat.isDirectory()) srcPath += '\\*';
                        destPath += '\\' + fileName + '.zip';

                        if (Fs.existsSync(destPath)) {
                            if (Editor) Editor.log('[Compressor] 删除旧压缩文件...');
                            Fs.unlinkSync(destPath);
                        }

                        await new Promise(_res => {
                            let command = '"' + programPath + '"' + ' a ' + '"' + destPath + '"' + ' ' + '"' + srcPath + '"';
                            Exec(command, (error, stdout, stderr) => {
                                if (!error) {
                                    if (Editor) Editor.log('[Compressor] 压缩成功，压缩包完整路径为 ' + destPath);
                                } else {
                                    if (Editor) Editor.log('[Compressor] 压缩失败 ' + error);
                                }
                                _res();
                            });
                        });
                    } else {
                        if (Editor) Editor.log('[Compressor] 未找到 7-Zip 程序！');
                    }
                    res();
                });
            });
        } else {
            if (Editor) Editor.log('[Compressor] 源路径不存在！');
        }
    },


    /**
     * 使用 WinRAR 压缩文件/文件夹
     * @param {*} srcPath 源路径
     * @param {*} destPath 目标路径
     * @param {*} fileName 目标文件名
     */
    compressByWinRAR(srcPath, destPath, fileName) {
        if (Fs.existsSync(srcPath)) {
            return new Promise(res => {
                Exec("REG QUERY HKEY_CLASSES_ROOT\\WinRAR\\shell\\open\\command /ve", async (error, stdout, stderr) => {
                    if (!error && stdout && !stderr) {
                        let programPath = stdout.slice(stdout.lastIndexOf(':') - 1, stdout.lastIndexOf('\\') + 1) + 'WinRAR.exe';
                        if (Editor) Editor.log('[Compressor] 已经找到 WinRAR 程序 ' + programPath);
                        let filePaths = '';
                        let stat = Fs.statSync(srcPath);
                        if (stat.isDirectory()) {
                            let fileNames = Fs.readdirSync(srcPath);
                            for (let name of fileNames) filePaths += ' ' + '"' + srcPath + '\\' + name + '"' + ' ';
                        } else if (stat.isFile()) {
                            filePaths = '"' + srcPath + '"';
                        }
                        destPath += '\\' + fileName + '.rar';

                        if (Fs.existsSync(destPath)) {
                            if (Editor) Editor.log('[Compressor] 删除旧压缩包文件...');
                            Fs.unlinkSync(destPath);
                        }

                        await new Promise(_res => {
                            let command = '"' + programPath + '"' + ' a -ep1 ' + '"' + destPath + '"' + ' ' + filePaths;
                            Exec(command, (error, stdout, stderr) => {
                                if (!error) {
                                    if (Editor) Editor.log('[Compressor] 压缩成功，压缩包完整路径为 ' + destPath);
                                } else {
                                    if (Editor) Editor.log('[Compressor] 压缩失败 ' + error);
                                }
                                _res();
                            });
                        });
                    } else {
                        if (Editor) Editor.log('[Compressor] 未找到 WinRAR 程序！');
                    }
                    res();
                });
            });
        } else {
            if (Editor) Editor.log('[Compressor] 源路径不存在！');
        }
    },

    /**
     * 压缩文件/文件夹(Mac OS)
     * @param {*} srcPath 源路径
     * @param {*} destPath 目标路径
     * @param {*} fileName 目标文件名
     */
    compressInMacOS(srcPath, destPath, fileName) {
        if (Fs.existsSync(srcPath)) {
            return new Promise(res => {
                let stat = Fs.statSync(srcPath);
                if (stat.isDirectory()) srcPath += '\\*';
                destPath += '\\' + fileName + '.zip';

                if (Fs.existsSync(destPath)) {
                    if (Editor) Editor.log('[Compressor] 删除旧压缩文件...');
                    Fs.unlinkSync(destPath);
                }

                let command = 'zip -r' + ' ' + '"' + destPath + '"' + ' ' + '"' + srcPath + '"';
                Exec(command, async (error, stdout, stderr) => {
                    if (!error) {
                        if (Editor) Editor.log('[Compressor] 压缩成功，压缩包完整路径为 ' + destPath);
                    } else {
                        if (Editor) Editor.log('[Compressor] 压缩失败 ' + error);
                    }
                    res();
                });
            });
        } else {
            if (Editor) Editor.log('[Compressor] 源路径不存在！');
        }
    }
}