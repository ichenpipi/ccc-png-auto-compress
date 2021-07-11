const { BrowserWindow } = require('electron');
const { language, translate } = require('./eazax/editor-util');

/** 包名 */
const PACKAGE_NAME = require('../package.json').name;

/** 扩展名称 */
const EXTENSION_NAME = translate('name');

/**
 * 计算窗口位置
 * @param {[number, number]} size 窗口尺寸
 * @param {'top' | 'center'} anchor 锚点
 * @returns {[number, number]}
 */
function calcWindowPosition(size, anchor) {
    // 根据当前窗口的位置和尺寸来计算
    const editorWin = BrowserWindow.getFocusedWindow(),
        editorSize = editorWin.getSize(),
        editorPos = editorWin.getPosition();
    // 注意：原点 (0, 0) 在屏幕左上角
    // 另外，窗口的位置值必须是整数，否则修改无效（像素的最小粒度为 1）
    const x = Math.floor(editorPos[0] + (editorSize[0] / 2) - (size[0] / 2));
    let y;
    switch (anchor || 'top') {
        case 'top': {
            y = Math.floor(editorPos[1]);
            break;
        }
        case 'center': {
            y = Math.floor(editorPos[1] + (editorSize[1] / 2) - (size[1] / 2));
            break;
        }
    }
    return [x, y];
}

/**
 * 面板管理器
 */
const PanelManager = {

    /**
     * 打开设置面板
     */
    openSettingPanel() {
        Editor.Panel.open(`${PACKAGE_NAME}.setting`);
    },

};

module.exports = PanelManager;
