# 构建后自动压缩 PNG

## 介绍

[Cocos Creator 编辑器插件] 支持项目构建完成后自动压缩 PNG 资源。

- 压缩引擎：[pngquant 2.12.5](https://pngquant.org/)

## 截图

![screenshot](https://gitee.com/ifaswind/image-storage/raw/master/ccc-auto-compress/screenshot.png)



## 环境

平台：Windows、Mac

引擎：Cocos Creator 2.3.3（理论上通用）



## 说明

1. 将插件文件夹放置在 `/User/${你的用户名}/.CocosCreator/packages` 目录下即可
2. 点击顶部菜单栏的 **[ 扩展 --> 自动压缩 PNG ]** 打开插件配置面板
3. 本插件默认禁用，需自行启用
4. 配置文件存放位置：`/${项目目录}/local/ccc-png-auto-compress.json`



### 关于在 MacOS 上使用

在 MacOS 上使用本插件需要手动给予权限，否则会因为权限不足而压缩失败！

授权方式：

1. 打开终端；
2. 输入 `cd /User/${你的用户名}/.CocosCreator/packages/ccc-png-auto-compress/pngquant/mac` 并回车定位到插件引擎的 mac 目录下；
3. 输入 `chmod a+x ./pngquant` 并回车授予 pngquant 文件权限；
4. 至此本插件已经可以在你的电脑上使用了！



## 关于

作者：陈皮皮（ifaswind）

公众号：文弱书生陈皮皮

![weixin](https://gitee.com/ifaswind/image-storage/raw/master/weixin/qrcode.png)